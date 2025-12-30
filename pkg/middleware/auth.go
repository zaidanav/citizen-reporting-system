package middleware

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"strings"

	"citizen-reporting-system/pkg/response"

	"github.com/golang-jwt/jwt/v5"
)

type contextKey string

const (
	UserContextKey contextKey = "user"
)

var jwtSecret = []byte("SUPER_SECRET_KEY_CHANGE_ME")

func getJWTSecret() []byte {
	if v := strings.TrimSpace(os.Getenv("JWT_SECRET")); v != "" {
		return []byte(v)
	}
	return jwtSecret
}

type UserClaims struct {
	UserID     string `json:"user_id"`
	Name       string `json:"name"`
	Email      string `json:"email"`
	Role       string `json:"role"`
	Department string `json:"department"`
	AccessRole string `json:"access_role"`
	jwt.RegisteredClaims
}

func AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
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
			return getJWTSecret(), nil
		})

		if err != nil {
			response.Error(w, http.StatusUnauthorized, "Invalid or expired token", err.Error())
			return
		}

		if claims, ok := token.Claims.(*UserClaims); ok && token.Valid {
			ctx := context.WithValue(r.Context(), UserContextKey, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		} else {
			response.Error(w, http.StatusUnauthorized, "Invalid token claims", "")
		}
	})
}

// OptionalAuthMiddleware allows requests without auth, but parses token if present
func OptionalAuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		
		// If no auth header, continue without user context
		if authHeader == "" {
			next.ServeHTTP(w, r)
			return
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
		if tokenString == authHeader {
			// Invalid format, but allow request to continue
			next.ServeHTTP(w, r)
			return
		}

		token, err := jwt.ParseWithClaims(tokenString, &UserClaims{}, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return getJWTSecret(), nil
		})

		// If token is valid, add claims to context
		if err == nil {
			if claims, ok := token.Claims.(*UserClaims); ok && token.Valid {
				ctx := context.WithValue(r.Context(), UserContextKey, claims)
				next.ServeHTTP(w, r.WithContext(ctx))
				return
			}
		}

		// Token invalid or expired, continue without user context
		next.ServeHTTP(w, r)
	})
}

