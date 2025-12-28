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
				continue
			}

			// Anonymization (Privacy Protection)
			if report.IsAnonymous {
				report.Reporter = "ANONYMOUS"
				report.ReporterID = "***HIDDEN***"
				log.Println("🔒 Anonymous Mode Detected: Identity hidden.")
			}

			// Routing to Department (Business Logic)
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

			log.Println("---------------------------------------------------")
		}
	}()

	log.Printf("⏳ Waiting for reports in queue '%s'. Press CTRL+C to exit.", queueName)
	<-forever
}

// Forwarding to Department
func sendToDepartment(r ReportEvent, departmentName string) {
	log.Printf("🚀 [ROUTING] Report '%s' forwarded to: >> %s <<", r.Title, departmentName)
	log.Printf("Detail: %s (By: %s)", r.Description, r.Reporter)
}