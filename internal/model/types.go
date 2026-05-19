package model

import "time"

// ClusterConfig represents a Kafka cluster configuration
type ClusterConfig struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Brokers string `json:"brokers"`
}

// ClusterListItem is returned when listing clusters with live health status.
type ClusterListItem struct {
	ClusterConfig
	Status string `json:"status"` // online or offline
}

// TopicInfo represents basic topic information
type TopicInfo struct {
	Name              string `json:"name"`
	PartitionCount    int    `json:"partitionCount"`
	ReplicationFactor int    `json:"replicationFactor"`
}

// PartitionInfo represents detailed partition information
type PartitionInfo struct {
	Partition    int   `json:"partition"`
	Leader       int   `json:"leader"`
	Replicas     []int `json:"replicas"`
	ISR          []int `json:"isr"`
	FirstOffset  int64 `json:"firstOffset"`
	LastOffset   int64 `json:"lastOffset"`
	MessageCount int64 `json:"messageCount"`
}

// TopicDetail represents detailed topic information
type TopicDetail struct {
	Name              string          `json:"name"`
	PartitionCount    int             `json:"partitionCount"`
	ReplicationFactor int             `json:"replicationFactor"`
	Partitions        []PartitionInfo `json:"partitions"`
	TotalMessages     int64           `json:"totalMessages"`
}

// TopicConfigEntry represents a single topic configuration entry
type TopicConfigEntry struct {
	Name          string `json:"name"`
	Value         string `json:"value"`
	DefaultValue  string `json:"defaultValue,omitempty"`
	ReadOnly      bool   `json:"readOnly"`
	Sensitive     bool   `json:"sensitive"`
	Documentation string `json:"documentation,omitempty"`
	Editable      bool   `json:"editable"`
}

// UpdateTopicConfigsRequest updates editable topic configs
type UpdateTopicConfigsRequest struct {
	Configs map[string]string `json:"configs"`
}

// CreateTopicRequest represents a topic creation request
type CreateTopicRequest struct {
	Name              string `json:"name"`
	PartitionCount    int    `json:"partitionCount"`
	ReplicationFactor int    `json:"replicationFactor"`
}

// IncreasePartitionsRequest sets the new total partition count for a topic
type IncreasePartitionsRequest struct {
	TotalPartitions int `json:"totalPartitions"`
}

// ConsumerGroupInfo represents basic consumer group information
type ConsumerGroupInfo struct {
	GroupID              string `json:"groupId"`
	State                string `json:"state"`
	Members              int    `json:"members"`
	AssignmentStrategies string `json:"assignmentStrategies,omitempty"`
	RebalanceType        string `json:"rebalanceType,omitempty"` // eager or cooperative
}

// ConsumerGroupDetail represents detailed consumer group information
type ConsumerGroupDetail struct {
	GroupID              string           `json:"groupId"`
	State                string           `json:"state"`
	AssignmentStrategies string           `json:"assignmentStrategies,omitempty"`
	RebalanceType        string           `json:"rebalanceType,omitempty"`
	Members              []ConsumerMember `json:"members"`
	Offsets              []ConsumerOffset `json:"offsets"`
	TotalLag             int64            `json:"totalLag"`
}

// MemberTopicAssignment is partition assignment for one topic
type MemberTopicAssignment struct {
	Topic      string `json:"topic"`
	Partitions []int  `json:"partitions"`
}

// ConsumerMember represents a member of a consumer group
type ConsumerMember struct {
	ID                   string                  `json:"id"`
	ClientID             string                  `json:"clientId"`
	ClientHost           string                  `json:"clientHost"`
	AssignmentStrategies string                  `json:"assignmentStrategies,omitempty"`
	RebalanceType        string                  `json:"rebalanceType,omitempty"`
	TopicAssignments     []MemberTopicAssignment `json:"topicAssignments,omitempty"`
	Assignments          string                  `json:"assignments"`
}

// ConsumerOffset represents a consumer group offset for a topic-partition
type ConsumerOffset struct {
	Topic     string `json:"topic"`
	Partition int    `json:"partition"`
	Offset    int64  `json:"offset"`
	LogEnd    int64  `json:"logEnd"`
	Lag       int64  `json:"lag"`
}

// MessageHeader represents a single Kafka record header
type MessageHeader struct {
	Key      string `json:"key"`
	Value    string `json:"value"`
	Encoding string `json:"encoding,omitempty"` // utf8 or base64
}

// MessageRecord represents a Kafka message
type MessageRecord struct {
	Partition int             `json:"partition"`
	Offset    int64           `json:"offset"`
	Key       string          `json:"key"`
	Value     string          `json:"value"`
	Timestamp time.Time       `json:"timestamp"`
	IsJSON    bool            `json:"isJson"`
	Headers   []MessageHeader `json:"headers,omitempty"`
}

// ProduceMessageHeader is a key/value pair for message headers on produce
type ProduceMessageHeader struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

// ProduceMessageRequest represents a message produce request
type ProduceMessageRequest struct {
	Key       string                 `json:"key"`
	Value     string                 `json:"value"`
	Partition *int                   `json:"partition"`
	Headers   []ProduceMessageHeader `json:"headers"`
}

// ProduceMessageResult is returned after a successful produce
type ProduceMessageResult struct {
	Partition int   `json:"partition"`
	Offset    int64 `json:"offset"`
}

// MessageQuery represents query parameters for message browsing
type MessageQuery struct {
	Partition   *int   `form:"partition" json:"partition"`
	StartOffset int64  `form:"startOffset" json:"startOffset"`
	Limit       int    `form:"limit" json:"limit"`
	ValueFilter string `form:"valueFilter" json:"valueFilter"`
}

// BrokerTopicAssignment describes a broker's role on a topic-partition
type BrokerTopicAssignment struct {
	Topic     string `json:"topic"`
	Partition int    `json:"partition"`
	Role      string `json:"role"` // leader or replica
}

// BrokerInfo represents a Kafka broker in the cluster
type BrokerInfo struct {
	ID                int                     `json:"id"`
	Host              string                  `json:"host"`
	Port              int                     `json:"port"`
	Address           string                  `json:"address"`
	Rack              string                  `json:"rack,omitempty"`
	IsController      bool                    `json:"isController"`
	ClusterID         string                  `json:"clusterId,omitempty"`
	LeaderPartitions  int                     `json:"leaderPartitions"`
	ReplicaPartitions int                     `json:"replicaPartitions"`
	Assignments       []BrokerTopicAssignment `json:"assignments"`
}

// Overview represents cluster overview data
type Overview struct {
	BrokerCount        int `json:"brokerCount"`
	TopicCount         int `json:"topicCount"`
	PartitionCount     int `json:"partitionCount"`
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
