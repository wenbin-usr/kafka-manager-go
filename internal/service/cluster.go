package service

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"net"
	"os"
	"sync"

	"kafka-manager-go/internal/model"

	"github.com/segmentio/kafka-go"
)

const clusterFile = "clusters.json"

// ClusterStore manages cluster configurations with persistence
type ClusterStore struct {
	mu       sync.RWMutex
	clusters map[string]model.ClusterConfig
}

// NewClusterStore loads clusters from the JSON file
func NewClusterStore() *ClusterStore {
	cs := &ClusterStore{
		clusters: make(map[string]model.ClusterConfig),
	}
	cs.load()
	return cs
}

func (cs *ClusterStore) load() {
	data, err := os.ReadFile(clusterFile)
	if err != nil {
		return
	}
	var clusters []model.ClusterConfig
	if err := json.Unmarshal(data, &clusters); err != nil {
		return
	}
	cs.mu.Lock()
	defer cs.mu.Unlock()
	for _, c := range clusters {
		cs.clusters[c.ID] = c
	}
}

func (cs *ClusterStore) save() error {
	cs.mu.RLock()
	clusters := make([]model.ClusterConfig, 0, len(cs.clusters))
	for _, c := range cs.clusters {
		clusters = append(clusters, c)
	}
	cs.mu.RUnlock()

	data, err := json.MarshalIndent(clusters, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(clusterFile, data, 0644)
}

// ListClusters returns all configured clusters
func (cs *ClusterStore) ListClusters() []model.ClusterConfig {
	cs.mu.RLock()
	defer cs.mu.RUnlock()
	result := make([]model.ClusterConfig, 0, len(cs.clusters))
	for _, c := range cs.clusters {
		result = append(result, c)
	}
	return result
}

// GetCluster returns a cluster by ID
func (cs *ClusterStore) GetCluster(id string) (model.ClusterConfig, bool) {
	cs.mu.RLock()
	defer cs.mu.RUnlock()
	c, ok := cs.clusters[id]
	return c, ok
}

// AddCluster adds a new cluster, validates connection, and persists
func (cs *ClusterStore) AddCluster(name, brokers string) (model.ClusterConfig, error) {
	// Validate connection
	if err := ValidateClusterConnection(brokers); err != nil {
		return model.ClusterConfig{}, fmt.Errorf("cannot connect to brokers: %w", err)
	}

	id := generateID()
	cluster := model.ClusterConfig{
		ID:      id,
		Name:    name,
		Brokers: brokers,
	}

	cs.mu.Lock()
	cs.clusters[id] = cluster
	cs.mu.Unlock()

	if err := cs.save(); err != nil {
		cs.mu.Lock()
		delete(cs.clusters, id)
		cs.mu.Unlock()
		return model.ClusterConfig{}, fmt.Errorf("failed to save cluster: %w", err)
	}

	return cluster, nil
}

// RemoveCluster removes a cluster by ID
func (cs *ClusterStore) RemoveCluster(id string) error {
	cs.mu.Lock()
	delete(cs.clusters, id)
	cs.mu.Unlock()
	return cs.save()
}

// ValidateClusterConnection checks if we can connect to the given brokers
func ValidateClusterConnection(brokers string) error {
	conn, err := kafka.Dial("tcp", brokers)
	if err != nil {
		return err
	}
	conn.Close()
	return nil
}

// DialController dials the first broker in the cluster (controller candidate)
func DialController(brokers string) (*kafka.Conn, error) {
	return kafka.Dial("tcp", brokers)
}

// NewDialer creates a standard dialer for kafka connections
func NewDialer() *kafka.Dialer {
	return &kafka.Dialer{
		Resolver: &net.Resolver{},
	}
}

// GetBrokers returns the list of broker addresses from a comma-separated string
func GetBrokers(brokers string) []string {
	var result []string
	for _, b := range splitBrokers(brokers) {
		result = append(result, b)
	}
	return result
}

// dialPartitionLeader connects to the leader broker for a topic partition,
// trying each configured bootstrap broker until one succeeds.
func dialPartitionLeader(brokers, topic string, partition int) (*kafka.Conn, error) {
	addrs := splitBrokers(brokers)
	if len(addrs) == 0 {
		return nil, fmt.Errorf("no broker addresses configured")
	}

	var lastErr error
	for _, addr := range addrs {
		conn, err := kafka.DialLeader(context.Background(), "tcp", addr, topic, partition)
		if err == nil {
			return conn, nil
		}
		lastErr = err
	}
	return nil, fmt.Errorf("failed to connect to partition %d leader: %w", partition, lastErr)
}

func splitBrokers(brokers string) []string {
	var result []string
	start := 0
	for i := 0; i <= len(brokers); i++ {
		if i == len(brokers) || brokers[i] == ',' {
			b := brokers[start:i]
			if b != "" {
				result = append(result, b)
			}
			start = i + 1
		}
	}
	return result
}

func generateID() string {
	b := make([]byte, 8)
	rand.Read(b)
	return fmt.Sprintf("%x", b)
}

// GetClusterOverview returns overview statistics for a cluster
func GetClusterOverview(brokers string) (*model.Overview, error) {
	conn, err := DialController(brokers)
	if err != nil {
		return nil, err
	}
	defer conn.Close()

	brokersInfo, err := conn.Brokers()
	if err != nil {
		return nil, err
	}

	partitions, err := conn.ReadPartitions()
	if err != nil {
		return nil, err
	}

	// Count unique topics
	topicSet := make(map[string]struct{})
	for _, p := range partitions {
		topicSet[p.Topic] = struct{}{}
	}

	// Get consumer groups
	client := &kafka.Client{Addr: kafka.TCP(splitBrokers(brokers)...)}
	groups, err := client.ListGroups(context.Background(), &kafka.ListGroupsRequest{})
	if err != nil {
		// Non-fatal, return 0
		return &model.Overview{
			BrokerCount:        len(brokersInfo),
			TopicCount:         len(topicSet),
			PartitionCount:     len(partitions),
			ConsumerGroupCount: 0,
		}, nil
	}

	return &model.Overview{
		BrokerCount:        len(brokersInfo),
		TopicCount:         len(topicSet),
		PartitionCount:     len(partitions),
		ConsumerGroupCount: len(groups.Groups),
	}, nil
}
