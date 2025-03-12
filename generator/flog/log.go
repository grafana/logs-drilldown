package flog

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"strings"
	"time"

	"github.com/brianvoe/gofakeit"
)

const (
	// ApacheCommonLog : {host} {user-identifier} {auth-user-id} [{datetime}] "{method} {request} {protocol}" {response-code} {bytes}
	ApacheCommonLog = "%s - %s [%s] \"%s %s %s\" %d %d"
	// ApacheCombinedLog : {host} {user-identifier} {auth-user-id} [{datetime}] "{method} {request} {protocol}" {response-code} {bytes} "{referrer}" "{agent}"
	ApacheCombinedLog = "%s - %s [%s] \"%s %s %s\" %d %d \"%s\" \"%s\""
	// ApacheErrorLog : [{timestamp}] [{module}:{severity}] [pid {pid}:tid {thread-id}] [client %{client}:{port}] %{message}
	ApacheErrorLog = "[%s] [%s:%s] [pid %d:tid %d] [client %s:%d] %s"
	// RFC3164Log : <priority>{timestamp} {hostname} {application}[{pid}]: {message}
	RFC3164Log = "<%d>%s %s %s[%d]: %s"
	// RFC5424Log : <priority>{version} {iso-timestamp} {hostname} {application} {pid} {message-id} {structured-data} {message}
	RFC5424Log = "<%d>%d %s %s %s %d ID%d %s %s"
	// CommonLogFormat : {host} {user-identifier} {auth-user-id} [{datetime}] "{method} {request} {protocol}" {response-code} {bytes}
	CommonLogFormat = "%s - %s [%s] \"%s %s %s\" %d %d"
	// JSONLogFormat : {"host": "{host}", "user-identifier": "{user-identifier}", "datetime": "{datetime}", "method": "{method}", "request": "{request}", "protocol": "{protocol}", "status": {status}, "bytes": {bytes}, "referer": "{referer}", "_25values": "{_25values}"
	JSONLogFormat = `{"host":"%s", "user-identifier":"%s", "datetime":"%s", "method": "%s", "request": "%s", "protocol":"%s", "status":%d, "bytes":%d, "referer": "%s", "_25values": %d, "nested_object": %s}`
)

// NewApacheCommonLog creates a log string with apache common log format
func NewApacheCommonLog(t time.Time, URI string, statusCode int) string {
	return fmt.Sprintf(
		ApacheCommonLog,
		gofakeit.IPv4Address(),
		RandAuthUserID(),
		t.Format(Apache),
		gofakeit.HTTPMethod(),
		URI,
		RandHTTPVersion(),
		statusCode,
		gofakeit.Number(0, 30000),
	)
}

var ips = []string{
	gofakeit.IPv4Address(),
	gofakeit.IPv4Address(),
	gofakeit.IPv4Address(),
	gofakeit.IPv4Address(),
	gofakeit.IPv4Address(),
}

func FakeIP() string {
	return ips[rand.Intn(len(ips))]
}

// NewApacheCombinedLog creates a log string with apache combined log format
func NewApacheCombinedLog(t time.Time, URI string, statusCode int) string {
	return fmt.Sprintf(
		ApacheCombinedLog,
		ips[rand.Intn(len(ips))],
		RandAuthUserID(),
		t.Format(Apache),
		gofakeit.HTTPMethod(),
		URI,
		RandHTTPVersion(),
		statusCode,
		gofakeit.Number(30, 100000),
		gofakeit.URL(),
		gofakeit.UserAgent(),
	)
}

// NewApacheErrorLog creates a log string with apache error log format
func NewApacheErrorLog(t time.Time) string {
	return fmt.Sprintf(
		ApacheErrorLog,
		t.Format(ApacheError),
		gofakeit.Word(),
		gofakeit.LogLevel("apache"),
		gofakeit.Number(1, 10000),
		gofakeit.Number(1, 10000),
		gofakeit.IPv4Address(),
		gofakeit.Number(1, 65535),
		gofakeit.HackerPhrase(),
	)
}

