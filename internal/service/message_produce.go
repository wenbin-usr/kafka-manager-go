package service

import (
	"context"
	"fmt"
	"time"

	"kafka-manager-go/internal/model"

	"github.com/segmentio/kafka-go"
)

const produceTimeout = 30 * time.Second

// ProduceMessage writes a single message to a topic.
func ProduceMessage(brokers, topic string, req model.ProduceMessageRequest) (*model.ProduceMessageResult, error) {
	if topic == "" {
		return nil, fmt.Errorf("topic is required")
	}

	writer := &kafka.Writer{
		Addr:                   kafka.TCP(splitBrokers(brokers)...),
		Topic:                  topic,
		Balancer:               &kafka.LeastBytes{},
		AllowAutoTopicCreation: false,
		RequiredAcks:           kafka.RequireOne,
	}
	defer writer.Close()

	msg := kafka.Message{
		Key:   []byte(req.Key),
		Value: []byte(req.Value),
	}
	if req.Partition != nil {
		msg.Partition = *req.Partition
	}
	for _, h := range req.Headers {
		if h.Key == "" {
			continue
		}
		msg.Headers = append(msg.Headers, kafka.Header{
			Key:   h.Key,
			Value: []byte(h.Value),
		})
	}

	ctx, cancel := context.WithTimeout(context.Background(), produceTimeout)
	defer cancel()

	if err := writer.WriteMessages(ctx, msg); err != nil {
		return nil, fmt.Errorf("failed to produce message: %w", err)
	}

	return &model.ProduceMessageResult{
		Partition: msg.Partition,
		Offset:    msg.Offset,
	}, nil
}
