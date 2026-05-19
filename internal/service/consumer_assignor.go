package service

import (
	"strconv"
	"strings"

	"kafka-manager-go/internal/model"

	"github.com/segmentio/kafka-go"
)

// protocolAssignorNames maps Kafka consumer group protocol names (JoinGroup / DescribeGroups.ProtocolData)
// to display names. See ConsumerPartitionAssignor#name() in Apache Kafka.
var protocolAssignorNames = map[string]struct {
	display     string
	cooperative bool
}{
	"range":              {"Range", false},
	"roundrobin":         {"RoundRobin", false},
	"sticky":             {"Sticky", false},
	"cooperative-sticky": {"CooperativeSticky", true},
}

func strategiesFromProtocolName(protocolName string) []string {
	if protocolName == "" {
		return nil
	}
	if a, ok := protocolAssignorNames[protocolName]; ok {
		return []string{a.display}
	}
	// Unknown or custom assignor — show the raw protocol name.
	return []string{protocolName}
}

func rebalanceTypeFromProtocolName(protocolName string) string {
	if a, ok := protocolAssignorNames[protocolName]; ok {
		if a.cooperative {
			return "cooperative"
		}
		return "eager"
	}
	return ""
}

var knownAssignors = []struct {
	token       string
	display     string
	cooperative bool
}{
	{"CooperativeStickyAssignor", "CooperativeSticky", true},
	{"cooperative-sticky", "CooperativeSticky", true},
	{"StickyAssignor", "Sticky", false},
	{"RoundRobinAssignor", "RoundRobin", false},
	{"RangeAssignor", "Range", false},
	{"Sticky", "Sticky", false},
	{"RoundRobin", "RoundRobin", false},
	{"Range", "Range", false},
}

func parseAssignmentStrategies(userData []byte) []string {
	if len(userData) == 0 {
		return nil
	}
	text := string(userData)
	found := make([]string, 0, 2)
	seen := make(map[string]struct{})

	for _, a := range knownAssignors {
		if !strings.Contains(text, a.token) {
			continue
		}
		if a.token == "StickyAssignor" && strings.Contains(text, "CooperativeStickyAssignor") {
			continue
		}
		if a.token == "Sticky" && strings.Contains(text, "CooperativeSticky") {
			continue
		}
		if _, ok := seen[a.display]; ok {
			continue
		}
		seen[a.display] = struct{}{}
		found = append(found, a.display)
	}
	return found
}

func rebalanceTypeFromStrategies(strategies []string, metadataVersion int, hasOwnedPartitions bool) string {
	for _, s := range strategies {
		if s == "CooperativeSticky" {
			return "cooperative"
		}
	}
	if metadataVersion >= 1 && hasOwnedPartitions {
		return "cooperative"
	}
	if len(strategies) > 0 {
		return "eager"
	}
	return ""
}

func formatAssignmentStrategies(strategies []string) string {
	if len(strategies) == 0 {
		return ""
	}
	return strings.Join(strategies, ", ")
}

func mergeGroupAssignmentStrategies(memberStrategies [][]string) []string {
	seen := make(map[string]struct{})
	result := make([]string, 0)
	for _, list := range memberStrategies {
		for _, s := range list {
			if _, ok := seen[s]; ok {
				continue
			}
			seen[s] = struct{}{}
			result = append(result, s)
		}
	}
	return result
}

func memberTopicAssignments(topics []kafka.GroupMemberTopic) []model.MemberTopicAssignment {
	result := make([]model.MemberTopicAssignment, 0, len(topics))
	for _, t := range topics {
		parts := append([]int(nil), t.Partitions...)
		result = append(result, model.MemberTopicAssignment{
			Topic:      t.Topic,
			Partitions: parts,
		})
	}
	return result
}

func formatTopicAssignmentsSummary(topics []kafka.GroupMemberTopic) string {
	if len(topics) == 0 {
		return ""
	}
	parts := make([]string, 0, len(topics))
	for _, t := range topics {
		p := make([]string, len(t.Partitions))
		for i, id := range t.Partitions {
			p[i] = strconv.Itoa(id)
		}
		parts = append(parts, t.Topic+"["+strings.Join(p, ",")+"]")
	}
	return strings.Join(parts, "; ")
}

func groupRebalanceType(merged []string, members []kafka.DescribeGroupsResponseMember) string {
	if t := rebalanceTypeFromStrategies(merged, 0, false); t != "" {
		return t
	}
	for _, m := range members {
		hasOwned := len(m.MemberMetadata.OwnedPartitions) > 0
		if rebalanceTypeFromStrategies(nil, m.MemberMetadata.Version, hasOwned) == "cooperative" {
			return "cooperative"
		}
	}
	if len(merged) > 0 {
		return "eager"
	}
	return ""
}

func enrichConsumerGroupFromDescribe(group kafka.DescribeGroupsResponseGroup, protocolName string) (assignmentStrategies string, rebalanceType string, members []model.ConsumerMember) {
	memberStrategyLists := make([][]string, 0, len(group.Members))
	members = make([]model.ConsumerMember, 0, len(group.Members))

	groupStrategies := strategiesFromProtocolName(protocolName)

	for _, m := range group.Members {
		strategies := groupStrategies
		if len(strategies) == 0 {
			strategies = parseAssignmentStrategies(m.MemberMetadata.UserData)
		}
		memberStrategyLists = append(memberStrategyLists, strategies)

		hasOwned := len(m.MemberMetadata.OwnedPartitions) > 0
		memberRebalance := rebalanceTypeFromProtocolName(protocolName)
		if memberRebalance == "" {
			memberRebalance = rebalanceTypeFromStrategies(strategies, m.MemberMetadata.Version, hasOwned)
		}

		members = append(members, model.ConsumerMember{
			ID:                   m.MemberID,
			ClientID:             m.ClientID,
			ClientHost:           m.ClientHost,
			AssignmentStrategies: formatAssignmentStrategies(strategies),
			RebalanceType:        memberRebalance,
			TopicAssignments:     memberTopicAssignments(m.MemberAssignments.Topics),
			Assignments:          formatTopicAssignmentsSummary(m.MemberAssignments.Topics),
		})
	}

	merged := groupStrategies
	if len(merged) == 0 {
		merged = mergeGroupAssignmentStrategies(memberStrategyLists)
	}
	assignmentStrategies = formatAssignmentStrategies(merged)
	rebalanceType = rebalanceTypeFromProtocolName(protocolName)
	if rebalanceType == "" {
		rebalanceType = groupRebalanceType(merged, group.Members)
	}
	return assignmentStrategies, rebalanceType, members
}
