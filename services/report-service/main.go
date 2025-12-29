package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"citizen-reporting-system/pkg/database"
	"citizen-reporting-system/pkg/middleware"
	"citizen-reporting-system/pkg/queue"
	"citizen-reporting-system/pkg/response"
	"citizen-reporting-system/services/report-service/models"

	amqp "github.com/rabbitmq/amqp091-go"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

var (
	db          *mongo.Database
	amqpChannel *amqp.Channel
	queueName   = "report_queue"
)

func main() {
	mongoURI := fmt.Sprintf("mongodb://%s:%s@%s:%s",
		os.Getenv("MONGO_USER"),
		os.Getenv("MONGO_PASSWORD"),
		os.Getenv("MONGO_HOST"),
		os.Getenv("MONGO_PORT"),
	)
	if os.Getenv("MONGO_HOST") == "" {
		mongoURI = "mongodb://admin:password@localhost:27017"
	}

	var err error
	db, err = database.ConnectMongo(mongoURI, "report_db")
	if err != nil {
		log.Fatalf("[ERROR] Failed to connect to MongoDB: %v", err)
	}

	amqpURI := fmt.Sprintf("amqp://%s:%s@%s:%s/",
		os.Getenv("RABBITMQ_USER"),
		os.Getenv("RABBITMQ_PASS"),
		os.Getenv("RABBITMQ_HOST"),
		os.Getenv("RABBITMQ_PORT"),
	)
	if os.Getenv("RABBITMQ_HOST") == "" {
		amqpURI = "amqp://guest:guest@localhost:5672/"
	}

	conn, ch, err := queue.ConnectRabbitMQ(amqpURI)
	if err != nil {
		log.Fatalf("[ERROR] Failed to connect to RabbitMQ: %v", err)
	}
	defer conn.Close()
	defer ch.Close()
	amqpChannel = ch
	log.Println("[OK] Connected to RabbitMQ")

	http.HandleFunc("/api/reports", middleware.LoggerMiddleware(middleware.AuthMiddleware(reportsHandler)).ServeHTTP)
	http.HandleFunc("/api/reports/mine", middleware.LoggerMiddleware(middleware.AuthMiddleware(myReportsHandler)).ServeHTTP)
	http.HandleFunc("/api/reports/", middleware.LoggerMiddleware(middleware.AuthMiddleware(reportDetailHandler)).ServeHTTP)
	http.HandleFunc("/internal/updates", middleware.LoggerMiddleware(http.HandlerFunc(internalUpdateStatusHandler)).ServeHTTP)
	
	// Admin endpoints (no auth required for now, can be protected later)
	http.HandleFunc("/admin/reports", middleware.LoggerMiddleware(http.HandlerFunc(adminReportsHandler)).ServeHTTP)
	http.HandleFunc("/admin/analytics", middleware.LoggerMiddleware(http.HandlerFunc(adminAnalyticsHandler)).ServeHTTP)

	port := ":8082"
	log.Printf("[INFO] Report Service running on port %s", port)
	if err := http.ListenAndServe(port, nil); err != nil {
		log.Fatalf("[ERROR] Server failed: %v", err)
	}
}

// maskAnonymousReporter hides reporter name for anonymous reports
func maskAnonymousReporter(reports []models.Report) []models.Report {
	for i := range reports {
		if reports[i].IsAnonymous {
			reports[i].Reporter = "Pelapor Anonim"
		}
	}
	return reports
}

// maskAnonymousReporterSingle hides reporter name for single anonymous report
func maskAnonymousReporterSingle(report *models.Report) {
	if report.IsAnonymous {
		report.Reporter = "Pelapor Anonim"
	}
}

func reportsHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		getReports(w, r)
	case http.MethodPost:
		createReport(w, r)
	default:
		response.Error(w, http.StatusMethodNotAllowed, "Method not allowed", "")
	}
}

func reportDetailHandler(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Path[len("/api/reports/"):]
	if id == "" {
		response.Error(w, http.StatusBadRequest, "Missing report ID", "")
		return
	}

	switch r.Method {
	case http.MethodGet:
		getReportByID(w, r, id)
	case http.MethodPut:
		updateReportStatus(w, r, id)
	default:
		response.Error(w, http.StatusMethodNotAllowed, "Method not allowed", "")
	}
}

