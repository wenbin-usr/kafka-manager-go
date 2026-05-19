package service

import "testing"

func TestCheckClusterHealthEmptyBrokers(t *testing.T) {
	if CheckClusterHealth("") != ClusterStatusOffline {
		t.Fatal("empty brokers should be offline")
	}
	if CheckClusterHealth("  ,  ") != ClusterStatusOffline {
		t.Fatal("blank brokers should be offline")
	}
}
