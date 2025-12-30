package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"sync"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
)

type NotificationEvent struct {
	ID        string    `json:"id"`
	ReportID  string    `json:"report_id"`
	Title     string    `json:"title"`
	Message   string    `json:"message"`
	Type      string    `json:"type"` // status_update, new_report, comment
	Status    string    `json:"status"`
	UserID    string    `json:"user_id"`
	CreatedAt time.Time `json:"created_at"`
}

type Client struct {
	UserID string
	Send   chan NotificationEvent
}

var (
	clients    = make(map[*Client]bool)
	broadcast  = make(chan NotificationEvent, 100)
	register   = make(chan *Client)
	unregister = make(chan *Client)
	mu         sync.RWMutex
)

func main() {
	// Build RabbitMQ URL from environment variables
	rabbitMQURL := os.Getenv("RABBITMQ_URL")
	if rabbitMQURL == "" {
		// Fallback: build URL from individual components
		host := os.Getenv("RABBITMQ_HOST")
		if host == "" {
			host = "localhost"
		}
		port := os.Getenv("RABBITMQ_PORT")
		if port == "" {
			port = "5672"
		}
		user := os.Getenv("RABBITMQ_USER")
		if user == "" {
			user = "guest"
		}
		pass := os.Getenv("RABBITMQ_PASS")
		if pass == "" {
			pass = "guest"
		}
		rabbitMQURL = fmt.Sprintf("amqp://%s:%s@%s:%s/", user, pass, host, port)
	}

	log.Printf("[INFO] Connecting to RabbitMQ at: %s", rabbitMQURL)

	// RabbitMQ connection
	conn, err := amqp.Dial(rabbitMQURL)
	if err != nil {
		log.Fatalf("[ERROR] Failed to connect to RabbitMQ: %v", err)
	}
	defer conn.Close()

	ch, err := conn.Channel()
	if err != nil {
		log.Fatalf("[ERROR] Failed to open channel: %v", err)
	}
	defer ch.Close()

	log.Println("[OK] Connected to RabbitMQ")

	// Declare exchange & queue
	err = ch.ExchangeDeclare("reports", "direct", true, false, false, false, nil)
	if err != nil {
		log.Fatalf("[ERROR] Failed to declare exchange: %v", err)
	}

	queue, err := ch.QueueDeclare("notifications", true, false, false, false, nil)
	if err != nil {
		log.Fatalf("[ERROR] Failed to declare queue: %v", err)
	}

	err = ch.QueueBind(queue.Name, "report.updated", "reports", false, nil)
	if err != nil {
		log.Fatalf("[ERROR] Failed to bind queue: %v", err)
	}

	log.Println("[INFO] Listening to notifications queue")

	// Goroutine: Consume messages from RabbitMQ
	go consumeMessages(ch, queue.Name)

	// Goroutine: Handle client connections & broadcasting
	go handleClients()

	// HTTP Server
	http.HandleFunc("/notifications/subscribe", subscribeHandler)
	http.HandleFunc("/health", healthHandler)
	http.HandleFunc("/metrics", metricsHandler)

	port := os.Getenv("NOTIFICATION_PORT")
	if port == "" {
		port = "8084"
	}

	log.Printf("[INFO] Notification Service running on port :%s", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatalf("[ERROR] Server failed: %v", err)
	}
}

// Consume messages from RabbitMQ
func consumeMessages(ch *amqp.Channel, queueName string) {
	msgs, err := ch.Consume(queueName, "", true, false, false, false, nil)
	if err != nil {
		log.Fatalf("[ERROR] Failed to register consumer: %v", err)
	}

	for d := range msgs {
		var event NotificationEvent
		if err := json.Unmarshal(d.Body, &event); err != nil {
			log.Printf("[WARN] Failed to parse notification: %v", err)
			continue
		}

		log.Printf("[OK] Notification received - Report: %s, Status: %s", event.ReportID, event.Status)
		broadcast <- event
	}
}

// Handle client connections and broadcasting
func handleClients() {
	for {
		select {
		case client := <-register:
			mu.Lock()
			clients[client] = true
			mu.Unlock()
			log.Printf("[INFO] Client registered - UserID: %s (Total clients: %d)", client.UserID, len(clients))

		case client := <-unregister:
			mu.Lock()
			if _, ok := clients[client]; ok {
				delete(clients, client)
				close(client.Send)
			}
			mu.Unlock()
			log.Printf("[INFO] Client unregistered - UserID: %s (Total clients: %d)", client.UserID, len(clients))

		case event := <-broadcast:
			mu.RLock()
			for client := range clients {
				// Send to all connected clients (in production, filter by UserID)
				select {
				case client.Send <- event:
				default:
					// Client's send channel is full, skip
				}
			}
			mu.RUnlock()
		}
	}
}

// SSE Handler for client subscriptions
func subscribeHandler(w http.ResponseWriter, r *http.Request) {
	// Get userID from query or header
	userID := r.URL.Query().Get("user_id")
	if userID == "" {
		http.Error(w, "user_id is required", http.StatusBadRequest)
		return
	}

	// Set SSE headers
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	// Create client
	client := &Client{
		UserID: userID,
		Send:   make(chan NotificationEvent, 10),
	}

	register <- client
	defer func() {
		unregister <- client
	}()

	// Send initial connection message
	fmt.Fprintf(w, "data: %s\n\n", `{"type":"connected","message":"Connection established"}`)
	w.(http.Flusher).Flush()

	// Send notifications to client
	for event := range client.Send {
		data, _ := json.Marshal(event)
		fmt.Fprintf(w, "data: %s\n\n", string(data))
		w.(http.Flusher).Flush()
	}
}

// Health check endpoint
func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	mu.RLock()
	connectedClients := len(clients)
	mu.RUnlock()

	health := map[string]interface{}{
		"status":            "UP",
		"service":           "notification-service",
		"connected_clients": connectedClients,
	}

	json.NewEncoder(w).Encode(health)
}

// Metrics handler
func metricsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	mu.RLock()
	connectedClients := len(clients)
	mu.RUnlock()

	metrics := map[string]interface{}{
		"service":           "notification-service",
		"connected_clients": connectedClients,
		"broadcast_queue":   len(broadcast),
	}

	json.NewEncoder(w).Encode(metrics)
}
