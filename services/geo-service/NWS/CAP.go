package NWS

import (
	"strings"
	"time"
)

type Alert struct {
	Identifier  string      `msgpack:"identifier"`
	Sender      string      `msgpack:"sender"`
	Sent        time.Time   `msgpack:"sent"`
	Status      string      `msgpack:"status"`
	MsgType     string      `msgpack:"msgType"`
	Source      string      `msgpack:"source"`
	Scope       string      `msgpack:"scope"`
	Restriction string      `msgpack:"restriction,omitempty"`
	Addresses   string      `msgpack:"addresses,omitempty"`
	Code        []string    `msgpack:"code"`
	Note        string      `msgpack:"note,omitempty"`
	References  []Reference `msgpack:"references,omitempty"`
	Incidents   string      `msgpack:"incidents,omitempty"`
	Info        Info        `msgpack:"info"`
	InfoSpanish *Info       `msgpack:"infoSpanish,omitempty"`
}

type Reference struct {
	Sender     string    `msgpack:"sender"`
	Identifier string    `msgpack:"identifier"`
	Sent       time.Time `msgpack:"sent"`
}

type Info struct {
	Language     string      `msgpack:"language"`
	Categories   Categories  `msgpack:"categories"`
	Event        string      `msgpack:"event"`
	ResponseType string      `msgpack:"responseType"`
	Urgency      string      `msgpack:"urgency"`
	Severity     string      `msgpack:"severity"`
	Certainty    string      `msgpack:"certainty"`
	Audience     string      `msgpack:"audience,omitempty"`
	EventCode    EventCode   `msgpack:"eventCode"`
	Effective    time.Time   `msgpack:"effective"`
	Onset        time.Time   `msgpack:"onset"`
	Expires      time.Time   `msgpack:"expires"`
	SenderName   string      `msgpack:"senderName"`
	Headline     string      `msgpack:"headline"`
	Description  string      `msgpack:"description"`
	Instruction  string      `msgpack:"instruction"`
	Web          string      `msgpack:"web"`
	Contact      string      `msgpack:"contact"`
	Parameters   *Parameters `msgpack:"parameters,omitempty"`
	Resource     []Resource  `msgpack:"resource,omitempty"`
	Area         Area        `msgpack:"area"`
}

type Categories struct {
	Geo       bool `msgpack:"Geo"`
	Met       bool `msgpack:"Met"`
	Safety    bool `msgpack:"Safety"`
	Rescue    bool `msgpack:"Rescue"`
	Fire      bool `msgpack:"Fire"`
	Health    bool `msgpack:"Health"`
	Env       bool `msgpack:"Env"`
	Transport bool `msgpack:"Transport"`
	Infra     bool `msgpack:"Infra"`
	CBRNE     bool `msgpack:"CBRNE"`
	Other     bool `msgpack:"Other"`
}

type EventCode struct {
	SAME string `msgpack:"SAME"`
	NWS  string `msgpack:"NWS"`
}

type Parameters struct {
	AWIPSidentifier          string                  `msgpack:"AWIPSidentifier,omitempty"`
	WMOidentifier            string                  `msgpack:"WMOidentifier,omitempty"`
	NWSheadline              string                  `msgpack:"NWSheadline,omitempty"`
	EventMotionDescription   *EventMotionDescription `msgpack:"eventMotionDescription,omitempty"`
	WindThreat               string                  `msgpack:"windThreat,omitempty"`
	MaxWindGust              float64                 `msgpack:"maxWindGust,omitempty"`
	HailThreat               string                  `msgpack:"hailThreat,omitempty"`
	MaxHailSize              float64                 `msgpack:"maxHailSize,omitempty"`
	ThunderstormDamageThreat string                  `msgpack:"thunderstormDamageThreat,omitempty"`
	TornadoDetection         string                  `msgpack:"tornadoDetection,omitempty"`
	TornadoDamageThreat      string                  `msgpack:"tornadoDamageThreat,omitempty"`
	FlashFloodDetection      string                  `msgpack:"flashFloodDetection,omitempty"`
	FlashFloodDamageThreat   string                  `msgpack:"flashFloodDamageThreat,omitempty"`
	SnowSquallDetection      string                  `msgpack:"snowSquallDetection,omitempty"`
	SnowSquallImpact         string                  `msgpack:"snowSquallImpact,omitempty"`
	WaterspoutDetection      string                  `msgpack:"waterspoutDetection,omitempty"`
	BlockChannels            BlockChannels           `msgpack:"blockChannels,omitempty"`
	EASORG                   string                  `msgpack:"EAS-ORG,omitempty"`
	VTEC                     string                  `msgpack:"VTEC,omitempty"`
	EventEndingTime          time.Time               `msgpack:"eventEndingTime,omitempty"`
	WEAHandlingCode          string                  `msgpack:"WEAHandling,omitempty"`
	CMAMtext                 string                  `msgpack:"CMAMtext,omitempty"`
	CMAMlongtext             string                  `msgpack:"CMAMlongtext,omitempty"`
	ExpiredReferences        []Reference             `msgpack:"expiredReferences,omitempty"`
}

type EventMotionDescription struct {
	Timestamp time.Time    `msgpack:"timestamp"`
	Direction string       `msgpack:"direction"` // Expected to be a three-digit string (non-`000`)
	Speed     string       `msgpack:"speed"`     // A one- or two-digit value (without leading zero unless `0`)
	Location  []Coordinate `msgpack:"location"`  // One or more coordinate pairs
}

type Coordinate struct {
	Lat float64 `msgpack:"lat"`
	Lon float64 `msgpack:"lon"`
}

type BlockChannels struct {
	CMAS   bool `msgpack:"CMAS"`
	EAS    bool `msgpack:"EAS"`
	NWEM   bool `msgpack:"NWEM"`
	Public bool `msgpack:"Public"`
}

type Resource struct {
	ResourceDesc string `msgpack:"resourceDesc"`
	MimeType     string `msgpack:"mimeType"`
	Size         int    `msgpack:"size"`
	URI          string `msgpack:"uri"`
	DerefURI     string `msgpack:"derefUri"`
	Digest       string `msgpack:"digest"`
}

type Area struct {
	Description string          `msgpack:"description"`
	Polygon     *GeoJSONPolygon `msgpack:"polygon,omitempty"`
	Geocodes    Geocodes        `msgpack:"geocodes"`
}

type GeoJSONPolygon struct {
	Type        string        `msgpack:"type"` // should always be `Polygon`
	Coordinates [][][]float64 `msgpack:"coordinates"`
}

type Geocodes struct {
	UGC  []string `msgpack:"UGC"`
	SAME []string `msgpack:"SAME"`
}

func ConvertReferences(refs string) []Reference {
	var out []Reference
	parts := strings.Fields(refs)
	for _, ref := range parts {
		tokens := strings.Split(ref, ",")
		if len(tokens) != 3 {
			continue
		}
		sent, err := time.Parse(time.RFC3339, tokens[2])
		if err != nil {
			continue
		}
		out = append(out, Reference{
			Sender:     tokens[0],
			Identifier: tokens[1],
			Sent:       sent,
		})
	}
	return out
}
