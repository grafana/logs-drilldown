package log

import (
	"fmt"
	"log/syslog"
	"net"
	"os"
	"time"

	"github.com/grafana/loki/pkg/push"
	"github.com/prometheus/common/model"
)

// SyslogLogger implements the Logger interface and handles logging to syslog
type SyslogLogger struct {
	conn     net.Conn
	facility syslog.Priority
	hostname string
}

// NewSyslogLogger creates a new logger that writes to syslog
func NewSyslogLogger(conn net.Conn, facility syslog.Priority) *SyslogLogger {
	hostname, err := os.Hostname()
	if err != nil {
		hostname = "unknown-host"
	}

	logger := &SyslogLogger{
		conn:     conn,
		hostname: hostname,
		facility: facility,
	}

	return logger
}

// Handle implements the Logger interface
func (s *SyslogLogger) Handle(labels model.LabelSet, timestamp time.Time, message string) error {
	return s.HandleWithMetadata(labels, timestamp, message, nil)
}

// HandleWithMetadata implements the Logger interface
func (s *SyslogLogger) HandleWithMetadata(labels model.LabelSet, timestamp time.Time, message string, metadata push.LabelsAdapter) error {
	level, ok := labels["level"]
	if !ok {
		level = model.LabelValue("info")
	}

	serviceName, ok := labels["service_name"]
	if !ok {
		serviceName = model.LabelValue("unknown_service")
	}

	// Map log level to syslog severity
	severityNum := getSeverityNumber(string(level))

	// Extract facility number (high 3 bits of priority)
	facilityNum := int(s.facility) >> 3

	var metadataStr string
	if len(metadata) > 0 {
		metadataStr = "[meta@1234"
		for _, label := range metadata {
			metadataStr += fmt.Sprintf(` %s="%s"`, label.Name, label.Value)
		}
		metadataStr += "]"
	}

	// Format message in RFC5424 format
	rfc5424Msg := formatRFC5424Message(
		s.hostname,
		string(serviceName),
		fmt.Sprintf("%d", os.Getpid()),
		"-", // No message ID
		facilityNum,
		severityNum,
		metadataStr,
		message,
	)

	_, err := s.conn.Write([]byte(rfc5424Msg))
	return err

}

// formatRFC5424Message formats a message according to RFC5424 syslog protocol
// Format: <PRI>VERSION TIMESTAMP HOSTNAME APP-NAME PROCID MSGID STRUCTURED-DATA MSG
func formatRFC5424Message(hostname, appName, procID, msgID string, facilityNum, severityNum int, metadata, message string) string {
	// Calculate priority value (facility * 8 + severity)
	priority := facilityNum*8 + severityNum

	// Create RFC5424 timestamp (YYYY-MM-DDTHH:MM:SS.SSSZ)
	timestamp := time.Now().UTC().Format("2006-01-02T15:04:05.000Z")

	// Replace empty values with NILVALUE as per RFC5424
	if hostname == "" {
		hostname = "-"
	}
	if appName == "" {
		appName = "-"
	}
	if procID == "" {
		procID = "-"
	}
	if msgID == "" {
		msgID = "-"
	}
	if metadata == "" {
		metadata = "-"
	}

	// Format the RFC5424 message - strictly adhering to RFC5424 format
	// <PRI>VERSION TIMESTAMP HOSTNAME APP-NAME PROCID MSGID STRUCTURED-DATA MSG
	return fmt.Sprintf("<%d>1 %s %s %s %s %s %s %s",
		priority,
		timestamp,
		hostname,
		appName,
		procID,
		msgID,
		metadata,
		message,
	)
}

// getSeverityNumber converts a textual log level to a syslog severity number
func getSeverityNumber(level string) int {
	switch level {
	case "emerg":
		return 0
	case "alert":
		return 1
	case "crit":
		return 2
	case "error":
		return 3
	case "warn":
		return 4
	case "notice":
		return 5
	case "info":
		return 6
	case "debug":
		return 7
	default:
		return 6 // Default to info
	}
}
