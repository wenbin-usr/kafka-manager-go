package service

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"
	"unicode/utf8"

	"kafka-manager-go/internal/model"

	"github.com/segmentio/kafka-go"
)

const maxMessageLimit = 100

const readBatchMinBytes = 1
const readBatchMaxBytes = 10 * 1024 * 1024

// ReadMessages reads messages from a topic based on query parameters
func ReadMessages(brokers, topic string, query model.MessageQuery) ([]model.MessageRecord, error) {
	if query.Limit <= 0 || query.Limit > maxMessageLimit {
		query.Limit = maxMessageLimit
	}

	// Determine which partitions to read
	partitions, err := getPartitionsForTopic(brokers, topic)
	if err != nil {
		return nil, err
	}

	var targetPartitions []int
	if query.Partition != nil {
		found := false
		for _, p := range partitions {
			if p == *query.Partition {
				found = true
				break
			}
		}
		if !found {
			return nil, fmt.Errorf("partition %d not found in topic %s", *query.Partition, topic)
		}
		targetPartitions = []int{*query.Partition}
	} else {
		targetPartitions = partitions
	}

	var messages []model.MessageRecord
	var readErrs []error
	for _, partition := range targetPartitions {
		remaining := query.Limit - len(messages)
		if remaining <= 0 {
			break
		}

		startOffset := query.StartOffset
		if query.StartOffset < 0 {
			// Default: read the most recent messages in the partition
			first, last, err := getPartitionOffsets(brokers, topic, partition)
			if err != nil {
				readErrs = append(readErrs, err)
				continue
			}
			if last <= first {
				continue // empty partition
			}
			startOffset = last - int64(remaining)
			if startOffset < first {
				startOffset = first
			}
		}

		partitionMessages, err := readPartitionMessages(brokers, topic, partition, startOffset, remaining, query.ValueFilter)
		if err != nil {
			readErrs = append(readErrs, err)
			continue
		}
		messages = append(messages, partitionMessages...)
		if len(messages) >= query.Limit {
			break
		}
	}

	if len(messages) == 0 && len(readErrs) > 0 {
		return nil, readErrs[0]
	}

	sortMessagesByTimestamp(messages, false)

	if len(messages) > query.Limit {
		messages = messages[:query.Limit]
	}

	return messages, nil
}

func sortMessagesByTimestamp(messages []model.MessageRecord, desc bool) {
	sort.Slice(messages, func(i, j int) bool {
		if desc {
			return messages[i].Timestamp.After(messages[j].Timestamp)
		}
		return messages[i].Timestamp.Before(messages[j].Timestamp)
	})
}

func getPartitionsForTopic(brokers, topic string) ([]int, error) {
	conn, err := DialController(brokers)
	if err != nil {
		return nil, err
	}
	defer conn.Close()

	partitions, err := conn.ReadPartitions(topic)
	if err != nil {
		return nil, err
	}

	result := make([]int, 0, len(partitions))
	for _, p := range partitions {
		result = append(result, p.ID)
	}
	return result, nil
}

func readPartitionMessages(brokers, topic string, partition int, startOffset int64, maxMessages int, valueFilter string) ([]model.MessageRecord, error) {
	if maxMessages <= 0 {
		return nil, nil
	}

	conn, err := dialPartitionLeader(brokers, topic, partition)
	if err != nil {
		return nil, err
	}
	defer conn.Close()

	if _, err := conn.Seek(startOffset, kafka.SeekAbsolute); err != nil {
		return nil, fmt.Errorf("failed to set offset: %w", err)
	}

	var messages []model.MessageRecord
	batch := conn.ReadBatch(readBatchMinBytes, readBatchMaxBytes)
	defer batch.Close()
	if err := batch.Err(); err != nil {
		return nil, fmt.Errorf("failed to read batch: %w", err)
	}

	for {
		if len(messages) >= maxMessages {
			break
		}

		msg, err := batch.ReadMessage()
		if err != nil {
			break
		}

		key := string(msg.Key)
		rawValue := string(msg.Value)

		if valueFilter != "" && !strings.Contains(strings.ToLower(rawValue), strings.ToLower(valueFilter)) {
			continue
		}

		value := rawValue

		// Try to detect and pretty-print JSON
		isJSON := false
		var jsonValue interface{}
		if err := json.Unmarshal(msg.Value, &jsonValue); err == nil {
			prettyBytes, err := json.MarshalIndent(jsonValue, "", "  ")
			if err == nil {
				value = string(prettyBytes)
				isJSON = true
			}
		}

		ts := time.Time{}
		if !msg.Time.IsZero() {
			ts = msg.Time
		} else {
			ts = time.Now()
		}

		messages = append(messages, model.MessageRecord{
			Partition: partition,
			Offset:    msg.Offset,
			Key:       key,
			Value:     value,
			Timestamp: ts,
			IsJSON:    isJSON,
			Headers:   parseMessageHeaders(msg.Headers),
		})
	}

	return messages, nil
}

func parseMessageHeaders(headers []kafka.Header) []model.MessageHeader {
	if len(headers) == 0 {
		return nil
	}
	result := make([]model.MessageHeader, 0, len(headers))
	for _, h := range headers {
		value, encoding := encodeHeaderValue(h.Value)
		result = append(result, model.MessageHeader{
			Key:      h.Key,
			Value:    value,
			Encoding: encoding,
		})
	}
	sort.Slice(result, func(i, j int) bool {
		if result[i].Key == result[j].Key {
			return result[i].Value < result[j].Value
		}
		return result[i].Key < result[j].Key
	})
	return result
}

func encodeHeaderValue(value []byte) (string, string) {
	if len(value) == 0 {
		return "", "utf8"
	}
	if utf8.Valid(value) && isPrintableBytes(value) {
		return string(value), "utf8"
	}
	return base64.StdEncoding.EncodeToString(value), "base64"
}

func isPrintableBytes(b []byte) bool {
	for _, c := range b {
		if c < 32 && c != '\t' && c != '\n' && c != '\r' {
			return false
		}
	}
	return true
}
