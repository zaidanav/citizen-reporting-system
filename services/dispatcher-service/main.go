package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/rand"
	"net/http"
	"os"
	"strings"
	"time"

	"citizen-reporting-system/pkg/middleware"
	"citizen-reporting-system/pkg/queue"

	amqp "github.com/rabbitmq/amqp091-go"
)

type ReportEvent struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Category    string    `json:"category"`
	IsAnonymous bool      `json:"is_anonymous"`
	ReporterID  string    `json:"reporter_id"`
	Reporter    string    `json:"reporter_name"`
	CreatedAt   time.Time `json:"created_at"`
}

type ForwardRequest struct {
	ForwardTo   string      `json:"forwardTo"`
	Notes       string      `json:"notes"`
	ForwardedBy string      `json:"forwardedBy"`
	ForwardedAt time.Time   `json:"forwardedAt"`
	Report      ReportEvent `json:"report"`
}

func main() {
	httpPort := os.Getenv("DISPATCHER_HTTP_PORT")
	if httpPort == "" {
		httpPort = "8085"
	}

	middleware.RegisterMetrics()
	log.Println("Prometheus metrics initialized")

	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"UP"}`))
	})
	mux.HandleFunc("/external/forward", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
		if err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		var req ForwardRequest
		if err := json.Unmarshal(body, &req); err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "invalid json"})
			return
		}

		if strings.TrimSpace(req.ForwardTo) == "" || strings.TrimSpace(req.Report.ID) == "" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "forwardTo and report.id are required"})
			return
		}

		report := req.Report
		if report.IsAnonymous {
			report.Reporter = "ANONYMOUS"
			report.ReporterID = "***HIDDEN***"
		}

		err = sendToDepartment(report, req.ForwardTo)
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadGateway)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"status":     "ACCEPTED",
			"forwardTo":  req.ForwardTo,
			"reportId":   req.Report.ID,
			"receivedAt": time.Now().Format(time.RFC3339),
		})
	})

	mux.Handle("/metrics", middleware.GetMetricsHandler())

	handler := middleware.TraceMiddleware(
		middleware.MetricsMiddleware(
			middleware.LoggerMiddleware(mux),
		),
	)

	go func() {
		addr := ":" + httpPort
		log.Printf("✅ Dispatcher HTTP Receiver running on %s", addr)
		log.Println("🔍 Distributed tracing enabled (X-Trace-Id)")
		if err := http.ListenAndServe(addr, handler); err != nil {
			log.Printf("⚠️ Dispatcher HTTP server stopped: %v", err)
		}
	}()

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
		log.Fatalf("❌ Failed to connect to RabbitMQ: %v", err)
	}
	defer conn.Close()
	defer ch.Close()

	log.Println("✅ Dispatcher Service Connected to RabbitMQ!")

	queueName := "report_queue"
	msgs, err := queue.ConsumeMessages(ch, queueName)
	if err != nil {
		log.Fatalf("❌ Failed to consume queue: %v", err)
	}

	forever := make(chan bool)

	go func() {
		for d := range msgs {
			log.Printf("📥 Received New Message: %s", d.Body)

			var report ReportEvent
			err := json.Unmarshal(d.Body, &report)
			if err != nil {
				log.Printf("⚠️ Error parsing JSON: %v", err)
				moveToDLQ(ch, d.Body, "json_parse_error")
				continue
			}

			if report.IsAnonymous {
				report.Reporter = "ANONYMOUS"
				report.ReporterID = "***HIDDEN***"
				log.Println("🔒 Anonymous Mode Detected: Identity hidden.")
			}

			var routeErr error
			switch report.Category {
			case "Sampah":
				routeErr = sendToDepartment(report, "DINAS KEBERSIHAN")
			case "Jalan":
				routeErr = sendToDepartment(report, "DINAS PU (PEKERJAAN UMUM)")
			case "Keamanan":
				routeErr = sendToDepartment(report, "KEPOLISIAN / SATPOL PP")
			default:
				routeErr = sendToDepartment(report, "PEMDA PUSAT (KATEGORI UMUM)")
			}

			if routeErr != nil {
				log.Printf("❌ Routing failed: %v", routeErr)
				moveToDLQ(ch, d.Body, routeErr.Error())
				continue
			}


			log.Println("---------------------------------------------------")
		}
	}()

	log.Printf("⏳ Waiting for reports in queue '%s'. Press CTRL+C to exit.", queueName)
	<-forever
}

func sendToDepartment(r ReportEvent, departmentName string) error {
	log.Printf("🚀 [ROUTING] Forwarding report '%s' to: >> %s <<", r.Title, departmentName)

	time.Sleep(time.Duration(rand.Intn(500)+200) * time.Millisecond)

	if strings.Contains(strings.ToUpper(r.Title), "FAIL") {
		return fmt.Errorf("external API timeout/error for %s", departmentName)
	}

	log.Printf("✅ Success: Report received by %s", departmentName)
	return nil
}

func updateReportStatus(id, status, baseURL string) {
	url := fmt.Sprintf("%s/internal/updates", baseURL)
	payload := map[string]string{"id": id, "status": status}
	jsonPayload, _ := json.Marshal(payload)

	resp, err := http.Post(url, "application/json", bytes.NewBuffer(jsonPayload))
	if err != nil {
		log.Printf("⚠️ Failed to update status: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		log.Printf("⚠️ Update status failed with code: %d", resp.StatusCode)
	} else {
		log.Printf("✅ Report %s status updated to %s", id, status)
	}
}

func moveToDLQ(ch *amqp.Channel, body []byte, reason string) {
	dlqName := "report_dlq"
	_, err := ch.QueueDeclare(
		dlqName,
		true,
		false,
		false,
		false,
		nil,
	)
	if err != nil {
		log.Printf("❌ Failed to declare DLQ: %v", err)
		return
	}

	err = ch.Publish(
		"",
		dlqName,
		false,
		false,
		amqp.Publishing{
			ContentType: "application/json",
			Body:        body,
			Headers: amqp.Table{
				"x-exception-message": reason,
				"x-failed-at":         time.Now().Format(time.RFC3339),
			},
		})
	if err != nil {
		log.Printf("❌ Failed to publish to DLQ: %v", err)
	} else {
		log.Printf("⚠️ Message moved to DLQ: %s (Reason: %s)", dlqName, reason)
	}
}
