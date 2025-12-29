package middleware

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"citizen-reporting-system/pkg/response"

	"github.com/golang-jwt/jwt/v5"
)

type contextKey string

const (
	UserContextKey contextKey = "user"
)

var jwtSecret = []byte("SUPER_SECRET_KEY_CHANGE_ME")

type UserClaims struct {
	UserID string `json:"user_id"`
	Email  string `json:"email"`
	Role   string `json:"role"`
	jwt.RegisteredClaims
}

func AuthMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			response.Error(w, http.StatusUnauthorized, "Missing Authorization header", "")
			return
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
		if tokenString == authHeader {
			response.Error(w, http.StatusUnauthorized, "Invalid token format", "Format must be Bearer <token>")
			return
		}

		token, err := jwt.ParseWithClaims(tokenString, &UserClaims{}, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return jwtSecret, nil
		})

		if err != nil {
			response.Error(w, http.StatusUnauthorized, "Invalid or expired token", err.Error())
			return
		}

		if claims, ok := token.Claims.(*UserClaims); ok && token.Valid {
			ctx := context.WithValue(r.Context(), UserContextKey, claims)
			next(w, r.WithContext(ctx))
		} else {
			response.Error(w, http.StatusUnauthorized, "Invalid token claims", "")
		}
	}
}
