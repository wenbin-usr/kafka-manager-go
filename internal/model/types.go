package model

import "time"

// ClusterConfig represents a Kafka cluster configuration
type ClusterConfig struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Brokers  string `json:"brokers"`
}

// TopicInfo represents basic topic information
type TopicInfo struct {
	Name              string `json:"name"`
	PartitionCount    int    `json:"partitionCount"`
	ReplicationFactor int    `json:"replicationFactor"`
}

// PartitionInfo represents detailed partition information
type PartitionInfo struct {
	Partition       int   `json:"partition"`
	Leader          int   `json:"leader"`
	Replicas        []int `json:"replicas"`
	ISR             []int `json:"isr"`
	FirstOffset     int64 `json:"firstOffset"`
	LastOffset      int64 `json:"lastOffset"`
	MessageCount    int64 `json:"messageCount"`
}

// TopicDetail represents detailed topic information
type TopicDetail struct {
	Name              string           `json:"name"`
	PartitionCount    int              `json:"partitionCount"`
	ReplicationFactor int              `json:"replicationFactor"`
	Partitions        []PartitionInfo  `json:"partitions"`
	TotalMessages     int64            `json:"totalMessages"`
}

// CreateTopicRequest represents a topic creation request
type CreateTopicRequest struct {
	Name              string `json:"name"`
	PartitionCount    int    `json:"partitionCount"`
	ReplicationFactor int    `json:"replicationFactor"`
}

// ConsumerGroupInfo represents basic consumer group information
type ConsumerGroupInfo struct {
	GroupID string `json:"groupId"`
	State   string `json:"state"`
	Members int    `json:"members"`
}

// ConsumerGroupDetail represents detailed consumer group information
type ConsumerGroupDetail struct {
	GroupID  string               `json:"groupId"`
	State    string               `json:"state"`
	Members  []ConsumerMember     `json:"members"`
	Offsets  []ConsumerOffset     `json:"offsets"`
	TotalLag int64                `json:"totalLag"`
}

// ConsumerMember represents a member of a consumer group
type ConsumerMember struct {
	ID          string `json:"id"`
	ClientID    string `json:"clientId"`
	ClientHost  string `json:"clientHost"`
	Assignments string `json:"assignments"`
}

// ConsumerOffset represents a consumer group offset for a topic-partition
type ConsumerOffset struct {
	Topic     string `json:"topic"`
	Partition int    `json:"partition"`
	Offset    int64  `json:"offset"`
	LogEnd    int64  `json:"logEnd"`
	Lag       int64  `json:"lag"`
}

// MessageRecord represents a Kafka message
type MessageRecord struct {
	Partition int       `json:"partition"`
	Offset    int64     `json:"offset"`
	Key       string    `json:"key"`
	Value     string    `json:"value"`
	Timestamp time.Time `json:"timestamp"`
	IsJSON    bool      `json:"isJson"`
}

// MessageQuery represents query parameters for message browsing
type MessageQuery struct {
	Partition   *int   `form:"partition" json:"partition"`
	StartOffset int64  `form:"startOffset" json:"startOffset"`
	Limit       int    `form:"limit" json:"limit"`
	ValueFilter string `form:"valueFilter" json:"valueFilter"`
}

// Overview represents cluster overview data
type Overview struct {
	BrokerCount       int `json:"brokerCount"`
	TopicCount        int `json:"topicCount"`
	PartitionCount    int `json:"partitionCount"`
	ConsumerGroupCount int `json:"consumerGroupCount"`
}

// Response is a generic API response wrapper
type Response struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
}

// OKResponse returns a success response
func OKResponse(data interface{}) Response {
	return Response{Success: true, Data: data}
}

// ErrorResponse returns an error response
func ErrorResponse(err error) Response {
	return Response{Success: false, Error: err.Error()}
}

// ErrorResponseMsg returns an error response with a string message
func ErrorResponseMsg(msg string) Response {
	return Response{Success: false, Error: msg}
}
