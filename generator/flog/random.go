package flog

import (
	"math/rand"
	"net/url"
	"strings"

	"github.com/brianvoe/gofakeit"
)

var ressourceURIs []string

func init() {
	for i := 0; i < 20; i++ {
		ressourceURIs = append(ressourceURIs, randResourceURI())
	}
}

// RandResourceURI generates a random resource URI
func RandResourceURI() string {
	return ressourceURIs[rand.Intn(len(ressourceURIs))]
}

func randResourceURI() string {
	var uri string
	num := gofakeit.Number(1, 4)
	for i := 0; i < num; i++ {
		uri += "/" + url.QueryEscape(gofakeit.BS())
	}
	uri = strings.ToLower(uri)
	return uri
}

// RandAuthUserID generates a random auth user id
func RandAuthUserID() string {
	candidates := []string{"-", strings.ToLower(gofakeit.Username())}
	return candidates[rand.Intn(2)]
}

// RandHTTPVersion returns a random http version
func RandHTTPVersion() string {
	versions := []string{"HTTP/1.0", "HTTP/1.1", "HTTP/2.0"}
	return versions[rand.Intn(3)]
}

func RandShippingMethod() string {
	versions := []string{"express", "ground", "air", "2-day", "next-day"}
	return versions[rand.Intn(5)]
}
