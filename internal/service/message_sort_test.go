package service

import (
	"testing"
	"time"

	"kafka-manager-go/internal/model"
)

func TestSortMessagesByTimestamp(t *testing.T) {
	base := time.Date(2024, 1, 1, 12, 0, 0, 0, time.UTC)
	messages := []model.MessageRecord{
		{Timestamp: base.Add(2 * time.Hour)},
		{Timestamp: base},
		{Timestamp: base.Add(time.Hour)},
	}

	sortMessagesByTimestamp(messages, false)
	if !messages[0].Timestamp.Equal(base) ||
		!messages[1].Timestamp.Equal(base.Add(time.Hour)) ||
		!messages[2].Timestamp.Equal(base.Add(2*time.Hour)) {
		t.Fatalf("asc sort failed: %+v", messages)
	}

	sortMessagesByTimestamp(messages, true)
	if !messages[0].Timestamp.Equal(base.Add(2*time.Hour)) ||
		!messages[2].Timestamp.Equal(base) {
		t.Fatalf("desc sort failed: %+v", messages)
	}
}
