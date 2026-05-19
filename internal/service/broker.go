package service

import (
	"context"
	"fmt"
	"sort"

	"kafka-manager-go/internal/model"

	"github.com/segmentio/kafka-go"
)

// ListBrokers returns broker metadata and partition role statistics for the cluster.
func ListBrokers(brokers string) ([]model.BrokerInfo, error) {
	client := &kafka.Client{Addr: kafka.TCP(splitBrokers(brokers)...)}

	meta, err := client.Metadata(context.Background(), &kafka.MetadataRequest{})
	if err != nil {
		return nil, fmt.Errorf("failed to fetch cluster metadata: %w", err)
	}

	leaderCount := make(map[int]int)
	replicaCount := make(map[int]int)
	assignments := make(map[int][]model.BrokerTopicAssignment)

	for _, topic := range meta.Topics {
		if topic.Error != nil {
			continue
		}
		for _, p := range topic.Partitions {
			if p.Error != nil {
				continue
			}

			leaderID := p.Leader.ID
			leaderCount[leaderID]++
			assignments[leaderID] = append(assignments[leaderID], model.BrokerTopicAssignment{
				Topic:     topic.Name,
				Partition: p.ID,
				Role:      "leader",
			})

			seenReplica := make(map[int]struct{})
			for _, r := range p.Replicas {
				if _, ok := seenReplica[r.ID]; ok {
					continue
				}
				seenReplica[r.ID] = struct{}{}
				replicaCount[r.ID]++
				if r.ID == leaderID {
					continue
				}
				assignments[r.ID] = append(assignments[r.ID], model.BrokerTopicAssignment{
					Topic:     topic.Name,
					Partition: p.ID,
					Role:      "replica",
				})
			}
		}
	}

	controllerID := meta.Controller.ID
	result := make([]model.BrokerInfo, 0, len(meta.Brokers))
	for _, b := range meta.Brokers {
		hostAssignments := assignments[b.ID]
		sort.Slice(hostAssignments, func(i, j int) bool {
			if hostAssignments[i].Topic == hostAssignments[j].Topic {
				if hostAssignments[i].Role == hostAssignments[j].Role {
					return hostAssignments[i].Partition < hostAssignments[j].Partition
				}
				return hostAssignments[i].Role < hostAssignments[j].Role
			}
			return hostAssignments[i].Topic < hostAssignments[j].Topic
		})

		result = append(result, model.BrokerInfo{
			ID:                b.ID,
			Host:              b.Host,
			Port:              b.Port,
			Address:           fmt.Sprintf("%s:%d", b.Host, b.Port),
			Rack:              b.Rack,
			IsController:      b.ID == controllerID,
			ClusterID:         meta.ClusterID,
			LeaderPartitions:  leaderCount[b.ID],
			ReplicaPartitions: replicaCount[b.ID],
			Assignments:       hostAssignments,
		})
	}

	sort.Slice(result, func(i, j int) bool {
		return result[i].ID < result[j].ID
	})

	return result, nil
}
