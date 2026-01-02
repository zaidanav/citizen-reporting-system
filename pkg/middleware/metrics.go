package middleware

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	// HTTP request counter by method, path, and status
	httpRequestsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "http_requests_total",
			Help: "Total number of HTTP requests by method, path, and status code",
		},
		[]string{"method", "path", "status"},
	)

	// HTTP request duration histogram
	httpRequestDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "http_request_duration_seconds",
			Help:    "HTTP request duration in seconds",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"method", "path", "status"},
	)

	// In-flight requests gauge
	httpRequestsInProgress = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name: "http_requests_in_progress",
			Help: "Current number of HTTP requests being processed",
		},
	)

	// Service uptime
	serviceUptime = prometheus.NewCounter(
		prometheus.CounterOpts{
			Name: "service_uptime_seconds",
			Help: "Service uptime in seconds",
		},
	)

	metricsRegistered = false
)

// RegisterMetrics registers Prometheus metrics (call once at startup)
func RegisterMetrics() {
	if !metricsRegistered {
		prometheus.MustRegister(httpRequestsTotal)
		prometheus.MustRegister(httpRequestDuration)
		prometheus.MustRegister(httpRequestsInProgress)
		prometheus.MustRegister(serviceUptime)
		metricsRegistered = true

		// Start uptime counter
		go func() {
			ticker := time.NewTicker(1 * time.Second)
			defer ticker.Stop()
			for range ticker.C {
				serviceUptime.Inc()
			}
		}()
	}
}

// normalizePath for metrics
func normalizePath(path string) string {
	parts := strings.Split(path, "/")
	for i, part := range parts {
		if len(part) > 20 || (len(part) > 0 && part[0] >= '0' && part[0] <= '9') {
			parts[i] = ":id"
		}
	}
	normalized := strings.Join(parts, "/")
	
	if len(normalized) > 100 {
		normalized = normalized[:100]
	}
	return normalized
}

// MetricsMiddleware collects Prometheus metrics for HTTP requests
func MetricsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Skip metrics collection for the metrics endpoint itself
		if r.URL.Path == "/metrics" {
			next.ServeHTTP(w, r)
			return
		}

		start := time.Now()
		httpRequestsInProgress.Inc()
		defer httpRequestsInProgress.Dec()

		// Wrap response writer to capture status code (use logger's responseWriter)
		rw := &responseWriter{
			ResponseWriter: w,
			statusCode:     http.StatusOK,
		}

		// Process request
		next.ServeHTTP(rw, r)

		// Record metrics
		duration := time.Since(start).Seconds()
		path := normalizePath(r.URL.Path)
		status := strconv.Itoa(rw.statusCode)

		httpRequestsTotal.WithLabelValues(r.Method, path, status).Inc()
		httpRequestDuration.WithLabelValues(r.Method, path, status).Observe(duration)
	})
}

// GetMetricsHandler returns the Prometheus HTTP handler
func GetMetricsHandler() http.Handler {
	return promhttp.Handler()
}
