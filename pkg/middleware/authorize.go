package middleware

import (
	"net/http"

	"citizen-reporting-system/pkg/response"
)

func RequireRole(allowedRoles ...string) func(http.Handler) http.Handler {
	allowed := make(map[string]bool, len(allowedRoles))
	for _, r := range allowedRoles {
		allowed[r] = true
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims, ok := r.Context().Value(UserContextKey).(*UserClaims)
			if !ok {
				response.Error(w, http.StatusUnauthorized, "Unauthorized", "")
				return
			}

			if !allowed[claims.Role] {
				response.Error(w, http.StatusForbidden, "Forbidden", "Insufficient role")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

func RequireAccessRole(accessRole string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims, ok := r.Context().Value(UserContextKey).(*UserClaims)
			if !ok {
				response.Error(w, http.StatusUnauthorized, "Unauthorized", "")
				return
			}

			if claims.AccessRole != accessRole {
				response.Error(w, http.StatusForbidden, "Forbidden", "Insufficient access role")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
