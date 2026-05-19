package service

import (
	"context"
	"fmt"

	"github.com/segmentio/kafka-go"
	"github.com/segmentio/kafka-go/protocol/describegroups"
)

// fetchGroupAssignorProtocols reads DescribeGroups.ProtocolData (selected assignor name,
// e.g. "range", "cooperative-sticky"). The high-level kafka.Client.DescribeGroups API
// does not expose this field; Java consumers also leave MemberMetadata.UserData empty.
func fetchGroupAssignorProtocols(ctx context.Context, brokers string, groupIDs []string) (map[string]string, error) {
	if len(groupIDs) == 0 {
		return map[string]string{}, nil
	}

	brokerList := splitBrokers(brokers)
	if len(brokerList) == 0 {
		return nil, fmt.Errorf("no brokers configured")
	}

	resp, err := kafka.DefaultTransport.RoundTrip(ctx, kafka.TCP(brokerList...), &describegroups.Request{
		Groups: groupIDs,
	})
	if err != nil {
		return nil, fmt.Errorf("describe groups for assignor protocol: %w", err)
	}

	apiResp, ok := resp.(*describegroups.Response)
	if !ok {
		return nil, fmt.Errorf("unexpected describe groups response type %T", resp)
	}

	protocols := make(map[string]string, len(apiResp.Groups))
	for _, g := range apiResp.Groups {
		if g.ErrorCode != 0 {
			continue
		}
		if g.ProtocolData != "" {
			protocols[g.GroupID] = g.ProtocolData
		}
	}
	return protocols, nil
}
