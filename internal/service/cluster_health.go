package service

import (
	"context"
	"sync"
	"time"

	"kafka-manager-go/internal/model"

	"github.com/segmentio/kafka-go"
)

const clusterHealthTimeout = 5 * time.Second

const (
	ClusterStatusOnline  = "online"
	ClusterStatusOffline = "offline"
)

// CheckClusterHealth returns online if any bootstrap broker responds to a metadata request.
func CheckClusterHealth(brokers string) string {
	ctx, cancel := context.WithTimeout(context.Background(), clusterHealthTimeout)
	defer cancel()

	addrs := splitBrokers(brokers)
	if len(addrs) == 0 {
		return ClusterStatusOffline
	}

	for _, addr := range addrs {
		if err := pingBroker(ctx, addr); err == nil {
			return ClusterStatusOnline
		}
	}
	return ClusterStatusOffline
}

func pingBroker(ctx context.Context, addr string) error {
	conn, err := kafka.DialContext(ctx, "tcp", addr)
	if err != nil {
		return err
	}
	defer conn.Close()

	_, err = conn.Brokers()
	return err
}

// EnrichClustersHealth checks connectivity for each cluster in parallel.
func EnrichClustersHealth(clusters []model.ClusterConfig) []model.ClusterListItem {
	if len(clusters) == 0 {
		return nil
	}

	result := make([]model.ClusterListItem, len(clusters))
	var wg sync.WaitGroup

	for i, c := range clusters {
		wg.Add(1)
		go func(i int, c model.ClusterConfig) {
			defer wg.Done()
			result[i] = model.ClusterListItem{
				ClusterConfig: c,
				Status:        CheckClusterHealth(c.Brokers),
			}
		}(i, c)
	}

	wg.Wait()
	return result
}
