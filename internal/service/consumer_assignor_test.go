package service

import (
	"slices"
	"testing"
)

func TestParseAssignmentStrategies(t *testing.T) {
	userData := []byte("org.apache.kafka.clients.consumer.RangeAssignor,org.apache.kafka.clients.consumer.CooperativeStickyAssignor")
	got := parseAssignmentStrategies(userData)
	want := []string{"Range", "CooperativeSticky"}
	if len(got) != len(want) {
		t.Fatalf("expected %v, got %v", want, got)
	}
	slices.Sort(got)
	slices.Sort(want)
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("expected %v, got %v", want, got)
		}
	}
}

func TestStrategiesFromProtocolName(t *testing.T) {
	got := strategiesFromProtocolName("range")
	if len(got) != 1 || got[0] != "Range" {
		t.Fatalf("expected Range, got %v", got)
	}
	got = strategiesFromProtocolName("cooperative-sticky")
	if len(got) != 1 || got[0] != "CooperativeSticky" {
		t.Fatalf("expected CooperativeSticky, got %v", got)
	}
	if rebalanceTypeFromProtocolName("cooperative-sticky") != "cooperative" {
		t.Fatal("cooperative-sticky should be cooperative rebalance")
	}
	if rebalanceTypeFromProtocolName("range") != "eager" {
		t.Fatal("range should be eager rebalance")
	}
}

func TestRebalanceTypeFromStrategies(t *testing.T) {
	if rebalanceTypeFromStrategies([]string{"Range"}, 0, false) != "eager" {
		t.Fatal("Range should be eager")
	}
	if rebalanceTypeFromStrategies([]string{"CooperativeSticky"}, 0, false) != "cooperative" {
		t.Fatal("CooperativeSticky should be cooperative")
	}
	if rebalanceTypeFromStrategies(nil, 1, true) != "cooperative" {
		t.Fatal("metadata v1 with owned partitions should be cooperative")
	}
}
