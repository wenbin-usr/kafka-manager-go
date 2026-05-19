package service

import "testing"

func TestIncreaseTopicPartitionsValidation(t *testing.T) {
	err := IncreaseTopicPartitions("", "t", 0)
	if err == nil {
		t.Fatal("expected error for zero partitions")
	}
}
