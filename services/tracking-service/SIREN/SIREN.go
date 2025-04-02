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

type AlertEntity struct {
	ID              string    `bson:"identifier"` // From the alert VTEC, it's Office+Phenomena+Significance+EventTrackingNumber+Year
	CapID           string    `bson:"capID"`
	LastUpdated     time.Time `bson:"lastUpdated"`
	AreasReferenced []string  `bson:"areasReferenced"`
	Active          bool      `bson:"active"`
	History         any       `bson:"history,omitempty"`
}

type AlertHistory struct {
	ID           string         `bson:"identifier"`
	Action       NWS.ActionCode `bson:"action"`
	IssuanceTime time.Time      `bson:"issuanceTime"`
	ExpireTime   time.Time      `bson:"expireTime"`
	Areas        []string       `bson:"areas"`
	ChildIDs     []string       `bson:"childIDs,omitempty"`
}
