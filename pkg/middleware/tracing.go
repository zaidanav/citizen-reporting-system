package middleware

import (
	"context"
	"net/http"

	"github.com/google/uuid"
)

const traceIDContextKey = "trace_id"

func TraceMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		traceID := r.Header.Get("X-Trace-Id")

		if traceID == "" {
			traceID = uuid.New().String()
		}

		w.Header().Set("X-Trace-Id", traceID)

		ctx := context.WithValue(r.Context(), traceIDContextKey, traceID)

		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func GetTraceID(r *http.Request) string {
	if traceID, ok := r.Context().Value(traceIDContextKey).(string); ok {
		return traceID
	}
	return ""
}

func PropagateTraceID(req *http.Request, traceID string) {
	if traceID != "" {
		req.Header.Set("X-Trace-Id", traceID)
	}
}