func createReport(w http.ResponseWriter, r *http.Request) {
	claims, ok := r.Context().Value(middleware.UserContextKey).(*middleware.UserClaims)
	if !ok {
		response.Error(w, http.StatusUnauthorized, "Unauthorized", "")
		return
	}

	var input struct {
		Title       string `json:"title"`
		Description string `json:"description"`
		Category    string `json:"category"`
		Location    string `json:"location"`
		ImageUrl    string `json:"imageUrl"`
		Privacy     string `json:"privacy"` // "public", "private", "anonymous"
		IsAnonymous bool   `json:"isAnonymous"`
		IsPublic    bool   `json:"isPublic"`
	}

	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		response.Error(w, http.StatusBadRequest, "Invalid request payload", err.Error())
		return
	}

	if input.Title == "" || input.Description == "" || input.Category == "" {
		response.Error(w, http.StatusBadRequest, "Title, Description, and Category are required", "")
		return
	}

	// Determine public/anonymous based on privacy field
	isPublic := true
	isAnon := false

	if input.Privacy == "private" {
		isPublic = false
		isAnon = false
	} else if input.Privacy == "anonymous" {
		isPublic = true
		isAnon = true
	}
	// else default "public" - isPublic=true, isAnon=false

	log.Printf("[INFO] Creating report - Privacy: %s, IsPublic: %v, IsAnonymous: %v", input.Privacy, isPublic, isAnon)

	newReport := models.Report{
		ID:          primitive.NewObjectID(),
		Title:       input.Title,
		Description: input.Description,
		Category:    input.Category,
		Location:    input.Location,
		ImageURL:    input.ImageUrl,
		IsAnonymous: isAnon,
		IsPublic:    isPublic,
		ReporterID:  claims.UserID,
		Reporter:    claims.Email,
		Status:      "pending",
		Upvotes:     0,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err := db.Collection("reports").InsertOne(ctx, newReport)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "Failed to save report", err.Error())
		return
	}

	log.Printf("[OK] Report saved - ID: %s, IsPublic: %v, IsAnonymous: %v", newReport.ID.Hex(), newReport.IsPublic, newReport.IsAnonymous)

	event := models.ReportEvent{
		ID:          newReport.ID.Hex(),
		Title:       newReport.Title,
		Description: newReport.Description,
		Category:    newReport.Category,
		IsAnonymous: newReport.IsAnonymous,
		ReporterID:  newReport.ReporterID,
		Reporter:    newReport.Reporter,
		CreatedAt:   newReport.CreatedAt,
	}

	err = queue.PublishMessage(amqpChannel, queueName, event)
	if err != nil {
		log.Printf("[WARN] Report saved but failed to publish event: %v", err)
	} else {
		log.Printf("[INFO] Event published to '%s'", queueName)
	}

	response.Success(w, http.StatusCreated, "Report created successfully", newReport)
}

func getReports(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	filter := bson.M{
		"is_public": true, // Only return public reports
	}
	status := r.URL.Query().Get("status")
	if status != "" {
		filter["status"] = status
	}

	cursor, err := db.Collection("reports").Find(ctx, filter)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "Failed to fetch reports", err.Error())
		return
	}
	defer cursor.Close(ctx)

	var reports []models.Report
	if err := cursor.All(ctx, &reports); err != nil {
		response.Error(w, http.StatusInternalServerError, "Failed to decode reports", err.Error())
		return
	}

	// Mask anonymous reporters
	reports = maskAnonymousReporter(reports)
	response.Success(w, http.StatusOK, "Reports fetched successfully", reports)
}

