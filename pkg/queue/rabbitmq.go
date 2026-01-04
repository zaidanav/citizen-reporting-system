package queue

import (
	"fmt"
	amqp "github.com/rabbitmq/amqp091-go"
)

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

func ConsumeMessages(ch *amqp.Channel, queueName string) (<-chan amqp.Delivery, error) {
	_, err := ch.QueueDeclare(
		queueName,
		true,
		false,
		false,
		false,
		nil,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to declare queue: %w", err)
	}

	msgs, err := ch.Consume(
		queueName,
		"",
		true,
		false,
		false,
		false,
		nil,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to register consumer: %w", err)
	}

	return msgs, nil
}