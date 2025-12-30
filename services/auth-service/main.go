package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"regexp"
	"strings"

	"citizen-reporting-system/pkg/database"
	"citizen-reporting-system/pkg/middleware"
	"citizen-reporting-system/pkg/response"
	"citizen-reporting-system/services/auth-service/models"
	"citizen-reporting-system/services/auth-service/utils"

	"gorm.io/gorm"
)

var db *gorm.DB

var emailRegex = regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)

// isValidEmail validates email format
func isValidEmail(email string) bool {
	return emailRegex.MatchString(email)
}

// isValidPassword checks password strength
func isValidPassword(password string) (bool, string) {
	if len(password) < 8 {
		return false, "Password must be at least 8 characters"
	}
	if len(password) > 100 {
		return false, "Password too long"
	}
	return true, ""
}

// isValidNIK validates Indonesian NIK format (16 digits)
func isValidNIK(nik string) bool {
	if len(nik) != 16 {
		return false
	}
	for _, c := range nik {
		if c < '0' || c > '9' {
			return false
		}
	}
	return true
}

func main() {
	dsn := fmt.Sprintf(
		"host=%s user=%s password=%s dbname=%s port=%s sslmode=disable TimeZone=UTC",
		os.Getenv("POSTGRES_HOST"),
		os.Getenv("POSTGRES_USER"),
		os.Getenv("POSTGRES_PASSWORD"),
		os.Getenv("POSTGRES_DB"),
		os.Getenv("POSTGRES_PORT"),
	)

	if os.Getenv("POSTGRES_HOST") == "" {
		dsn = "host=localhost user=admin password=password dbname=auth_db port=5434 sslmode=disable TimeZone=UTC"
	}

	var err error
	db, err = database.ConnectPostgres(dsn)
	if err != nil {
		log.Fatalf("❌ Failed to connect to database: %v", err)
	}

	log.Println("🔄 Running Auto Migration...")
	err = db.AutoMigrate(&models.User{})
	if err != nil {
		log.Fatalf("❌ Migration failed: %v", err)
	}
	log.Println("✅ Migration success!")

	http.HandleFunc("/api/auth/register", middleware.LoggerMiddleware(http.HandlerFunc(registerHandler)).ServeHTTP)
	http.HandleFunc("/api/auth/login", middleware.LoggerMiddleware(http.HandlerFunc(loginHandler)).ServeHTTP)

	http.HandleFunc("/api/auth/me", middleware.LoggerMiddleware(middleware.AuthMiddleware(http.HandlerFunc(meHandler))).ServeHTTP)

	// Health check and metrics
	http.HandleFunc("/health", healthCheckHandler)
	http.HandleFunc("/metrics", metricsHandler)

	port := ":8081"
	log.Printf("🚀 Auth Service running on port %s", port)
	if err := http.ListenAndServe(port, nil); err != nil {
		log.Fatalf("❌ Server failed: %v", err)
	}
}

func registerHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		response.Error(w, http.StatusMethodNotAllowed, "Method not allowed", "")
		return
	}

	var input struct {
		Email    string `json:"email"`
		Password string `json:"password"`
		Name     string `json:"name"`
		NIK      string `json:"nik"`
		Phone    string `json:"phone"`
	}

	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		log.Printf("[WARN] Invalid request format")
		response.Error(w, http.StatusBadRequest, "Invalid request payload", "")
		return
	}

	// Validate required fields
	if input.Email == "" || input.Password == "" || input.Name == "" {
		response.Error(w, http.StatusBadRequest, "Email, Password, and Name are required", "")
		return
	}

	// Validate email format
	if !isValidEmail(input.Email) {
		response.Error(w, http.StatusBadRequest, "Invalid email format", "")
		return
	}

	// Validate password strength
	if valid, msg := isValidPassword(input.Password); !valid {
		response.Error(w, http.StatusBadRequest, msg, "")
		return
	}

	// Validate name length
	if len(strings.TrimSpace(input.Name)) < 3 {
		response.Error(w, http.StatusBadRequest, "Name must be at least 3 characters", "")
		return
	}

	// Validate NIK if provided
	if input.NIK != "" && !isValidNIK(input.NIK) {
		response.Error(w, http.StatusBadRequest, "NIK must be 16 digits", "")
		return
	}

	var existingUser models.User
	if result := db.Where("email = ?", input.Email).First(&existingUser); result.Error == nil {
		log.Printf("[WARN] Registration attempt with existing email")
		response.Error(w, http.StatusConflict, "Email already registered", "")
		return
	}

	hashedPassword, err := utils.HashPassword(input.Password)
	if err != nil {
		log.Printf("[ERROR] Failed to hash password: %v", err)
		response.Error(w, http.StatusInternalServerError, "Failed to process registration", "")
		return
	}

	var nikPtr *string
	if input.NIK != "" {
		nikPtr = &input.NIK
	}

	newUser := models.User{
		Email:      input.Email,
		Password:   hashedPassword,
		Name:       strings.TrimSpace(input.Name),
		NIK:        nikPtr,
		Phone:      input.Phone,
		Role:       "citizen",
		AccessRole: "operational",
		Department: "general",
	}

	// Save user to database
	if err := db.Create(&newUser).Error; err != nil {
		log.Printf("[ERROR] Failed to save user to database: %v", err)
		response.Error(w, http.StatusInternalServerError, "Failed to save user", "")
		return
	}

	log.Printf("[OK] User registered - ID: %s", newUser.ID)

	token, err := utils.GenerateJWT(newUser.ID, newUser.Email, newUser.Name, newUser.Role, newUser.Department, newUser.AccessRole)
	if err != nil {
		log.Printf("[ERROR] Failed to generate JWT for user id: %s", newUser.ID)
		response.Error(w, http.StatusInternalServerError, "Failed to generate token", "")
		return
	}

	response.Success(w, http.StatusCreated, "User registered successfully", map[string]interface{}{
		"id":          newUser.ID,
		"token":       token,
		"name":        newUser.Name,
		"role":        newUser.Role,
		"access_role": newUser.AccessRole,
		"department":  newUser.Department,
	})
}
func loginHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		response.Error(w, http.StatusMethodNotAllowed, "Method not allowed", "")
		return
	}

	var input struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}

	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		log.Printf("[WARN] Invalid login request format")
		response.Error(w, http.StatusBadRequest, "Invalid request payload", "")
		return
	}

	if input.Email == "" || input.Password == "" {
		response.Error(w, http.StatusBadRequest, "Email and Password are required", "")
		return
	}

	var user models.User
	if err := db.Where("email = ?", input.Email).First(&user).Error; err != nil {
		log.Printf("[WARN] Failed login attempt")
		response.Error(w, http.StatusUnauthorized, "Invalid email or password", "")
		return
	}

	if !utils.CheckPasswordHash(input.Password, user.Password) {
		log.Printf("[WARN] Invalid password attempt")
		response.Error(w, http.StatusUnauthorized, "Invalid email or password", "")
		return
	}

	token, err := utils.GenerateJWT(user.ID, user.Email, user.Name, user.Role, user.Department, user.AccessRole)
	if err != nil {
		log.Printf("[ERROR] Failed to generate JWT for user id: %s", user.ID)
		response.Error(w, http.StatusInternalServerError, "Failed to generate token", "")
		return
	}

	log.Printf("[OK] User logged in - ID: %s, Role: %s, Department: %s", user.ID, user.Role, user.Department)

	response.Success(w, http.StatusOK, "Login successful", map[string]interface{}{
		"id":          user.ID,
		"token":       token,
		"name":        user.Name,
		"role":        user.Role,
		"access_role": user.AccessRole,
		"department":  user.Department,
	})
}

func meHandler(w http.ResponseWriter, r *http.Request) {
	claims, ok := r.Context().Value(middleware.UserContextKey).(*middleware.UserClaims)
	if !ok {
		response.Error(w, http.StatusInternalServerError, "Failed to retrieve user context", "")
		return
	}

	var user models.User
	if err := db.First(&user, "id = ?", claims.UserID).Error; err != nil {
		response.Error(w, http.StatusNotFound, "User not found", "")
		return
	}

	response.Success(w, http.StatusOK, "User profile fetched", user)
}

// healthCheckHandler returns service health status
func healthCheckHandler(w http.ResponseWriter, r *http.Request) {
	health := map[string]interface{}{
		"status":  "UP",
		"service": "auth-service",
	}

	// Check database connectivity
	sqlDB, err := db.DB()
	if err != nil || sqlDB.Ping() != nil {
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
	var totalUsers int64
	db.Model(&models.User{}).Count(&totalUsers)

	var citizenCount int64
	db.Model(&models.User{}).Where("role = ?", "citizen").Count(&citizenCount)

	var adminCount int64
	db.Model(&models.User{}).Where("role = ?", "admin").Count(&adminCount)

	metrics := map[string]interface{}{
		"service":       "auth-service",
		"total_users":   totalUsers,
		"citizen_count": citizenCount,
		"admin_count":   adminCount,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(metrics)
}
