package service

import (
	"context"
	"fmt"
	"sort"

	"kafka-manager-go/internal/model"

	"github.com/segmentio/kafka-go"
)

// ListConsumerGroups returns all consumer groups in the cluster
func ListConsumerGroups(brokers string) ([]model.ConsumerGroupInfo, error) {
	client := &kafka.Client{Addr: kafka.TCP(splitBrokers(brokers)...)}

	resp, err := client.ListGroups(context.Background(), &kafka.ListGroupsRequest{})
	if err != nil {
		return nil, fmt.Errorf("failed to list consumer groups: %w", err)
	}

	groupIDs := make([]string, 0, len(resp.Groups))
	for _, g := range resp.Groups {
		groupIDs = append(groupIDs, g.GroupID)
	}

	result := make([]model.ConsumerGroupInfo, 0, len(resp.Groups))
	byID := make(map[string]*model.ConsumerGroupInfo, len(resp.Groups))
	for _, g := range resp.Groups {
		info := model.ConsumerGroupInfo{GroupID: g.GroupID}
		result = append(result, info)
		byID[g.GroupID] = &result[len(result)-1]
	}

	// Get state, assignor protocol, and member counts via DescribeGroups
	if len(groupIDs) > 0 {
		ctx := context.Background()
		protocols, _ := fetchGroupAssignorProtocols(ctx, brokers, groupIDs)

		describeResp, err := client.DescribeGroups(ctx, &kafka.DescribeGroupsRequest{
			GroupIDs: groupIDs,
		})
		if err == nil {
			for _, g := range describeResp.Groups {
				info, ok := byID[g.GroupID]
				if !ok {
					continue
				}
				strategies, rebalanceType, _ := enrichConsumerGroupFromDescribe(g, protocols[g.GroupID])
				info.State = g.GroupState
				info.Members = len(g.Members)
				info.AssignmentStrategies = strategies
				info.RebalanceType = rebalanceType
			}
		}
	}

	sort.Slice(result, func(i, j int) bool {
		return result[i].GroupID < result[j].GroupID
	})

	return result, nil
}

// GetConsumerGroupDetail returns detailed information about a consumer group
func GetConsumerGroupDetail(brokers, groupID string) (*model.ConsumerGroupDetail, error) {
	client := &kafka.Client{Addr: kafka.TCP(splitBrokers(brokers)...)}

	// Describe the group
	describeResp, err := client.DescribeGroups(context.Background(), &kafka.DescribeGroupsRequest{
		GroupIDs: []string{groupID},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to describe consumer group: %w", err)
	}

	if len(describeResp.Groups) == 0 {
		return nil, fmt.Errorf("consumer group %s not found", groupID)
	}

	group := describeResp.Groups[0]
	ctx := context.Background()
	protocols, _ := fetchGroupAssignorProtocols(ctx, brokers, []string{groupID})
	strategies, rebalanceType, members := enrichConsumerGroupFromDescribe(group, protocols[groupID])
	detail := &model.ConsumerGroupDetail{
		GroupID:              groupID,
		State:                group.GroupState,
		AssignmentStrategies: strategies,
		RebalanceType:        rebalanceType,
		Members:              members,
		Offsets:              make([]model.ConsumerOffset, 0),
	}

	// Get offsets (nil Topics = fetch all for the group)
	offsetResp, err := client.OffsetFetch(context.Background(), &kafka.OffsetFetchRequest{
		GroupID: groupID,
	})
	if err != nil {
		return detail, nil // Return what we have
	}

	// Get end offsets for lag calculation
	endOffsets := make(map[string]map[int]int64) // topic -> partition -> endOffset
	for topicName, partitions := range offsetResp.Topics {
		if endOffsets[topicName] == nil {
			endOffsets[topicName] = make(map[int]int64)
		}

		var offsetReqs []kafka.OffsetRequest
		partitionIndices := make([]int, 0, len(partitions))
		for _, p := range partitions {
			offsetReqs = append(offsetReqs, kafka.LastOffsetOf(p.Partition))
			partitionIndices = append(partitionIndices, p.Partition)
		}

		if len(offsetReqs) > 0 {
			listResp, err := client.ListOffsets(context.Background(), &kafka.ListOffsetsRequest{
				Topics: map[string][]kafka.OffsetRequest{
					topicName: offsetReqs,
				},
			})
			if err == nil {
				for _, po := range listResp.Topics[topicName] {
					endOffsets[topicName][po.Partition] = po.LastOffset
				}
			}
		}
	}

	// Build offset entries
	for topicName, partitions := range offsetResp.Topics {
		for _, p := range partitions {
			if p.Error != nil {
				continue
			}
			var lag int64
			if end, ok := endOffsets[topicName][p.Partition]; ok {
				if end > p.CommittedOffset {
					lag = end - p.CommittedOffset
				}
			}
			detail.Offsets = append(detail.Offsets, model.ConsumerOffset{
				Topic:     topicName,
				Partition: p.Partition,
				Offset:    p.CommittedOffset,
				LogEnd:    endOffsets[topicName][p.Partition],
				Lag:       lag,
			})
			detail.TotalLag += lag
		}
	}

	sort.Slice(detail.Offsets, func(i, j int) bool {
		if detail.Offsets[i].Topic == detail.Offsets[j].Topic {
			return detail.Offsets[i].Partition < detail.Offsets[j].Partition
		}
		return detail.Offsets[i].Topic < detail.Offsets[j].Topic
	})

	return detail, nil
}

// DeleteConsumerGroupOffsets deletes offsets for a consumer group
func DeleteConsumerGroupOffsets(brokers, groupID string) error {
	client := &kafka.Client{Addr: kafka.TCP(splitBrokers(brokers)...)}

	// First, get the group's offsets to know which topic-partitions to delete
	offsetResp, err := client.OffsetFetch(context.Background(), &kafka.OffsetFetchRequest{
		GroupID: groupID,
	})
	if err != nil {
		return fmt.Errorf("failed to list group offsets: %w", err)
	}

	// Build the topics map for deletion
	topics := make(map[string][]int)
	for topicName, partitions := range offsetResp.Topics {
		for _, p := range partitions {
			topics[topicName] = append(topics[topicName], p.Partition)
		}
	}

	if len(topics) == 0 {
		return fmt.Errorf("no offsets found for group %s", groupID)
	}

	// Delete the consumer group offsets
	_, err = client.OffsetDelete(context.Background(), &kafka.OffsetDeleteRequest{
		GroupID: groupID,
		Topics:  topics,
	})
	if err != nil {
		return fmt.Errorf("failed to delete consumer group offsets: %w", err)
	}

	return nil
}
