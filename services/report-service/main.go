package main


import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"citizen-reporting-system/pkg/database"
	"citizen-reporting-system/pkg/middleware"
	"citizen-reporting-system/pkg/queue"
	"citizen-reporting-system/pkg/security"
	"citizen-reporting-system/pkg/response"
	"citizen-reporting-system/services/report-service/models"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
	amqp "github.com/rabbitmq/amqp091-go"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var (
	db          *mongo.Database
	amqpChannel *amqp.Channel
	queueName   = "report_queue"
	minioClient *minio.Client
	minioBucket = "laporan-warga"
)

func ensureMinioBucketPublicRead(ctx context.Context, client *minio.Client, bucket string) {
	if client == nil || bucket == "" {
		return
	}

	policy := fmt.Sprintf(`{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"AWS":["*"]},"Action":["s3:GetObject"],"Resource":["arn:aws:s3:::%s/*"]}]}`,
		bucket,
	)

	if err := client.SetBucketPolicy(ctx, bucket, policy); err != nil {
		log.Printf("[WARN] Failed to set MinIO bucket policy public-read for '%s': %v", bucket, err)
		return
	}
	log.Printf("[OK] MinIO bucket policy set: public-read (%s)", bucket)
}

func normalizeDepartment(department string) string {
	d := strings.ToLower(strings.TrimSpace(department))
	d = strings.ReplaceAll(d, "-", "_")
	d = strings.ReplaceAll(d, " ", "_")
	return d
}

// mapCategoryToDepartment maps report categories to departments
func mapCategoryToDepartment(category string) []string {
	switch category {
	case "Sampah":
		return []string{"DINAS KEBERSIHAN"}
	case "Jalan":
		return []string{"DINAS PU"}
	case "Keamanan":
		return []string{"KEPOLISIAN"}
	default:
		return []string{}
	}
}

// mapDepartmentToCategories maps admin department to report categories they handle
func mapDepartmentToCategories(department string) []string {
	switch normalizeDepartment(department) {
	case "general":
		return []string{"Sampah", "Jalan Rusak", "Drainase", "Fasilitas Umum", "Lampu Jalan", "Polusi", "Traffic & Transport", "Keamanan"}
	case "kebersihan":
		return []string{"Sampah"}
	case "pekerjaan_umum", "pekerjaanumum", "pu":
		return []string{"Jalan Rusak", "Drainase", "Fasilitas Umum"}
	case "penerangan", "penerangan_jalan":
		return []string{"Lampu Jalan"}
	case "lingkungan_hidup", "lingkungan":
		return []string{"Polusi"}
	case "perhubungan":
		return []string{"Traffic & Transport"}
	default:
		return []string{}
	}
}

// hashIdentity creates a one-way hash of user identity for anonymous reports
func hashIdentity(userID string) string {
	hash := sha256.Sum256([]byte(userID + "anonymous_salt_2025"))
	return "ANON_" + hex.EncodeToString(hash[:])[:16]
}

