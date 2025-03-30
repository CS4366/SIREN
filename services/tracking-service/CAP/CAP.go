package CAP

import "time"

type Alert struct {
	Identifier      string      `json:"identifier"`
	SirenIdentifier string      `json:"sirenIdentifier"`
	Sender          string      `json:"sender"`
	Sent            time.Time   `json:"sent"`
	Status          string      `json:"status"`
	MsgType         string      `json:"msgType"`
	Source          string      `json:"source"`
	Scope           string      `json:"scope"`
	Restriction     string      `json:"restriction,omitempty"`
	Addresses       string      `json:"addresses,omitempty"`
	Code            []string    `json:"code"`
	Note            string      `json:"note,omitempty"`
	References      []Reference `json:"references,omitempty"`
	Incidents       string      `json:"incidents,omitempty"`
	Info            []Info      `json:"info"`
}

type Reference struct {
	Sender     string    `json:"sender"`
	Identifier string    `json:"identifier"`
	Sent       time.Time `json:"sent"`
}

type Info struct {
	Language     string      `json:"language"`
	Categories   Categories  `json:"categories"`
	Event        string      `json:"event"`
	ResponseType string      `json:"responseType"`
	Urgency      string      `json:"urgency"`
	Severity     string      `json:"severity"`
	Certainty    string      `json:"certainty"`
	Audience     string      `json:"audience,omitempty"`
	EventCode    EventCode   `json:"eventCode"`
	Effective    time.Time   `json:"effective"`
	Onset        time.Time   `json:"onset"`
	Expires      time.Time   `json:"expires"`
	SenderName   string      `json:"senderName"`
	Headline     string      `json:"headline"`
	Description  string      `json:"description"`
	Instruction  string      `json:"instruction"`
	Web          string      `json:"web"`
	Contact      string      `json:"contact"`
	Parameters   *Parameters `json:"parameters,omitempty"`
	Resource     []Resource  `json:"resource,omitempty"`
	Area         Area        `json:"area"`
}

type Categories struct {
	Geo       bool `json:"Geo"`
	Met       bool `json:"Met"`
	Safety    bool `json:"Safety"`
	Rescue    bool `json:"Rescue"`
	Fire      bool `json:"Fire"`
	Health    bool `json:"Health"`
	Env       bool `json:"Env"`
	Transport bool `json:"Transport"`
	Infra     bool `json:"Infra"`
	CBRNE     bool `json:"CBRNE"`
	Other     bool `json:"Other"`
}

type EventCode struct {
	SAME string `json:"SAME"`
	NWS  string `json:"NWS"`
}

type Parameters struct {
	AWIPSidentifier          string                  `json:"AWIPSidentifier,omitempty"`
	WMOidentifier            string                  `json:"WMOidentifier,omitempty"`
	NWSheadline              string                  `json:"NWSheadline,omitempty"`
	EventMotionDescription   *EventMotionDescription `json:"eventMotionDescription,omitempty"`
	WindThreat               string                  `json:"windThreat,omitempty"`
	MaxWindGust              float64                 `json:"maxWindGust,omitempty"`
	HailThreat               string                  `json:"hailThreat,omitempty"`
	MaxHailSize              float64                 `json:"maxHailSize,omitempty"`
	ThunderstormDamageThreat string                  `json:"thunderstormDamageThreat,omitempty"`
	TornadoDetection         string                  `json:"tornadoDetection,omitempty"`
	TornadoDamageThreat      string                  `json:"tornadoDamageThreat,omitempty"`
	FlashFloodDetection      string                  `json:"flashFloodDetection,omitempty"`
	FlashFloodDamageThreat   string                  `json:"flashFloodDamageThreat,omitempty"`
	SnowSquallDetection      string                  `json:"snowSquallDetection,omitempty"`
	SnowSquallImpact         string                  `json:"snowSquallImpact,omitempty"`
	WaterspoutDetection      string                  `json:"waterspoutDetection,omitempty"`
	BlockChannels            BlockChannels           `json:"blockChannels,omitempty"`
	EASORG                   string                  `json:"EAS-ORG,omitempty"`
	VTEC                     string                  `json:"VTEC,omitempty"`
	EventEndingTime          time.Time               `json:"eventEndingTime,omitempty"`
	WEAHandlingCode          string                  `json:"WEAHandling,omitempty"`
	CMAMtext                 string                  `json:"CMAMtext,omitempty"`
	CMAMlongtext             string                  `json:"CMAMlongtext,omitempty"`
	ExpiredReferences        []Reference             `json:"expiredReferences,omitempty"`
}

type EventMotionDescription struct {
	Timestamp time.Time    `json:"timestamp"`
	Direction string       `json:"direction"` // Expected to be a three-digit string (non-`000`)
	Speed     string       `json:"speed"`     // A one- or two-digit value (without leading zero unless `0`)
	Location  []Coordinate `json:"location"`  // One or more coordinate pairs
}

type Coordinate struct {
	Lat float64 `json:"lat"`
	Lon float64 `json:"lon"`
}

type BlockChannels struct {
	CMAS   bool `json:"CMAS"`
	EAS    bool `json:"EAS"`
	NWEM   bool `json:"NWEM"`
	Public bool `json:"Public"`
}

type Resource struct {
	ResourceDesc string `json:"resourceDesc"`
	MimeType     string `json:"mimeType"`
	Size         int    `json:"size"`
	URI          string `json:"uri"`
	DerefURI     string `json:"derefUri"`
	Digest       string `json:"digest"`
}

type Area struct {
	Description string          `json:"description"`
	Polygon     *GeoJSONPolygon `json:"polygon,omitempty"`
	Geocodes    Geocodes        `json:"geocodes"`
}

type GeoJSONPolygon struct {
	Type        string        `json:"type"` // should always be `Polygon`
	Coordinates [][][]float64 `json:"coordinates"`
}

type Geocodes struct {
	UGC  []string `json:"UGC"`
	SAME []string `json:"SAME"`
}
