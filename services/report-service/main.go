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
		log.Fatalf("❌ Failed to connect to MongoDB: %v", err)
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
		log.Fatalf("❌ Failed to connect to RabbitMQ: %v", err)
	}
	defer conn.Close()
	defer ch.Close()
	amqpChannel = ch
	log.Println("✅ Connected to RabbitMQ!")

	http.HandleFunc("/api/reports", middleware.LoggerMiddleware(middleware.AuthMiddleware(reportsHandler)).ServeHTTP)
	http.HandleFunc("/api/reports/", middleware.LoggerMiddleware(middleware.AuthMiddleware(reportDetailHandler)).ServeHTTP)
	http.HandleFunc("/internal/updates", middleware.LoggerMiddleware(http.HandlerFunc(internalUpdateStatusHandler)).ServeHTTP)

	port := ":8082"
	log.Printf("🚀 Report Service running on port %s", port)
	if err := http.ListenAndServe(port, nil); err != nil {
		log.Fatalf("❌ Server failed: %v", err)
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
		IsAnonymous bool   `json:"is_anonymous"`
	}

	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		response.Error(w, http.StatusBadRequest, "Invalid request payload", err.Error())
		return
	}

	if input.Title == "" || input.Description == "" || input.Category == "" {
		response.Error(w, http.StatusBadRequest, "Title, Description, and Category are required", "")
		return
	}

	newReport := models.Report{
		ID:          primitive.NewObjectID(),
		Title:       input.Title,
		Description: input.Description,
		Category:    input.Category,
		IsAnonymous: input.IsAnonymous,
		ReporterID:  claims.UserID,
		Reporter:    claims.Email,
		Status:      "PENDING",
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
		log.Printf("⚠️ Report saved but failed to publish event: %v", err)
	} else {
		log.Printf("📤 Event published to '%s'", queueName)
	}

	response.Success(w, http.StatusCreated, "Report created successfully", newReport)
}

func getReports(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	filter := bson.M{}
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

	response.Success(w, http.StatusOK, "Reports fetched successfully", reports)
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