// isValidCategory checks if category is in allowed list
func isValidCategory(category string) bool {
	validCategories := map[string]bool{
		"Sampah":              true,
		"Jalan Rusak":         true,
		"Drainase":            true,
		"Fasilitas Umum":      true,
		"Lampu Jalan":         true,
		"Polusi":              true,
		"Traffic & Transport": true,
		"Keamanan":            true,
	}
	return validCategories[category]
}

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

	// Ensure exchange exists for notification events
	if err := amqpChannel.ExchangeDeclare("reports", "direct", true, false, false, false, nil); err != nil {
		log.Fatalf("[ERROR] Failed to declare exchange 'reports': %v", err)
	}

	// MinIO client init (for multimedia uploads)
	minioEndpoint := os.Getenv("MINIO_ENDPOINT")
	if minioEndpoint == "" {
		minioEndpoint = "localhost:9000"
	}
	minioAccessKey := os.Getenv("MINIO_ACCESS_KEY")
	if minioAccessKey == "" {
		minioAccessKey = "minioadmin"
	}
	minioSecretKey := os.Getenv("MINIO_SECRET_KEY")
	if minioSecretKey == "" {
		minioSecretKey = "minioadmin"
	}
	if b := os.Getenv("MINIO_BUCKET"); b != "" {
		minioBucket = b
	}
	useSSL := strings.EqualFold(os.Getenv("MINIO_USE_SSL"), "true")

	minioClient, err = minio.New(minioEndpoint, &minio.Options{Creds: credentials.NewStaticV4(minioAccessKey, minioSecretKey, ""), Secure: useSSL})
	if err != nil {
		log.Fatalf("[ERROR] Failed to init MinIO client: %v", err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	exists, err := minioClient.BucketExists(ctx, minioBucket)
	if err != nil {
		log.Fatalf("[ERROR] Failed to check MinIO bucket: %v", err)
	}
	if !exists {
		if err := minioClient.MakeBucket(ctx, minioBucket, minio.MakeBucketOptions{}); err != nil {
			log.Fatalf("[ERROR] Failed to create MinIO bucket '%s': %v", minioBucket, err)
		}
		log.Printf("[OK] MinIO bucket created: %s", minioBucket)
	}
	policyCtx, policyCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer policyCancel()
	ensureMinioBucketPublicRead(policyCtx, minioClient, minioBucket)

	// Create mux and register routes
	mux := http.NewServeMux()

	// Setup HTTP routes
	mux.Handle("/api/reports", middleware.LoggerMiddleware(middleware.AuthMiddleware(http.HandlerFunc(reportsHandler))))
	mux.Handle("/api/reports/upload", middleware.LoggerMiddleware(middleware.AuthMiddleware(http.HandlerFunc(uploadImageHandler))))
	mux.Handle("/api/reports/mine", middleware.LoggerMiddleware(middleware.AuthMiddleware(http.HandlerFunc(myReportsHandler))))
	mux.Handle("/api/reports/", middleware.LoggerMiddleware(middleware.AuthMiddleware(http.HandlerFunc(reportDetailHandler))))
	mux.Handle("/internal/updates", middleware.LoggerMiddleware(http.HandlerFunc(internalUpdateStatusHandler)))

	// Health check and metrics endpoints
	mux.HandleFunc("/health", healthCheckHandler)
	mux.HandleFunc("/metrics", metricsHandler)

	// Admin endpoints (JWT required + role-based access)
	adminChain := func(h http.Handler) http.Handler {
		return middleware.LoggerMiddleware(middleware.AuthMiddleware(middleware.RequireRole("admin")(h)))
	}
	// Register specific routes BEFORE generic ones to prevent premature matching
	mux.Handle("/admin/reports/escalation", adminChain(http.HandlerFunc(adminEscalationHandler)))
	mux.Handle("/admin/reports/escalate/", adminChain(http.HandlerFunc(adminEscalateReportHandler)))
	mux.Handle("/admin/reports/forward/", adminChain(http.HandlerFunc(adminForwardReportHandler)))
	mux.Handle("/admin/analytics", adminChain(http.HandlerFunc(adminAnalyticsHandler)))
	mux.Handle("/admin/reports", adminChain(http.HandlerFunc(adminReportsHandler)))
	mux.Handle("/admin/reports/", adminChain(http.HandlerFunc(adminReportDetailHandler)))

	port := ":8082"
	log.Printf("[INFO] Report Service running on port %s", port)

	// Wrap with CORS middleware
	handler := middleware.CORSMiddleware(mux)

	if err := http.ListenAndServe(port, handler); err != nil {
		log.Fatalf("[ERROR] Server failed: %v", err)
	}
}

// corsPreflightHandler handles preflight CORS requests
func corsPreflightHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Department, X-Trace-Id, X-Client-Type")
	w.Header().Set("Access-Control-Max-Age", "3600")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
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

func containsString(list []string, v string) bool {
	for _, s := range list {
		if s == v {
			return true
		}
	}
	return false
}

func computeHasUpvoted(report *models.Report, userID string) {
	if userID == "" {
		return
	}
	report.HasUpvoted = containsString(report.UpvotedBy, userID)
}

func sanitizeReportForAdmin(report *models.Report) {
	// Do not leak reporter_id to admin dashboards.
	report.ReporterID = ""
	// Always mask anonymous reporter name.
	maskAnonymousReporterSingle(report)
}

func isCategoryAllowedForDepartment(department, category string) bool {
	dept := normalizeDepartment(department)
	if dept == "" || dept == "general" {
		return true
	}
	allowed := mapDepartmentToCategories(dept)
	return containsString(allowed, category)
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
	path := strings.TrimPrefix(r.URL.Path, "/api/reports/")
	if path == "" {
		response.Error(w, http.StatusBadRequest, "Missing report ID", "")
		return
	}

	// Upvote endpoints: /api/reports/{id}/upvote
	if strings.HasSuffix(path, "/upvote") {
		reportID := strings.TrimSuffix(path, "/upvote")
		reportID = strings.TrimSuffix(reportID, "/")
		if reportID == "" {
			response.Error(w, http.StatusBadRequest, "Missing report ID", "")
			return
		}
		switch r.Method {
		case http.MethodPost:
			upvoteReport(w, r, reportID)
		case http.MethodDelete:
			removeUpvote(w, r, reportID)
		default:
			response.Error(w, http.StatusMethodNotAllowed, "Method not allowed", "")
		}
		return
	}

	id := strings.TrimSuffix(path, "/")
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

	// Validation
	if input.Title == "" || input.Description == "" || input.Category == "" {
		response.Error(w, http.StatusBadRequest, "Title, Description, and Category are required", "")
		return
	}

	if len(input.Title) < 5 || len(input.Title) > 200 {
		response.Error(w, http.StatusBadRequest, "Title must be between 5-200 characters", "")
		return
	}

	if len(input.Description) < 10 {
		response.Error(w, http.StatusBadRequest, "Description must be at least 10 characters", "")
		return
	}

	if !isValidCategory(input.Category) {
		response.Error(w, http.StatusBadRequest, "Invalid category", "")
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

	// Prepare reporter identity - CRITICAL: Hash if anonymous
	reporterID := claims.UserID
	reporter := claims.Name
	if strings.TrimSpace(reporter) == "" {
		reporter = claims.Email
	}
	reporterIDEnc := ""
	if isAnon {
		reporterID = hashIdentity(claims.UserID)
		enc, err := security.EncryptString(claims.UserID)
		if err != nil {
			response.Error(w, http.StatusInternalServerError, "Failed to protect anonymous identity", "")
			return
		}
		reporterIDEnc = enc
		reporter = "Pelapor Anonim"
		log.Printf("[SECURITY] Anonymous report - identity protected")
	}

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
		ReporterID:  reporterID,
		ReporterIDEnc: reporterIDEnc,
		Reporter:    reporter,
		// Use uppercase status to stay consistent with admin filtering/UI badges
		Status:    "PENDING",
		Upvotes:   0,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
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

	// Publish real-time event for dashboards (no reporter identity included)
	go func(report models.Report) {
		if err := publishNewReportEvent(report); err != nil {
			log.Printf("[WARN] Failed to publish new_report notification: %v", err)
		}
	}(newReport)

	response.Success(w, http.StatusCreated, "Report created successfully", newReport)
}

func getReports(w http.ResponseWriter, r *http.Request) {
	claims, _ := r.Context().Value(middleware.UserContextKey).(*middleware.UserClaims)
	userID := ""
	if claims != nil {
		userID = claims.UserID
	}

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

	// Mask anonymous reporters + compute user upvote state
	reports = maskAnonymousReporter(reports)
	for i := range reports {
		computeHasUpvoted(&reports[i], userID)
	}
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
	for i := range reports {
		computeHasUpvoted(&reports[i], claims.UserID)
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
	claims, _ := r.Context().Value(middleware.UserContextKey).(*middleware.UserClaims)
	if claims != nil {
		computeHasUpvoted(&report, claims.UserID)
	}
	response.Success(w, http.StatusOK, "Report fetched successfully", report)
}

type notificationPayload struct {
	ID        string    `json:"id"`
	ReportID  string    `json:"report_id"`
	Title     string    `json:"title"`
	Message   string    `json:"message"`
	Type      string    `json:"type"`
	Status    string    `json:"status"`
	Category  string    `json:"category,omitempty"`
	UserID    string    `json:"user_id,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}

// publishNotificationEvent publishes status update notification to RabbitMQ.
// It targets ONLY the report owner (user_id) and never includes reporter identity fields.
func publishNotificationEvent(reportID, title, status string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	objID, err := primitive.ObjectIDFromHex(reportID)
	if err != nil {
		return err
	}

	var report models.Report
	if err := db.Collection("reports").FindOne(ctx, bson.M{"_id": objID}).Decode(&report); err != nil {
		return err
	}

	// Determine the real user id for notifications.
	userID := report.ReporterID
	if report.IsAnonymous {
		if report.ReporterIDEnc == "" {
			// Should not happen for new anonymous reports; avoid leaking by broadcasting.
			userID = ""
		} else {
			realID, err := security.DecryptString(report.ReporterIDEnc)
			if err != nil {
				return err
			}
			userID = realID
		}
	}

	payload := notificationPayload{
		ID:        reportID,
		ReportID:  reportID,
		Title:     title,
		Message:   "Status laporan berubah menjadi: " + translateStatus(status),
		Type:      "status_update",
		Status:    strings.ToUpper(strings.ReplaceAll(strings.TrimSpace(status), "-", "_")),
		Category:  report.Category,
		UserID:    userID,
		CreatedAt: time.Now(),
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	return amqpChannel.Publish(
		"reports",
		"report.updated",
		false,
		false,
		amqp.Publishing{
			ContentType:  "application/json",
			DeliveryMode: amqp.Persistent,
			Body:         body,
			Timestamp:    time.Now(),
		},
	)
}

// publishNewReportEvent publishes a real-time event for dashboards when a report is created.
// This event contains no reporter identity.
func publishNewReportEvent(report models.Report) error {
	payload := notificationPayload{
		ID:        report.ID.Hex(),
		ReportID:  report.ID.Hex(),
		Title:     "Laporan Baru",
		Message:   "Laporan baru masuk: " + report.Title,
		Type:      "new_report",
		Status:    report.Status,
		Category:  report.Category,
		CreatedAt: report.CreatedAt,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	return amqpChannel.Publish(
		"reports",
		"report.created",
		false,
		false,
		amqp.Publishing{
			ContentType:  "application/json",
			DeliveryMode: amqp.Persistent,
			Body:         body,
			Timestamp:    time.Now(),
		},
	)
}

// translateStatus converts status to Indonesian
func translateStatus(status string) string {
	s := strings.ToUpper(strings.TrimSpace(status))
	s = strings.ReplaceAll(s, "-", "_")
	switch s {
	case "PENDING":
		return "Menunggu"
	case "IN_PROGRESS":
		return "Sedang Diproses"
	case "RESOLVED":
		return "Selesai"
	case "REJECTED":
		return "Ditolak"
	default:
		return s
	}
}

func updateReportStatus(w http.ResponseWriter, r *http.Request, id string) {
	// Only admins can change report status through this public endpoint.
	claims, _ := r.Context().Value(middleware.UserContextKey).(*middleware.UserClaims)
	if claims == nil || claims.Role != "admin" {
		response.Error(w, http.StatusForbidden, "Forbidden", "Only admin can update report status")
		return
	}

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

	// Publish notification event
	go func() {
		if err := publishNotificationEvent(id, "Status Laporan Diperbarui", input.Status); err != nil {
			log.Printf("[WARN] Failed to publish notification: %v", err)
		}
	}()

	response.Success(w, http.StatusOK, "Report status updated", nil)
}

func upvoteReport(w http.ResponseWriter, r *http.Request, id string) {
	claims, _ := r.Context().Value(middleware.UserContextKey).(*middleware.UserClaims)
	if claims == nil {
		response.Error(w, http.StatusUnauthorized, "Unauthorized", "")
		return
	}

	objID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		response.Error(w, http.StatusBadRequest, "Invalid report ID", err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var report models.Report
	if err := db.Collection("reports").FindOne(ctx, bson.M{"_id": objID}).Decode(&report); err != nil {
		if err == mongo.ErrNoDocuments {
			response.Error(w, http.StatusNotFound, "Report not found", "")
			return
		}
		response.Error(w, http.StatusInternalServerError, "Failed to fetch report", err.Error())
		return
	}

	if !report.IsPublic {
		response.Error(w, http.StatusForbidden, "Forbidden", "Cannot upvote private reports")
		return
	}

	if containsString(report.UpvotedBy, claims.UserID) {
		response.Success(w, http.StatusOK, "Already upvoted", map[string]interface{}{"upvotes": report.Upvotes, "has_upvoted": true})
		return
	}

	update := bson.M{
		"$addToSet": bson.M{"upvoted_by": claims.UserID},
		"$inc":      bson.M{"upvotes": 1},
		"$set":      bson.M{"updated_at": time.Now()},
	}

	if _, err := db.Collection("reports").UpdateOne(ctx, bson.M{"_id": objID}, update); err != nil {
		response.Error(w, http.StatusInternalServerError, "Failed to upvote report", err.Error())
		return
	}

	response.Success(w, http.StatusOK, "Upvoted", map[string]interface{}{"has_upvoted": true})
}

func removeUpvote(w http.ResponseWriter, r *http.Request, id string) {
	claims, _ := r.Context().Value(middleware.UserContextKey).(*middleware.UserClaims)
	if claims == nil {
		response.Error(w, http.StatusUnauthorized, "Unauthorized", "")
		return
	}

	objID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		response.Error(w, http.StatusBadRequest, "Invalid report ID", err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var report models.Report
	if err := db.Collection("reports").FindOne(ctx, bson.M{"_id": objID}).Decode(&report); err != nil {
		if err == mongo.ErrNoDocuments {
			response.Error(w, http.StatusNotFound, "Report not found", "")
			return
		}
		response.Error(w, http.StatusInternalServerError, "Failed to fetch report", err.Error())
		return
	}

	if !containsString(report.UpvotedBy, claims.UserID) {
		response.Success(w, http.StatusOK, "Not upvoted", map[string]interface{}{"has_upvoted": false})
		return
	}

	dec := -1
	if report.Upvotes <= 0 {
		dec = 0
	}

	update := bson.M{
		"$pull": bson.M{"upvoted_by": claims.UserID},
		"$inc":  bson.M{"upvotes": dec},
		"$set":  bson.M{"updated_at": time.Now()},
	}

	if _, err := db.Collection("reports").UpdateOne(ctx, bson.M{"_id": objID}, update); err != nil {
		response.Error(w, http.StatusInternalServerError, "Failed to remove upvote", err.Error())
		return
	}

	response.Success(w, http.StatusOK, "Upvote removed", map[string]interface{}{"has_upvoted": false})
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

	department := ""
	if claims, ok := r.Context().Value(middleware.UserContextKey).(*middleware.UserClaims); ok {
		department = claims.Department
	}

	// Build filter
	filter := bson.M{}

	// Status filter
	status := r.URL.Query().Get("status")
	if status != "" {
		filter["status"] = status
	}

	// Department-based category filter (RBAC)
	if department != "" && department != "general" {
		allowedCategories := mapDepartmentToCategories(department)
		if len(allowedCategories) > 0 {
			filter["category"] = bson.M{"$in": allowedCategories}
			log.Printf("[INFO] Filtering reports for department: %s, categories: %v", department, allowedCategories)
		}
	}

	// Category filter (if explicitly provided, must be within department scope)
	category := r.URL.Query().Get("category")
	if category != "" {
		if department != "" && department != "general" {
			allowedCategories := mapDepartmentToCategories(department)
			found := false
			for _, c := range allowedCategories {
				if c == category {
					found = true
					break
				}
			}
			if !found {
				response.Error(w, http.StatusForbidden, "Category not authorized for your department", "")
				return
			}
		}
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

	// Build base filter with department scope
	baseFilter := bson.M{
		"created_at": bson.M{"$gte": startDate},
	}

	department := ""
	if claims, ok := r.Context().Value(middleware.UserContextKey).(*middleware.UserClaims); ok {
		department = claims.Department
	}
	if department != "" {
		allowedCategories := mapDepartmentToCategories(department)
		if len(allowedCategories) > 0 {
			baseFilter["category"] = bson.M{"$in": allowedCategories}
			log.Printf("[INFO] Filtering analytics for department: %s, categories: %v", department, allowedCategories)
		}
	}

	// Count total reports
	totalCount, err := db.Collection("reports").CountDocuments(ctx, baseFilter)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "Failed to count reports", err.Error())
		return
	}

	// Count by status
	pendingFilter := bson.M{
		"status":     "PENDING",
		"created_at": bson.M{"$gte": startDate},
	}
	if category, ok := baseFilter["category"]; ok {
		pendingFilter["category"] = category
	}
	pendingCount, _ := db.Collection("reports").CountDocuments(ctx, pendingFilter)

	inProgressFilter := bson.M{
		"status":     "IN_PROGRESS",
		"created_at": bson.M{"$gte": startDate},
	}
	if category, ok := baseFilter["category"]; ok {
		inProgressFilter["category"] = category
	}
	inProgressCount, _ := db.Collection("reports").CountDocuments(ctx, inProgressFilter)

	completedFilter := bson.M{
		"status":     "RESOLVED",
		"created_at": bson.M{"$gte": startDate},
	}
	if category, ok := baseFilter["category"]; ok {
		completedFilter["category"] = category
	}
	completedCount, _ := db.Collection("reports").CountDocuments(ctx, completedFilter)

	// Get total upvotes
	pipeline := []bson.M{
		{
			"$match": baseFilter,
		},
		{
			"$group": bson.M{
				"_id":              nil,
				"total_upvotes":    bson.M{"$sum": "$upvotes"},
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
		if val, ok := aggregateResult[0]["total_upvotes"]; ok && val != nil {
			switch v := val.(type) {
			case int32:
				totalUpvotes = int64(v)
			case int64:
				totalUpvotes = v
			}
		}
		if val, ok := aggregateResult[0]["avg_process_time"]; ok && val != nil {
			switch v := val.(type) {
			case float64:
				avgProcessTime = v
			case int32:
				avgProcessTime = float64(v)
			case int64:
				avgProcessTime = float64(v)
			}
		}
	}

	completionRate := 0.0
	if totalCount > 0 {
		completionRate = (float64(completedCount) / float64(totalCount)) * 100
	}

	// Get category breakdown
	categoryPipeline := []bson.M{
		{
			"$match": baseFilter,
		},
		{
			"$group": bson.M{
				"_id":        "$category",
				"total":      bson.M{"$sum": 1},
				"selesai":    bson.M{"$sum": bson.M{"$cond": []interface{}{bson.M{"$eq": []interface{}{"$status", "RESOLVED"}}, 1, 0}}},
				"pending":    bson.M{"$sum": bson.M{"$cond": []interface{}{bson.M{"$eq": []interface{}{"$status", "PENDING"}}, 1, 0}}},
				"inProgress": bson.M{"$sum": bson.M{"$cond": []interface{}{bson.M{"$eq": []interface{}{"$status", "IN_PROGRESS"}}, 1, 0}}},
			},
		},
		{
			"$sort": bson.M{"total": -1},
		},
	}

	categoryCursor, err := db.Collection("reports").Aggregate(ctx, categoryPipeline)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "Failed to aggregate categories", err.Error())
		return
	}
	defer categoryCursor.Close(ctx)

	var categoryStats []bson.M
	if err = categoryCursor.All(ctx, &categoryStats); err != nil {
		response.Error(w, http.StatusInternalServerError, "Failed to read category aggregation", err.Error())
		return
	}

	// Convert category stats to frontend format
	categoryData := make([]map[string]interface{}, 0)
	for _, cat := range categoryStats {
		categoryData = append(categoryData, map[string]interface{}{
			"name":       cat["_id"],
			"total":      cat["total"],
			"selesai":    cat["selesai"],
			"pending":    cat["pending"],
			"inProgress": cat["inProgress"],
		})
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
		"categories":     categoryData,
	}

	log.Printf("[OK] Analytics generated - Total: %d, Completed: %d, Pending: %d", totalCount, completedCount, pendingCount)
	response.Success(w, http.StatusOK, "Analytics data retrieved", analytics)
}

// Admin endpoint - Get single report by ID
func adminReportDetailHandler(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Path[len("/admin/reports/"):]
	if id == "" {
		response.Error(w, http.StatusBadRequest, "Missing report ID", "")
		return
	}

	switch r.Method {
	case http.MethodGet:
		adminGetReportDetail(w, r, id)
	case http.MethodPut:
		adminUpdateReportStatus(w, r, id)
	default:
		response.Error(w, http.StatusMethodNotAllowed, "Method not allowed", "")
	}
}

func adminGetReportDetail(w http.ResponseWriter, r *http.Request, id string) {
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

	log.Printf("[OK] Admin fetched report - ID: %s", id)
	response.Success(w, http.StatusOK, "Report fetched successfully", report)
}

func adminUpdateReportStatus(w http.ResponseWriter, r *http.Request, id string) {
	var input struct {
		Status string `json:"status"`
		Notes  string `json:"notes"`
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

	log.Printf("[OK] Admin updated report status - ID: %s, Status: %s", id, input.Status)

	// Publish notification event
	go func() {
		if err := publishNotificationEvent(id, "Status Laporan Diperbarui", input.Status); err != nil {
			log.Printf("[WARN] Failed to publish notification: %v", err)
		}
	}()

	response.Success(w, http.StatusOK, "Report status updated", nil)
}

// Admin forward report to external system
func adminForwardReportHandler(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Path[len("/admin/reports/forward/"):]
	if id == "" {
		response.Error(w, http.StatusBadRequest, "Missing report ID", "")
		return
	}

	if r.Method != http.MethodPost {
		response.Error(w, http.StatusMethodNotAllowed, "Method not allowed", "")
		return
	}

	var input struct {
		ForwardTo string `json:"forwardTo"`
		Notes     string `json:"notes"`
	}

	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		response.Error(w, http.StatusBadRequest, "Invalid request payload", err.Error())
		return
	}

	if input.ForwardTo == "" {
		response.Error(w, http.StatusBadRequest, "forwardTo is required", "")
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	objID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		response.Error(w, http.StatusBadRequest, "Invalid report ID", err.Error())
		return
	}

	// Get report first
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

	department := ""
	if claims, ok := r.Context().Value(middleware.UserContextKey).(*middleware.UserClaims); ok {
		department = claims.Department
	}

	// Record forwarding in database
	forwardRecord := bson.M{
		"report_id":    objID,
		"forward_to":   input.ForwardTo,
		"forwarded_by": department,
		"notes":        input.Notes,
		"forwarded_at": time.Now(),
	}

	_, err = db.Collection("forwarded_reports").InsertOne(ctx, forwardRecord)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "Failed to forward report", err.Error())
		return
	}

	// Update original report with forward information
	update := bson.M{
		"$set": bson.M{
			"forwarded_to": input.ForwardTo,
			"forwarded_at": time.Now(),
			"updated_at":   time.Now(),
		},
		"$push": bson.M{
			"forward_history": forwardRecord,
		},
	}

	_, err = db.Collection("reports").UpdateOne(ctx, bson.M{"_id": objID}, update)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "Failed to update report", err.Error())
		return
	}

	log.Printf("[OK] Admin forwarded report - ID: %s, ForwardTo: %s", id, input.ForwardTo)

	// Publish notification event
	go func() {
		if err := publishNotificationEvent(id, "Laporan Diteruskan", "IN_PROGRESS"); err != nil {
			log.Printf("[WARN] Failed to publish notification: %v", err)
		}
	}()

	response.Success(w, http.StatusOK, "Report forwarded successfully", map[string]interface{}{
		"report_id":    id,
		"forward_to":   input.ForwardTo,
		"forwarded_at": time.Now(),
	})
}

// Admin get escalated reports (reports needing attention)
func adminEscalationHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		response.Error(w, http.StatusMethodNotAllowed, "Method not allowed", "")
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Get filter parameter
	filter := r.URL.Query().Get("filter")
	department := ""
	if claims, ok := r.Context().Value(middleware.UserContextKey).(*middleware.UserClaims); ok {
		department = claims.Department
	}

	// Build query
	query := bson.M{
		"status": bson.M{"$in": []string{"PENDING", "IN_PROGRESS"}},
	}

	// Add department-based category filter
	if department != "" {
		allowedCategories := mapDepartmentToCategories(department)
		if len(allowedCategories) > 0 {
			query["category"] = bson.M{"$in": allowedCategories}
		}
	}

	// Apply filters
	if filter == "sla-breached" {
		// Reports where SLA deadline has passed
		query["sla_deadline"] = bson.M{"$lt": time.Now()}
		query["is_escalated"] = bson.M{"$ne": true}
	} else if filter == "escalated" {
		query["is_escalated"] = true
	}

	// Fetch reports
	cursor, err := db.Collection("reports").Find(ctx, query, options.Find().SetSort(bson.M{"created_at": -1}))
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "Failed to fetch reports", err.Error())
		return
	}
	defer cursor.Close(ctx)

	var reports []map[string]interface{}
	if err := cursor.All(ctx, &reports); err != nil {
		response.Error(w, http.StatusInternalServerError, "Failed to decode reports", err.Error())
		return
	}

	// Add SLA deadline for reports that don't have it (default 48 hours from creation)
	for _, report := range reports {
		if _, hasDeadline := report["sla_deadline"]; !hasDeadline {
			createdAt, ok := report["created_at"].(primitive.DateTime)
			if ok {
				deadline := createdAt.Time().Add(48 * time.Hour)
				report["sla_deadline"] = deadline
			}
		}
	}

	log.Printf("[OK] Admin fetched escalation reports - Count: %d, Filter: %s", len(reports), filter)

	response.Success(w, http.StatusOK, "Escalation reports fetched successfully", reports)
}

// Admin escalate report to higher authority
func adminEscalateReportHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		response.Error(w, http.StatusMethodNotAllowed, "Method not allowed", "")
		return
	}

	department := ""
	if claims, ok := r.Context().Value(middleware.UserContextKey).(*middleware.UserClaims); ok {
		department = claims.Department
	}

	id := r.URL.Path[len("/admin/reports/escalate/"):]

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	objID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		response.Error(w, http.StatusBadRequest, "Invalid report ID", err.Error())
		return
	}

	// Check if report exists
	var report bson.M
	err = db.Collection("reports").FindOne(ctx, bson.M{"_id": objID}).Decode(&report)
	if err != nil {
		response.Error(w, http.StatusNotFound, "Report not found", err.Error())
		return
	}

	// Check if already escalated
	if isEscalated, ok := report["is_escalated"].(bool); ok && isEscalated {
		response.Error(w, http.StatusConflict, "Report is already escalated", "")
		return
	}

	// Update report with escalation flag
	update := bson.M{
		"$set": bson.M{
			"is_escalated": true,
			"escalated_at": time.Now(),
			"escalated_by": department,
			"updated_at":   time.Now(),
		},
	}

	_, err = db.Collection("reports").UpdateOne(ctx, bson.M{"_id": objID}, update)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "Failed to escalate report", err.Error())
		return
	}

	log.Printf("[OK] Admin escalated report - ID: %s", id)

	// Publish notification event
	go func() {
		if err := publishNotificationEvent(id, "Laporan Dieskalasi", "IN_PROGRESS"); err != nil {
			log.Printf("[WARN] Failed to publish notification: %v", err)
		}
	}()

	response.Success(w, http.StatusOK, "Report escalated successfully", map[string]interface{}{
		"report_id":    id,
		"is_escalated": true,
		"escalated_at": time.Now(),
	})
}

// uploadImageHandler handles image upload to local storage (MinIO-compatible)
func uploadImageHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		response.Error(w, http.StatusMethodNotAllowed, "Method not allowed", "")
		return
	}

	if minioClient == nil {
		response.Error(w, http.StatusServiceUnavailable, "Storage service not configured", "")
		return
	}

	// Parse multipart form (max 10MB)
	err := r.ParseMultipartForm(10 << 20)
	if err != nil {
		response.Error(w, http.StatusBadRequest, "Failed to parse form", err.Error())
		return
	}

	file, handler, err := r.FormFile("image")
	if err != nil {
		response.Error(w, http.StatusBadRequest, "No image file provided", err.Error())
		return
	}
	defer file.Close()

	// Read file into memory (max 5MB) so we can:
	// - reliably validate size
	// - detect content type
	// - upload with known content length
	data, err := io.ReadAll(io.LimitReader(file, (5<<20)+1))
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "Failed to read file", err.Error())
		return
	}
	if len(data) == 0 {
		response.Error(w, http.StatusBadRequest, "Empty file", "")
		return
	}
	if len(data) > 5<<20 {
		response.Error(w, http.StatusBadRequest, "File too large. Maximum 5MB allowed", "")
		return
	}

	// Validate file type
	contentType := http.DetectContentType(data)
	allowedTypes := map[string]string{
		"image/jpeg": ".jpg",
		"image/png":  ".png",
		"image/webp": ".webp",
	}
	ext, ok := allowedTypes[contentType]
	if !ok {
		response.Error(w, http.StatusBadRequest, "Invalid file type. Only JPEG, PNG, and WebP allowed", "")
		return
	}

	filename := fmt.Sprintf("report_%s%s", primitive.NewObjectID().Hex(), ext)
	objectName := "uploads/" + filename

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	_, err = minioClient.PutObject(
		ctx,
		minioBucket,
		objectName,
		bytes.NewReader(data),
		int64(len(data)),
		minio.PutObjectOptions{ContentType: contentType},
	)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "Failed to upload to object storage", err.Error())
		return
	}

	// Accessible via nginx gateway route: /storage/<bucket>/<object>
	fileURL := fmt.Sprintf("/storage/%s/%s", minioBucket, objectName)

	log.Printf("[OK] Image uploaded - Object: %s/%s, Size: %d bytes", minioBucket, objectName, len(data))

	response.Success(w, http.StatusOK, "Image uploaded successfully", map[string]interface{}{
		"url":      fileURL,
		"filename": filename,
		"size":     len(data),
		"type":     contentType,
		"original": handler.Filename,
	})
}

// healthCheckHandler returns service health status
func healthCheckHandler(w http.ResponseWriter, r *http.Request) {
	health := map[string]interface{}{
		"status":    "UP",
		"service":   "report-service",
		"timestamp": time.Now().Format(time.RFC3339),
	}

	// Check database connectivity
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	if err := db.Client().Ping(ctx, nil); err != nil {
		health["status"] = "DOWN"
		health["database"] = "disconnected"
		w.WriteHeader(http.StatusServiceUnavailable)
	} else {
		health["database"] = "connected"
		w.WriteHeader(http.StatusOK)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(health)
}

// metricsHandler returns basic metrics for monitoring
func metricsHandler(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Count total reports
	totalReports, _ := db.Collection("reports").CountDocuments(ctx, bson.M{})

	// Count by status
	pendingReports, _ := db.Collection("reports").CountDocuments(ctx, bson.M{"status": "PENDING"})
	inProgressReports, _ := db.Collection("reports").CountDocuments(ctx, bson.M{"status": "IN_PROGRESS"})
	resolvedReports, _ := db.Collection("reports").CountDocuments(ctx, bson.M{"status": "RESOLVED"})

	// Count anonymous reports
	anonymousReports, _ := db.Collection("reports").CountDocuments(ctx, bson.M{"is_anonymous": true})

	metrics := map[string]interface{}{
		"service":            "report-service",
		"timestamp":          time.Now().Format(time.RFC3339),
		"total_reports":      totalReports,
		"pending_reports":    pendingReports,
		"inprogress_reports": inProgressReports,
		"resolved_reports":   resolvedReports,
		"anonymous_reports":  anonymousReports,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(metrics)
}
