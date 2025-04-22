package NWS

import (
	"time"
)

type JSON = map[string]any

type ApiResponseData struct {
	Context JSON   `json:"@context"`
	Graph   []JSON `json:"@graph"`
}

type CapResponseData struct {
	Properties CapPropertiesData `json:"properties"`
}

type CapPropertiesData struct {
	Id         string            `json:"id"`
	Geocode    CapGeocodeData    `json:"geocode"`
	Parameters CapParametersData `json:"parameters"`
	Sent       time.Time         `json:"sent"`
	Expires    time.Time         `json:"expires"`
	Effective  time.Time         `json:"effective"`
	References []Reference       `json:"references"`
}

type CapGeocodeData struct {
	SAME []string `json:"SAME"`
	UGC  []string `json:"UGC"`
}

type CapParametersData struct {
	VTEC              []string `json:"VTEC"`
	ExpiredReferences []string `json:"expiredReferences"`
}

/**============================================
 *               Helper Functions
 *=============================================**/

// Converts a slice of NWS.Reference to a slice of strings by extracting the Identifier field.
func ConvertReferencesToStrings(references []Reference) []string {
	var result []string
	for _, ref := range references {
		result = append(result, ref.Identifier)
	}
	return result
}
