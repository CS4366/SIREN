package NWS

import (
	"errors"
	"regexp"
	"strconv"
	"strings"
	"time"
)

const VTEC_REGEX_PATTERN string = `^/?([OTEX])\.(NEW|CON|EXT|EXA|EXB|UPG|CAN|EXP|COR|ROU)\.([A-Z0-9]{4})\.([A-Z]{2})\.([A-Z])\.(\d{4})\.(\d{6}T\d{4}Z)-(\d{6}T\d{4}Z)/?$`

// Action code type enumeration
type ActionCode int

const (
	VTEC_NEW ActionCode = iota // New Event
	VTEC_CON                   // Continued Event
	VTEC_EXT                   // Extended Time
	VTEC_EXA                   // Extended Area
	VTEC_EXB                   // Extended Both
	VTEC_UPG                   // Upgrade Event
	VTEC_CAN                   // Cancel Event
	VTEC_EXP                   // Expired Event
	VTEC_COR                   // Corrected Event
	VTEC_ROU                   // Routine Event
)

// Product class type enumeration
type ProductClass int

const (
	VTEC_O ProductClass = iota // Operational
	VTEC_T                     // Test
	VTEC_E                     // Experimental
	VTEC_X                     // Experimental in Operation
)

type VTEC struct {
	ProductClass        ProductClass // Corresponds to "k"
	Action              ActionCode   // Corresponds to "aaa"
	OfficeIdentifier    string       // Corresponds to "cccc"
	Phenomena           string       // Corresponds to "pp"
	Significance        string       // Corresponds to "ss"
	EventTrackingNumber int          // Corresponds to "nn"
	StartDateTime       time.Time    // Corresponds to "yyMMddTHHmmZ"
	EndDateTime         time.Time    // Corresponds to "yyMMddTHHmmZ"
}

func GetLongStateName(actionCode ActionCode) string {
	switch actionCode {
	case VTEC_NEW:
		return "New"
	case VTEC_CON:
		return "Continued"
	case VTEC_EXT:
		return "Extended in Time"
	case VTEC_EXA:
		return "Extended in Area"
	case VTEC_EXB:
		return "Extended in Time + Area"
	case VTEC_UPG:
		return "Upgraded"
	case VTEC_CAN:
		return "Cancelled"
	case VTEC_EXP:
		return "Expired"
	case VTEC_COR:
		return "Corrected"
	case VTEC_ROU:
		return "Routine"
	default:
		return ""
	}
}

func ParseVTEC(vtec string) (*VTEC, error) {
	//Regex pattern to match the VTEC string
	re := regexp.MustCompile(VTEC_REGEX_PATTERN)
	matches := re.FindStringSubmatch(vtec)
	if len(matches) != 9 {
		return nil, errors.New("invalid VTEC string format")
	}

	//Product code parsing
	var productClass ProductClass
	switch strings.ToUpper(matches[1]) {
	case "O":
		productClass = VTEC_O
	case "T":
		productClass = VTEC_T
	case "E":
		productClass = VTEC_E
	case "X":
		productClass = VTEC_X
	default:
		return nil, errors.New("invalid product class")
	}

	//Action code parsing
	var actionCode ActionCode
	switch strings.ToUpper(matches[2]) {
	case "NEW":
		actionCode = VTEC_NEW
	case "CON":
		actionCode = VTEC_CON
	case "EXT":
		actionCode = VTEC_EXT
	case "EXA":
		actionCode = VTEC_EXA
	case "EXB":
		actionCode = VTEC_EXB
	case "UPG":
		actionCode = VTEC_UPG
	case "CAN":
		actionCode = VTEC_CAN
	case "EXP":
		actionCode = VTEC_EXP
	case "COR":
		actionCode = VTEC_COR
	case "ROU":
		actionCode = VTEC_ROU
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
