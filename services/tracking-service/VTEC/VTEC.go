package VTEC

import (
	"errors"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// Action code type enumeration
type ActionCode int

const (
	NEW ActionCode = iota // New Event
	CON                   // Continued Event
	EXT                   // Extended Time
	EXA                   // Extended Area
	EXB                   // Extended Both
	UPG                   // Upgrade Event
	CAN                   // Cancel Event
	EXP                   // Expired Event
	COR                   // Corrected Event
	ROU                   // Routine Event
)

// Product class type enumeration
type ProductClass int

const (
	O ProductClass = iota // Operational
	T                     // Test
	E                     // Experimental
	X                     // Experimental in Operation
)

type VTEC struct {
	ProductClass        ProductClass // Corresponds to "k"
	Action              ActionCode   // Corresponds to "aaa"
	OfficeIdentifier    string       // Corresponds to "cccc"
	Phenomena           string       // Corresponds to "pp"
	Significance        string       // Corresponds to "ss"
	EventTrackingNumber int          // Corresponds to "nn"
	StartDateTime       time.Time    // Corresponds to "yyyyMMddTHHmmssZ"
	EndDateTime         time.Time    // Corresponds to "yyyyMMddTHHmmssZ"
}

func ParseVTEC(vtec string) (*VTEC, error) {
	//Regex pattern to match the VTEC string
	pattern := `^/?([OTEX])\.(NEW|CON|EXT|EXA|EXB|UPG|CAN|EXP|COR|ROU)\.([A-Z0-9]{4})\.([A-Z]{2})\.([A-Z])\.(\d{4})\.(\d{6}T\d{4}Z)-(\d{6}T\d{4}Z)/?$`
	re := regexp.MustCompile(pattern)
	matches := re.FindStringSubmatch(vtec)
	if len(matches) != 9 {
		return nil, errors.New("invalid VTEC string format: " + vtec)
	}

	//Product code parsing
	var productClass ProductClass
	switch strings.ToUpper(matches[1]) {
	case "O":
		productClass = O
	case "T":
		productClass = T
	case "E":
		productClass = E
	case "X":
		productClass = X
	default:
		return nil, errors.New("invalid product class")
	}

	//Action code parsing
	var actionCode ActionCode
	switch strings.ToUpper(matches[2]) {
	case "NEW":
		actionCode = NEW
	case "CON":
		actionCode = CON
	case "EXT":
		actionCode = EXT
	case "EXA":
		actionCode = EXA
	case "EXB":
		actionCode = EXB
	case "UPG":
		actionCode = UPG
	case "CAN":
		actionCode = CAN
	case "EXP":
		actionCode = EXP
	case "COR":
		actionCode = COR
	case "ROU":
		actionCode = ROU
	default:
		return nil, errors.New("invalid action code")
	}

	officeIdentifier := matches[3]
	phenomena := matches[4]
	significance := matches[5]

	eventTrackingNumber, err := strconv.Atoi(matches[6])
	if err != nil {
		return nil, errors.New("invalid event tracking number")
	}

	const layout = "060102T1504Z"
	var startDateTime time.Time
	if matches[7] == "000000T0000Z" {
		startDateTime = time.Time{}
	} else {
		startDateTime, err = time.Parse(layout, matches[7])
		if err != nil {
			return nil, errors.New("invalid start date/time")
		}
	}

	var endDateTime time.Time
	if matches[8] == "000000T0000Z" {
		endDateTime = time.Time{}
	} else {
		endDateTime, err = time.Parse(layout, matches[8])
		if err != nil {
			return nil, errors.New("invalid end date/time")
		}
	}

	return &VTEC{
		ProductClass:        productClass,
		Action:              actionCode,
		OfficeIdentifier:    officeIdentifier,
		Phenomena:           phenomena,
		Significance:        significance,
		EventTrackingNumber: eventTrackingNumber,
		StartDateTime:       startDateTime,
		EndDateTime:         endDateTime,
	}, nil
}
