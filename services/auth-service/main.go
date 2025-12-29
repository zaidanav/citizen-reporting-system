package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"

	"citizen-reporting-system/pkg/database"
	"citizen-reporting-system/pkg/middleware"
	"citizen-reporting-system/pkg/response"
	"citizen-reporting-system/services/auth-service/models"
	"citizen-reporting-system/services/auth-service/utils"

	"gorm.io/gorm"
)

var db *gorm.DB

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

	http.HandleFunc("/api/auth/me", middleware.LoggerMiddleware(middleware.AuthMiddleware(meHandler)).ServeHTTP)

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
		response.Error(w, http.StatusBadRequest, "Invalid request payload", err.Error())
		return
	}

	if input.Email == "" || input.Password == "" || input.Name == "" {
		response.Error(w, http.StatusBadRequest, "Email, Password, and Name are required", "")
		return
	}

	var existingUser models.User
	if result := db.Where("email = ?", input.Email).First(&existingUser); result.Error == nil {
		response.Error(w, http.StatusConflict, "Email already registered", "")
		return
	}

	hashedPassword, err := utils.HashPassword(input.Password)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "Failed to hash password", err.Error())
		return
	}

	var nikPtr *string
	if input.NIK != "" {
		nikPtr = &input.NIK
	}

	newUser := models.User{
			Email:      input.Email,
			Password:   hashedPassword,
			Name:       input.Name,
			NIK:        nikPtr,
			Phone:      input.Phone,
			Role:       "citizen",
			Department: "general",

	response.Success(w, http.StatusCreated, "User registered successfully", newUser)
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
		response.Error(w, http.StatusBadRequest, "Invalid request payload", err.Error())
		return
	}

	var user models.User
	if err := db.Where("email = ?", input.Email).First(&user).Error; err != nil {
		response.Error(w, http.StatusUnauthorized, "Invalid email or password", "")
		return
	}

	if !utils.CheckPasswordHash(input.Password, user.Password) {
		response.Error(w, http.StatusUnauthorized, "Invalid email or password", "")
		return
	}

	token, err := utils.GenerateJWT(user.ID, user.Email, user.Role, user.Department)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "Failed to generate token", err.Error())
		return
	}

	response.Success(w, http.StatusOK, "Login successful", map[string]interface{}{
		"token":      token,
		"name":       user.Name,
		"role":       user.Role,
		"department": user.Department,
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
