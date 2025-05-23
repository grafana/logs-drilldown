package flog

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"strings"
	"time"

	"github.com/brianvoe/gofakeit"
	"github.com/grafana/loki/pkg/push"
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
  // JSONLogFormat : {"host": "{host}", "user-identifier": "{user-identifier}", "datetime": "{datetime}", "method": "{method}", "request": "{request}", "protocol": "{protocol}", "status": {status}, "bytes": {bytes}, "referer": "{referer}", "_25values": "{_25values}", "msg": "{msg}", "nested_object": "{nested_object}"}
	JSONLogFormat         = `{"host":"%s", "user-identifier":"%s", "datetime":"%s", "method": "%s", "request": "%s", "protocol":"%s", "status":%d, "bytes":"%dMB", "referer": "%s", "_25values": %d, "msg":"%s", "nested_object": %s}`
	ShoppingCartLogFormat = "Order %d successfully placed, customerId: %s, price: %f, paymentMethod: %s, shippingMethod: %s, shippingCountry: %s"
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
	BaseObject
}

type DeeplyNestedObject struct {
	BaseObject
	ExtraDeeplyNestedObject `json:"extraDeeplyNestedObject"`
}

type BaseObject struct {
	Method         string   `json:"method"`
	Url            string   `json:"url"`
	NumArray       []int    `json:"numArray"`
	StrArray       []string `json:"strArray"`
	UserIdentifier string   `json:"user-identifier"`
}

type NestedJsonObject struct {
	BaseObject
	DeeplyNestedObject `json:"deeplyNestedObject"`
}

// Helper function to initialize BaseObject
func newBaseObject() BaseObject {
	return BaseObject{
		Method:         gofakeit.HTTPMethod(),
		Url:            gofakeit.URL(),
		UserIdentifier: gofakeit.Username(),
		NumArray:       []int{gofakeit.Number(0, 30000), gofakeit.Number(0, 30000), gofakeit.Number(0, 30000)},
		StrArray:       []string{gofakeit.Word(), gofakeit.Word(), gofakeit.Word()},
	}
}

var sentences = []string{
	"I'm a little teapot",
	"Here is the content of the teapot",
	"I'm another little teapot",
	"The flag is green",
	"The flag is red",
}

var sentenceWeights = []int{
	10, // "I'm a little teapot" has 10x weight
	1,  // "Here is the content of the teapot" has 1x weight
	2,  // "I'm another little teapot" has 2x weight
	5,  // "The flag is green" has 5x weight
	7,  // "The flag is red" has 7x weight
}

// weightedRandomSentence returns a random sentence from the sentences slice with weights
func weightedRandomSentence() string {
	// Calculate total weight
	totalWeight := 0
	for _, weight := range sentenceWeights {
		totalWeight += weight
	}

	// Generate random number between 0 and totalWeight
	r := rand.Intn(totalWeight)

	// Find the sentence based on the random number
	for i, weight := range sentenceWeights {
		r -= weight
		if r < 0 {
			return sentences[i]
		}
	}

	// Fallback (should never reach here)
	return sentences[0]
}

// NewJSONLogFormat creates a log string with json log format
func NewJSONLogFormat(t time.Time, URI string, statusCode int) string {
	nestedJsonObject := &NestedJsonObject{
		BaseObject: newBaseObject(),
		DeeplyNestedObject: DeeplyNestedObject{
			BaseObject: newBaseObject(),
			ExtraDeeplyNestedObject: ExtraDeeplyNestedObject{
				BaseObject: newBaseObject(),
			},
		},
	}
	nestedJson, _ := json.Marshal(nestedJsonObject)

  // JSONLogFormat : {"host": "{host}", "user-identifier": "{user-identifier}", "datetime": "{datetime}", "method": "{method}", "request": "{request}", "protocol": "{protocol}", "status": {status}, "bytes": {bytes}, "referer": "{referer}", "_25values": "{_25values}", "msg": "{msg}", "nested_object": "{nested_object}"}
	return fmt.Sprintf(
		JSONLogFormat,
		ips[rand.Intn(len(ips))],
		RandAuthUserID(),
		t.Format(CommonLog),
		gofakeit.HTTPMethod(),
		URI,
		RandHTTPVersion(),
		statusCode,
		gofakeit.Number(0, 300),
		gofakeit.URL(),
		gofakeit.Number(0, 25),
		weightedRandomSentence(),
		nestedJson,
	)
}

// "Order %d successfully placed, customerId: %s, price: %f, paymentMethod: %s, shippingMethod: %s, shippingCountry: %s"
func NewShoppingCart(t time.Time) string {
	return fmt.Sprintf(
		ShoppingCartLogFormat,
		gofakeit.Number(1, 10000),
		gofakeit.UUID(),
		gofakeit.Price(10.0, 1000.0),
		gofakeit.CreditCardType(),
		RandShippingMethod(),
		gofakeit.CountryAbr(),
	)
}

func NewShoppingCartWithMetadata(t time.Time) (string, push.LabelsAdapter) {
	orderId := gofakeit.Number(1, 10000)
	customerId := gofakeit.UUID()
	price := gofakeit.Price(10.0, 1000.0)
	paymentMethod := gofakeit.CreditCardType()
	shippingMethod := RandShippingMethod()

  var country string
  if price > 700.0 { 
    country = "US"
  } else {
	  country = gofakeit.CountryAbr()
  }

	return fmt.Sprintf(
			ShoppingCartLogFormat,
			orderId,
			customerId,
			price,
			paymentMethod,
			shippingMethod,
			country,
		), push.LabelsAdapter{
			{Name: "orderId", Value: fmt.Sprintf("%d", orderId)},
			{Name: "customerId", Value: customerId},
			{Name: "price", Value: fmt.Sprintf("%f", price)},
			{Name: "paymentMethod", Value: paymentMethod},
			{Name: "shippingMethod", Value: shippingMethod},
			{Name: "shippingCountry", Value: country},
		}
}
