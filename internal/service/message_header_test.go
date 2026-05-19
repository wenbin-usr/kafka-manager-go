package service

import (
	"testing"

	"github.com/segmentio/kafka-go"
)

func TestEncodeHeaderValue(t *testing.T) {
	text, enc := encodeHeaderValue([]byte("trace-id-123"))
	if enc != "utf8" || text != "trace-id-123" {
		t.Fatalf("utf8: got %q %q", text, enc)
	}

	b64, enc := encodeHeaderValue([]byte{0x00, 0x01, 0x02})
	if enc != "base64" || b64 == "" {
		t.Fatalf("base64: got %q %q", b64, enc)
	}
}

func TestParseMessageHeaders(t *testing.T) {
	headers := parseMessageHeaders([]kafka.Header{
		{Key: "b", Value: []byte("2")},
		{Key: "a", Value: []byte("1")},
	})
	if len(headers) != 2 || headers[0].Key != "a" || headers[1].Key != "b" {
		t.Fatalf("unexpected order: %+v", headers)
	}

	if parseMessageHeaders(nil) != nil {
		t.Fatal("expected nil for empty headers")
	}
}
