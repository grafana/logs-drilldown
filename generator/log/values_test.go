package log

import (
	"regexp"
	"testing"
)

var traceIDFormat = regexp.MustCompile(`^[0-9a-f]{32}$`)

func TestNewTraceIDIsLowercaseHex32(t *testing.T) {
	for i := 0; i < 1000; i++ {
		if id := NewTraceID(); !traceIDFormat.MatchString(id) {
			t.Fatalf("trace ID %q is not 32 lowercase hex characters", id)
		}
	}
}

func TestRandTraceIDKeepsTheTempoFormatWhenReusingAndWhenGenerating(t *testing.T) {
	prev := NewTraceID()
	sawPrev, sawNew := false, false
	for i := 0; i < 1000 && !(sawPrev && sawNew); i++ {
		id := RandTraceID(prev)
		if !traceIDFormat.MatchString(id) {
			t.Fatalf("trace ID %q is not 32 lowercase hex characters", id)
		}
		if id == prev {
			sawPrev = true
		} else {
			sawNew = true
		}
	}
	if !sawPrev || !sawNew {
		t.Fatalf("expected RandTraceID to both reuse and generate IDs, reuse=%v new=%v", sawPrev, sawNew)
	}
}
