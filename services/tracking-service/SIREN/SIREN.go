package SIREN

import (
	"time"
	"trackingService/NWS"
)

type SirenAlertHistory struct {
	RecievedAt            time.Time      `bson:"recievedAt"`
	VtecActionDescription string         `bson:"vtecActionDescription"`
	VtecAction            NWS.ActionCode `bson:"vtecAction"`
	AppliesTo             []string       `bson:"appliesTo,omitempty"`
	CapID                 string         `bson:"capID,omitempty"`
}

type SirenAlert struct {
	Identifier         string              `bson:"identifier"`
	MostRecentCAP      string              `bson:"mostRecentCAP,omitempty"`
	State              string              `bson:"state"`
	MostRecentSentTime time.Time           `bson:"mostRecentSentTime"`
	LastUpdatedTime    time.Time           `bson:"lastUpdatedTime"`
	UpgradedTo         string              `bson:"upgradedTo,omitempty"`
	History            []SirenAlertHistory `bson:"history"`
	Areas              []string            `bson:"areas"`
}

type MiniCAP struct {
	Identifier        string
	VTEC              NWS.VTEC
	Areas             []string
	References        []NWS.Reference
	ExpiredReferences []NWS.Reference
	Sent              time.Time
}

type Rectification struct {
	History []SirenAlertHistory
	Areas   []string
}