func myReportsHandler(w http.ResponseWriter, r *http.Request) {
	claims, ok := r.Context().Value(middleware.UserContextKey).(*middleware.UserClaims)
	if !ok {
		response.Error(w, http.StatusUnauthorized, "Unauthorized", "")
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Filter by user's ID - return all reports (public and private) of this user
	filter := bson.M{
		"reporter_id": claims.UserID,
	}
	status := r.URL.Query().Get("status")
	if status != "" {
		filter["status"] = status
	}

	cursor, err := db.Collection("reports").Find(ctx, filter)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "Failed to fetch reports", err.Error())
		return
	}
	defer cursor.Close(ctx)

	var reports []models.Report
	if err := cursor.All(ctx, &reports); err != nil {
		response.Error(w, http.StatusInternalServerError, "Failed to decode reports", err.Error())
		return
	}

	// Debug logging
	for _, r := range reports {
		log.Printf("[DEBUG] MyReport - ID: %s, IsPublic: %v, IsAnonymous: %v", r.ID.Hex(), r.IsPublic, r.IsAnonymous)
	}

	// Note: For user's own reports, we show the full name even if anonymous
	// because they need to see their own anonymous reports properly
	response.Success(w, http.StatusOK, "User reports fetched successfully", reports)
}

func getReportByID(w http.ResponseWriter, r *http.Request, id string) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	objID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		response.Error(w, http.StatusBadRequest, "Invalid report ID", err.Error())
		return
	}

	var report models.Report
	err = db.Collection("reports").FindOne(ctx, bson.M{"_id": objID}).Decode(&report)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			response.Error(w, http.StatusNotFound, "Report not found", "")
		} else {
			response.Error(w, http.StatusInternalServerError, "Failed to fetch report", err.Error())
		}
		return
	}

	// Mask anonymous reporter name
	maskAnonymousReporterSingle(&report)
	response.Success(w, http.StatusOK, "Report fetched successfully", report)
}

func updateReportStatus(w http.ResponseWriter, r *http.Request, id string) {
	var input struct {
		Status string `json:"status"`
	}

	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		response.Error(w, http.StatusBadRequest, "Invalid request payload", err.Error())
		return
	}

	validStatuses := map[string]bool{
		"PENDING":     true,
		"IN_PROGRESS": true,
		"RESOLVED":    true,
		"REJECTED":    true,
	}

	if !validStatuses[input.Status] {
		response.Error(w, http.StatusBadRequest, "Invalid status", "")
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	objID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		response.Error(w, http.StatusBadRequest, "Invalid report ID", err.Error())
		return
	}

	update := bson.M{
		"$set": bson.M{
			"status":     input.Status,
			"updated_at": time.Now(),
		},
	}

	result, err := db.Collection("reports").UpdateOne(ctx, bson.M{"_id": objID}, update)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "Failed to update status", err.Error())
		return
	}

	if result.MatchedCount == 0 {
		response.Error(w, http.StatusNotFound, "Report not found", "")
		return
	}

	response.Success(w, http.StatusOK, "Report status updated", nil)
}

func internalUpdateStatusHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		response.Error(w, http.StatusMethodNotAllowed, "Method not allowed", "")
		return
	}

	var input struct {
		ID     string `json:"id"`
		Status string `json:"status"`
	}

	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		response.Error(w, http.StatusBadRequest, "Invalid request payload", err.Error())
		return
	}

	if input.ID == "" || input.Status == "" {
		response.Error(w, http.StatusBadRequest, "ID and Status are required", "")
		return
	}

	validStatuses := map[string]bool{
		"PENDING":     true,
		"IN_PROGRESS": true,
		"RESOLVED":    true,
		"REJECTED":    true,
	}

	if !validStatuses[input.Status] {
		response.Error(w, http.StatusBadRequest, "Invalid status", "")
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	objID, err := primitive.ObjectIDFromHex(input.ID)
	if err != nil {
		response.Error(w, http.StatusBadRequest, "Invalid report ID", err.Error())
		return
	}

	update := bson.M{
		"$set": bson.M{
			"status":     input.Status,
			"updated_at": time.Now(),
		},
	}

	result, err := db.Collection("reports").UpdateOne(ctx, bson.M{"_id": objID}, update)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "Failed to update status", err.Error())
		return
	}

	if result.MatchedCount == 0 {
		response.Error(w, http.StatusNotFound, "Report not found", "")
		return
	}

	response.Success(w, http.StatusOK, "Report status updated via internal API", nil)
}

