package service

import (
	"context"
	"fmt"
	"sort"
	"time"

	"kafka-manager-go/internal/model"

	"github.com/segmentio/kafka-go"
)

// ListTopics returns all topics in the cluster
func ListTopics(brokers string) ([]model.TopicInfo, error) {
	conn, err := DialController(brokers)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to cluster: %w", err)
	}
	defer conn.Close()

	partitions, err := conn.ReadPartitions()
	if err != nil {
		return nil, fmt.Errorf("failed to read partitions: %w", err)
	}

	// Group partitions by topic
	topicMap := make(map[string]*model.TopicInfo)
	for _, p := range partitions {
		t, ok := topicMap[p.Topic]
		if !ok {
			t = &model.TopicInfo{
				Name:              p.Topic,
				PartitionCount:    0,
				ReplicationFactor: len(p.Replicas),
			}
			topicMap[p.Topic] = t
		}
		t.PartitionCount++
		if len(p.Replicas) > t.ReplicationFactor {
			t.ReplicationFactor = len(p.Replicas)
		}
	}

	// Skip internal topics
	result := make([]model.TopicInfo, 0, len(topicMap))
	for _, t := range topicMap {
		if t.Name == "__consumer_offsets" || t.Name == "__transaction_state" {
			continue
		}
		result = append(result, *t)
	}

	sort.Slice(result, func(i, j int) bool {
		return result[i].Name < result[j].Name
	})

	return result, nil
}

// GetTopicDetail returns detailed information about a specific topic
func GetTopicDetail(brokers, topic string) (*model.TopicDetail, error) {
	brokerList := splitBrokers(brokers)
	client := &kafka.Client{Addr: kafka.TCP(brokerList...)}

	// Get topic metadata
	resp, err := client.Metadata(context.Background(), &kafka.MetadataRequest{
		Topics: []string{topic},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get topic metadata: %w", err)
	}

	var topicMeta *kafka.Topic
	for i, t := range resp.Topics {
		if t.Name == topic {
			topicMeta = &resp.Topics[i]
			break
		}
	}
	if topicMeta == nil {
		return nil, fmt.Errorf("topic %s not found", topic)
	}

	detail := &model.TopicDetail{
		Name:              topic,
		PartitionCount:    len(topicMeta.Partitions),
		ReplicationFactor: 0,
		Partitions:        make([]model.PartitionInfo, 0, len(topicMeta.Partitions)),
	}

	for _, p := range topicMeta.Partitions {
		if detail.ReplicationFactor == 0 {
			detail.ReplicationFactor = len(p.Replicas)
		}

		pi := model.PartitionInfo{
			Partition: p.ID,
			Leader:    p.Leader.ID,
			Replicas:  make([]int, 0, len(p.Replicas)),
			ISR:       make([]int, 0, len(p.Isr)),
		}
		for _, r := range p.Replicas {
			pi.Replicas = append(pi.Replicas, r.ID)
		}
		for _, r := range p.Isr {
			pi.ISR = append(pi.ISR, r.ID)
		}

		// Get first and last offsets
		first, last, err := getPartitionOffsets(brokers, topic, p.ID)
		if err == nil {
			pi.FirstOffset = first
			pi.LastOffset = last
			pi.MessageCount = last - first
		}

		detail.Partitions = append(detail.Partitions, pi)
		detail.TotalMessages += pi.MessageCount
	}

	sort.Slice(detail.Partitions, func(i, j int) bool {
		return detail.Partitions[i].Partition < detail.Partitions[j].Partition
	})

	return detail, nil
}

func getPartitionOffsets(brokers, topic string, partition int) (first, last int64, err error) {
	conn, err := dialPartitionLeader(brokers, topic, partition)
	if err != nil {
		return 0, 0, err
	}
	defer conn.Close()

	first, err = conn.ReadFirstOffset()
	if err != nil {
		return 0, 0, err
	}

	last, err = conn.ReadLastOffset()
	if err != nil {
		return 0, 0, err
	}

	return first, last, nil
}

// CreateTopic creates a new Kafka topic
func CreateTopic(brokers string, req model.CreateTopicRequest) error {
	conn, err := DialController(brokers)
	if err != nil {
		return fmt.Errorf("failed to connect to cluster: %w", err)
	}
	defer conn.Close()

	topicConfig := kafka.TopicConfig{
		Topic:             req.Name,
		NumPartitions:     req.PartitionCount,
		ReplicationFactor: req.ReplicationFactor,
	}

	err = conn.CreateTopics(topicConfig)
	if err != nil {
		return fmt.Errorf("failed to create topic: %w", err)
	}

	return nil
}

// IncreaseTopicPartitions increases a topic to the given total partition count.
func IncreaseTopicPartitions(brokers, topic string, totalPartitions int) error {
	if totalPartitions <= 0 {
		return fmt.Errorf("total partitions must be positive")
	}

	detail, err := GetTopicDetail(brokers, topic)
	if err != nil {
		return err
	}
	current := detail.PartitionCount
	if totalPartitions <= current {
		return fmt.Errorf("new partition count %d must be greater than current %d", totalPartitions, current)
	}

	brokerList := splitBrokers(brokers)
	if len(brokerList) == 0 {
		return fmt.Errorf("no broker addresses configured")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	client := &kafka.Client{Addr: kafka.TCP(brokerList...)}
	resp, err := client.CreatePartitions(ctx, &kafka.CreatePartitionsRequest{
		Topics: []kafka.TopicPartitionsConfig{{
			Name:  topic,
			Count: int32(totalPartitions),
		}},
	})
	if err != nil {
		return fmt.Errorf("failed to increase partitions: %w", err)
	}

	if topicErr, ok := resp.Errors[topic]; ok && topicErr != nil {
		return fmt.Errorf("failed to increase partitions for topic %s: %w", topic, topicErr)
	}

	return nil
}

// DeleteTopic deletes a Kafka topic
func DeleteTopic(brokers, topic string) error {
	conn, err := DialController(brokers)
	if err != nil {
		return fmt.Errorf("failed to connect to cluster: %w", err)
	}
	defer conn.Close()

	err = conn.DeleteTopics(topic)
	if err != nil {
		return fmt.Errorf("failed to delete topic: %w", err)
	}

	return nil
}
