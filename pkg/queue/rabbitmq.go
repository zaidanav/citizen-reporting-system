package queue

import (
	"fmt"
	amqp "github.com/rabbitmq/amqp091-go"
)

// ConnectRabbitMQ
func ConnectRabbitMQ(uri string) (*amqp.Connection, *amqp.Channel, error) {
	conn, err := amqp.Dial(uri)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to connect to rabbitmq: %w", err)
	}

	ch, err := conn.Channel()
	if err != nil {
		return nil, nil, fmt.Errorf("failed to open channel: %w", err)
	}

	return conn, ch, nil
}

// ConsumeMessages
func ConsumeMessages(ch *amqp.Channel, queueName string) (<-chan amqp.Delivery, error) {
	// Declare Queue
	_, err := ch.QueueDeclare(
		queueName, // name
		true,      // durable (message safety if restart)
		false,     // delete when unused
		false,     // exclusive
		false,     // no-wait
		nil,       // arguments
	)
	if err != nil {
		return nil, fmt.Errorf("failed to declare queue: %w", err)
	}

	// Start Consume
	msgs, err := ch.Consume(
		queueName, // queue
		"",        // consumer name (auto-generated)
		true,      // auto-ack
		false,     // exclusive
		false,     // no-local
		false,     // no-wait
		nil,       // args
	)
	if err != nil {
		return nil, fmt.Errorf("failed to register consumer: %w", err)
	}

	return msgs, nil
}