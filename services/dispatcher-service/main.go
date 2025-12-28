package main

import (
	"encoding/json"
	"log"
	"time"

	"citizen-reporting-system/pkg/queue"
)

type ReportEvent struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Category    string    `json:"category"`      // Sampah, Jalan, Keamanan
	IsAnonymous bool      `json:"is_anonymous"`  // Anonim or Not
	ReporterID  string    `json:"reporter_id"`   // NIK/User ID
	Reporter    string    `json:"reporter_name"` // Nama Pe-Report
	CreatedAt   time.Time `json:"created_at"`
}

func main() {
	// Connect to RabbitMQ
	amqpURI := "amqp://guest:guest@localhost:5672/"
	conn, ch, err := queue.ConnectRabbitMQ(amqpURI)
	if err != nil {
		log.Fatalf("❌ Failed to connect to RabbitMQ: %v", err)
	}
	defer conn.Close()
	defer ch.Close()

	log.Println("✅ Dispatcher Service Connected to RabbitMQ!")

	// Listen to Report Queue
	queueName := "report_queue"
	msgs, err := queue.ConsumeMessages(ch, queueName)
	if err != nil {
		log.Fatalf("❌ Failed to consume queue: %v", err)
	}

	// Infinite loop to process messages
	forever := make(chan bool)

	go func() {
		for d := range msgs {
			log.Printf("📥 Received New Message: %s", d.Body)

			// Parse JSON
			var report ReportEvent
			err := json.Unmarshal(d.Body, &report)
			if err != nil {
				log.Printf("⚠️ Error parsing JSON: %v", err)
				// TODO: Implement Dead Letter Queue (DLQ) strategy
				// If JSON format violates standards, move message to 'report_dlq'
				// so it doesn't block the queue.
				continue
			}

			// Anonymization (Privacy Protection)
			if report.IsAnonymous {
				report.Reporter = "ANONYMOUS"
				report.ReporterID = "***HIDDEN***"
				log.Println("🔒 Anonymous Mode Detected: Identity hidden.")
			}

			// Routing to Department (Business Logic)
			// TODO: Validate Required Fields
			// Ensure 'Category' and 'Description' match the contract
			switch report.Category {
			case "Sampah":
				sendToDepartment(report, "DINAS KEBERSIHAN")
			case "Jalan":
				sendToDepartment(report, "DINAS PU (PEKERJAAN UMUM)")
			case "Keamanan":
				sendToDepartment(report, "KEPOLISIAN / SATPOL PP")
			default:
				sendToDepartment(report, "PEMDA PUSAT (KATEGORI UMUM)")
			}
			
			// TODO: IMPLEMENT - Notification Trigger
			// Call Notification Service (via RabbitMQ/HTTP) to alert the user:
			// "Laporan Anda sedang diproses oleh [Nama Dinas]"
			
			// TODO: IMPLEMENT - Status Update
			// Call Report Service API (PUT /reports/{id}/status)
			// Update status from 'PENDING' to 'IN_PROGRESS' in Postgres.

			log.Println("---------------------------------------------------")
		}
	}()

	log.Printf("⏳ Waiting for reports in queue '%s'. Press CTRL+C to exit.", queueName)
	<-forever
}

// Forwarding to Department
func sendToDepartment(r ReportEvent, departmentName string) {
	// TODO: IMPLEMENT - Circuit Breaker / Retry Logic
	// TODO: IMPLEMENT - External API Call
	log.Printf("🚀 [ROUTING] Report '%s' forwarded to: >> %s <<", r.Title, departmentName)
	log.Printf("Detail: %s (By: %s)", r.Description, r.Reporter)
}