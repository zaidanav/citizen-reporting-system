package middleware

import (
	"context"
	"net/http"

	"github.com/google/uuid"
)

const traceIDContextKey = "trace_id"

// TraceMiddleware automatically generates or extracts trace IDs from requests
func TraceMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		traceID := r.Header.Get("X-Trace-Id")
		
		if traceID == "" {
			traceID = uuid.New().String()
		}
		
		w.Header().Set("X-Trace-Id", traceID)
		
		ctx := context.WithValue(r.Context(), traceIDContextKey, traceID)
		
		// Continue with the request
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// retrieves the trace ID from the request context
func GetTraceID(r *http.Request) string {
	if traceID, ok := r.Context().Value(traceIDContextKey).(string); ok {
		return traceID
	}
	return ""
}

// adds the trace ID to an outgoing HTTP request
func PropagateTraceID(req *http.Request, traceID string) {
	if traceID != "" {
		req.Header.Set("X-Trace-Id", traceID)
	}
}