// Admin endpoints - Get all reports (with filters)
func adminReportsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		response.Error(w, http.StatusMethodNotAllowed, "Method not allowed", "")
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Build filter
	filter := bson.M{}

	// Status filter
	status := r.URL.Query().Get("status")
	if status != "" {
		filter["status"] = status
	}

	// Category filter
	category := r.URL.Query().Get("category")
	if category != "" {
		filter["category"] = category
	}

	// Time range filter (default: 30 days)
	timeRangeStr := r.URL.Query().Get("timeRange")
	if timeRangeStr == "" {
		timeRangeStr = "30d"
	}

	var days int
	switch timeRangeStr {
	case "7d":
		days = 7
	case "90d":
		days = 90
	default:
		days = 30
	}

	startDate := time.Now().AddDate(0, 0, -days)
	filter["created_at"] = bson.M{"$gte": startDate}

	log.Printf("[INFO] Admin fetching reports - Filter: %v", filter)

	cursor, err := db.Collection("reports").Find(ctx, filter)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "Failed to fetch reports", err.Error())
		return
	}
	defer cursor.Close(ctx)

	var reports []models.Report
	if err := cursor.All(ctx, &reports); err != nil {
		response.Error(w, http.StatusInternalServerError, "Failed to decode reports", err.Error())
		return
	}

	log.Printf("[OK] Admin fetched %d reports", len(reports))
	response.Success(w, http.StatusOK, "Reports fetched successfully", reports)
}

// Admin endpoints - Get analytics data
func adminAnalyticsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		response.Error(w, http.StatusMethodNotAllowed, "Method not allowed", "")
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	timeRangeStr := r.URL.Query().Get("timeRange")
	if timeRangeStr == "" {
		timeRangeStr = "30d"
	}

	var days int
	switch timeRangeStr {
	case "7d":
		days = 7
	case "90d":
		days = 90
	default:
		days = 30
	}

	startDate := time.Now().AddDate(0, 0, -days)

	// Count total reports
	totalCount, err := db.Collection("reports").CountDocuments(ctx, bson.M{
		"created_at": bson.M{"$gte": startDate},
	})
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "Failed to count reports", err.Error())
		return
	}

	// Count by status
	pendingCount, _ := db.Collection("reports").CountDocuments(ctx, bson.M{
		"status":     "pending",
		"created_at": bson.M{"$gte": startDate},
	})

	inProgressCount, _ := db.Collection("reports").CountDocuments(ctx, bson.M{
		"status":     "in-progress",
		"created_at": bson.M{"$gte": startDate},
	})

	completedCount, _ := db.Collection("reports").CountDocuments(ctx, bson.M{
		"status":     "completed",
		"created_at": bson.M{"$gte": startDate},
	})

	// Get total upvotes
	pipeline := []bson.M{
		{
			"$match": bson.M{
				"created_at": bson.M{"$gte": startDate},
			},
		},
		{
			"$group": bson.M{
				"_id": nil,
				"total_upvotes": bson.M{"$sum": "$upvotes"},
				"avg_process_time": bson.M{"$avg": "$process_time_hours"},
			},
		},
	}

	cursor, err := db.Collection("reports").Aggregate(ctx, pipeline)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "Failed to aggregate data", err.Error())
		return
	}
	defer cursor.Close(ctx)

	var aggregateResult []bson.M
	if err = cursor.All(ctx, &aggregateResult); err != nil {
		response.Error(w, http.StatusInternalServerError, "Failed to read aggregation", err.Error())
		return
	}

	totalUpvotes := int64(0)
	avgProcessTime := 0.0

	if len(aggregateResult) > 0 {
		if val, ok := aggregateResult[0]["total_upvotes"]; ok {
			totalUpvotes = int64(val.(int32))
		}
		if val, ok := aggregateResult[0]["avg_process_time"]; ok {
			avgProcessTime = val.(float64)
		}
	}

	completionRate := 0.0
	if totalCount > 0 {
		completionRate = (float64(completedCount) / float64(totalCount)) * 100
	}

	analytics := map[string]interface{}{
		"total":          totalCount,
		"pending":        pendingCount,
		"inProgress":     inProgressCount,
		"completed":      completedCount,
		"completionRate": completionRate,
		"totalUpvotes":   totalUpvotes,
		"avgProcessTime": avgProcessTime,
		"timeRange":      timeRangeStr,
	}

	log.Printf("[OK] Analytics generated - Total: %d, Completed: %d, Pending: %d", totalCount, completedCount, pendingCount)
	response.Success(w, http.StatusOK, "Analytics data retrieved", analytics)
}
