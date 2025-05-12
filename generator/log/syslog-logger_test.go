package log

import (
	"errors"
	"fmt"
	"log/syslog"
	"net"
	"testing"
	"time"

	"github.com/grafana/loki/pkg/push"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
)

func TestSyslogLoggerImplementsLoggerInterface(t *testing.T) {
	// Test that SyslogLogger implements the Logger interface
	var logger Logger = &SyslogLogger{}
	assert.NotNil(t, logger)
}

func TestSyslogLoggerHandle(t *testing.T) {
	mockConn := &MockConn{}
	logger := NewSyslogLogger(mockConn, syslog.LOG_DAEMON)

	labels := model.LabelSet{
		"level":        "info",
		"service_name": "test-service",
	}
	timestamp := time.Now()
	message := "Test log message"

	// Call the method
	err := logger.Handle(labels, timestamp, message)

	// Assert
	assert.NoError(t, err)
	assert.Equal(t, 1, mockConn.WriteCount)
	assert.Contains(t, string(mockConn.LastWrite), message)
	assert.Contains(t, string(mockConn.LastWrite), "test-service")

	priority := (int(syslog.LOG_DAEMON>>3) * 8) + int(getSeverityNumber("info"))
	assert.Contains(t, string(mockConn.LastWrite), fmt.Sprintf("<%d>", priority))
}

func TestSyslogLoggerHandleWithMetadata(t *testing.T) {
	mockConn := &MockConn{}
	logger := NewSyslogLogger(mockConn, syslog.LOG_DAEMON)

	labels := model.LabelSet{
		"level":        "error",
		"service_name": "test-service",
	}
	timestamp := time.Now()
	message := "Test log message with metadata"
	metadata := push.LabelsAdapter{
		{Name: "trace_id", Value: "1234567890"},
		{Name: "request_id", Value: "abcdef"},
	}

	// Call the method
	err := logger.HandleWithMetadata(labels, timestamp, message, metadata)

	// Assert
	assert.NoError(t, err)
	assert.Equal(t, 1, mockConn.WriteCount)
	assert.Contains(t, string(mockConn.LastWrite), message)
	assert.Contains(t, string(mockConn.LastWrite), "test-service")
	assert.Contains(t, string(mockConn.LastWrite), `trace_id="1234567890"`)
	assert.Contains(t, string(mockConn.LastWrite), `request_id="abcdef"`)
}

func TestSyslogLoggerHandleWriteError(t *testing.T) {
	expectedErr := errors.New("write error")
	mockConn := &MockConn{
		WriteFunc: func(p []byte) (n int, err error) {
			return 0, expectedErr
		},
	}
	logger := NewSyslogLogger(mockConn, syslog.LOG_DAEMON)

	labels := model.LabelSet{"level": "info"}
	timestamp := time.Now()

	// Call the method
	err := logger.Handle(labels, timestamp, "test")

	// Assert
	assert.Equal(t, expectedErr, err)
}

// MockConn is a simpler mock for testing
type MockConn struct {
	WriteFunc  func(p []byte) (n int, err error)
	LastWrite  []byte
	WriteCount int
	CloseCount int
}

// Write writes data to the connection.
// Write can be made to time out and return an error after a fixed
// time limit; see SetDeadline and SetWriteDeadline.
func (m *MockConn) Write(b []byte) (n int, err error) {
	m.WriteCount++
	m.LastWrite = b
	if m.WriteFunc != nil {
		return m.WriteFunc(b)
	}
	return len(b), nil
}

// Close closes the connection.
// Any blocked Read or Write operations will be unblocked and return errors.
func (m *MockConn) Close() error {
	panic("not implemented")
}

func (m *MockConn) Read(b []byte) (n int, err error) {
	panic("not implemented")
}

func (m *MockConn) LocalAddr() net.Addr {
	panic("not implemented")
}

func (m *MockConn) RemoteAddr() net.Addr {
	panic("not implemented")
}

func (m *MockConn) SetDeadline(t time.Time) error {
	panic("not implemented")
}

func (m *MockConn) SetReadDeadline(t time.Time) error {
	panic("not implemented")
}

func (m *MockConn) SetWriteDeadline(t time.Time) error {
	panic("not implemented")
}
