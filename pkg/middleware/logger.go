package middleware

import (
	"encoding/json"
	"log"
	"net/http"
	"time"
)

type LogEntry struct {
	Timestamp string `json:"timestamp"`
	TraceID   string `json:"trace_id,omitempty"`
	Level     string `json:"level"`
	Message   string `json:"message"`
	Method    string `json:"method,omitempty"`
	Path      string `json:"path,omitempty"`
	Status    int    `json:"status,omitempty"`
	Duration  string `json:"duration,omitempty"`
	Error     string `json:"error,omitempty"`
}

func LoggerMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		traceID := GetTraceID(r)

		rw := &responseWriter{ResponseWriter: w, statusCode: http.StatusOK}

		next.ServeHTTP(rw, r)

		duration := time.Since(start)

		LogRequest(traceID, r.Method, r.URL.Path, rw.statusCode, duration)
	})
}

type responseWriter struct {
	http.ResponseWriter
	statusCode int
	written    bool
}

func (rw *responseWriter) WriteHeader(code int) {
	if !rw.written {
		rw.statusCode = code
		rw.written = true
		rw.ResponseWriter.WriteHeader(code)
	}
}

func (rw *responseWriter) Write(b []byte) (int, error) {
	if !rw.written {
		rw.WriteHeader(http.StatusOK)
	}
	return rw.ResponseWriter.Write(b)
}

func LogRequest(traceID, method, path string, statusCode int, duration time.Duration) {
	entry := LogEntry{
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		TraceID:   traceID,
		Level:     "INFO",
		Message:   "HTTP Request",
		Method:    method,
		Path:      path,
		Status:    statusCode,
		Duration:  duration.String(),
	}

	logJSON(entry)
}

func LogError(traceID, message string, err error) {
	entry := LogEntry{
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		TraceID:   traceID,
		Level:     "ERROR",
		Message:   message,
	}

	if err != nil {
		entry.Error = err.Error()
	}

	logJSON(entry)
}

func LogInfo(traceID, message string) {
	entry := LogEntry{
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		TraceID:   traceID,
		Level:     "INFO",
		Message:   message,
	}

	logJSON(entry)
}

func logJSON(entry LogEntry) {
	jsonBytes, err := json.Marshal(entry)
	if err != nil {
		log.Printf("Error marshaling log entry: %v", err)
		return
	}
	log.Println(string(jsonBytes))
}