// NewRFC3164Log creates a log string with syslog (RFC3164) format
func NewRFC3164Log(t time.Time) string {
	return fmt.Sprintf(
		RFC3164Log,
		gofakeit.Number(0, 191),
		t.Format(RFC3164),
		strings.ToLower(gofakeit.Username()),
		gofakeit.Word(),
		gofakeit.Number(1, 10000),
		gofakeit.HackerPhrase(),
	)
}

// NewRFC5424Log creates a log string with syslog (RFC5424) format
func NewRFC5424Log(t time.Time) string {
	return fmt.Sprintf(
		RFC5424Log,
		gofakeit.Number(0, 191),
		gofakeit.Number(1, 3),
		t.Format(RFC5424),
		gofakeit.DomainName(),
		gofakeit.Word(),
		gofakeit.Number(1, 10000),
		gofakeit.Number(1, 1000),
		"-", // TODO: structured data
		gofakeit.HackerPhrase(),
	)
}

// NewCommonLogFormat creates a log string with common log format
func NewCommonLogFormat(t time.Time, URI string, statusCode int) string {
	return fmt.Sprintf(
		CommonLogFormat,
		gofakeit.IPv4Address(),
		RandAuthUserID(),
		t.Format(CommonLog),
		gofakeit.HTTPMethod(),
		URI,
		RandHTTPVersion(),
		statusCode,
		gofakeit.Number(0, 30000),
	)
}

type ExtraDeeplyNestedObject struct {
	Method   string   `json:"method"`
	Url      string   `json:"url"`
	NumArray []int    `json:"numArray"`
	StrArray []string `json:"strArray"`
}

type DeeplyNestedObject struct {
	Method                  string   `json:"method"`
	Url                     string   `json:"url"`
	NumArray                []int    `json:"numArray"`
	StrArray                []string `json:"strArray"`
	ExtraDeeplyNestedObject ExtraDeeplyNestedObject
}

type nestedJsonObject struct {
	Method             string   `json:"method"`
	Url                string   `json:"url"`
	NumArray           []int    `json:"numArray"`
	StrArray           []string `json:"strArray"`
	DeeplyNestedObject DeeplyNestedObject
}

// NewJSONLogFormat creates a log string with json log format
func NewJSONLogFormat(t time.Time, URI string, statusCode int) string {
	nestedJsonObject := &nestedJsonObject{
		Method:   gofakeit.HTTPMethod(),
		Url:      gofakeit.URL(),
		NumArray: []int{gofakeit.Number(0, 30000), gofakeit.Number(0, 30000), gofakeit.Number(0, 30000)},
		StrArray: []string{gofakeit.Word(), gofakeit.Word(), gofakeit.Word()},
		DeeplyNestedObject: DeeplyNestedObject{
			Method:   gofakeit.HTTPMethod(),
			Url:      gofakeit.URL(),
			NumArray: []int{gofakeit.Number(0, 30000), gofakeit.Number(0, 30000), gofakeit.Number(0, 30000)},
			StrArray: []string{gofakeit.Word(), gofakeit.Word(), gofakeit.Word()},
			ExtraDeeplyNestedObject: ExtraDeeplyNestedObject{
				Method:   gofakeit.HTTPMethod(),
				Url:      gofakeit.URL(),
				NumArray: []int{gofakeit.Number(0, 30000), gofakeit.Number(0, 30000), gofakeit.Number(0, 30000)},
				StrArray: []string{gofakeit.Word(), gofakeit.Word(), gofakeit.Word()},
			},
		},
	}
	nestedJson, _ := json.Marshal(nestedJsonObject)

	return fmt.Sprintf(
		JSONLogFormat,
		ips[rand.Intn(len(ips))],
		RandAuthUserID(),
		t.Format(CommonLog),
		gofakeit.HTTPMethod(),
		URI,
		RandHTTPVersion(),
		statusCode,
		gofakeit.Number(0, 30000),
		gofakeit.URL(),
		gofakeit.Number(0, 25),
		nestedJson,
	)
}
