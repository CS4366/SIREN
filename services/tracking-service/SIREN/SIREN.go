package SIREN

import (
	"time"
	"trackingService/NWS"
)

type SirenAlertHistory struct {
	RecievedAt            time.Time      `bson:"recievedAt",msgpack:"recievedAt"`
	VtecActionDescription string         `bson:"vtecActionDescription",msgpack:"vtecActionDescription"`
	VtecAction            NWS.ActionCode `bson:"vtecAction",msgpack:"vtecAction"`
	AppliesTo             []string       `bson:"appliesTo,omitempty",msgpack:"appliesTo,omitempty"`
	CapID                 string         `bson:"capID,omitempty",msgpack:"capID,omitempty"`
	ExpiresAt             time.Time      `bson:"expiresAt",msgpack:"expiresAt"`
}

type SirenAlert struct {
	Identifier         string              `bson:"identifier",msgpack:"identifier"`
	MostRecentCAP      string              `bson:"mostRecentCAP,omitempty",msgpack:"mostRecentCAP,omitempty"`
	State              string              `bson:"state",msgpack:"state"`
	Expires            time.Time           `bson:"expires",msgpack:"expires"`
	MostRecentSentTime time.Time           `bson:"mostRecentSentTime",msgpack:"mostRecentSentTime"`
	LastUpdatedTime    time.Time           `bson:"lastUpdatedTime",msgpack:"lastUpdatedTime"`
	UpgradedTo         string              `bson:"upgradedTo,omitempty",msgpack:"upgradedTo,omitempty"`
	History            []SirenAlertHistory `bson:"history",msgpack:"history"`
	Areas              []string            `bson:"areas",msgpack:"areas"`
}

type SirenAlertPushNotification struct {
	Identifier string   `bson:"identifier",msgpack:"identifier"`
	Event      string   `bson:"event",msgpack:"event"`
	Areas      []string `bson:"areas",msgpack:"areas"`
	Sender     string   `bson:"sender",msgpack:"sender"`
	EventCode  string   `bson:"code",msgpack:"code"`
	Action     string   `bson:"action",msgpack:"action"`
}

type MiniCAP struct {
	Identifier        string
	VTEC              NWS.VTEC
	Areas             []string
	References        []NWS.Reference
	ExpiredReferences []NWS.Reference
	Sent              time.Time
	Expires           time.Time
}

type Rectification struct {
	History []SirenAlertHistory
	Areas   []string
}
