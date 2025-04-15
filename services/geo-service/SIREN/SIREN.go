package SIREN

import (
	"fmt"
	"geoService/NWS"
	"time"
)

type SirenAlert struct {
	Identifier         string     `bson:"identifier"`
	MostRecentCAP      string     `bson:"mostRecentCAP,omitempty"`
	State              string     `bson:"state"`
	MostRecentSentTime time.Time  `bson:"mostRecentSentTime"`
	LastUpdatedTime    time.Time  `bson:"lastUpdatedTime"`
	UpgradedTo         string     `bson:"upgradedTo,omitempty"`
	History            any        `bson:"history"`
	Areas              []string   `bson:"areas"`
	CapInfo            *NWS.Alert `bson:"capInfo,omitempty"`
}

type AlertGeometry struct {
	Identifier   string       `bson:"identifier"`
	Coordinates  AbstractGeom `bson:"coordinates"`
	GeometryType string       `bson:"geometryType"` // Should be "Polygon" or "MultiPolygon"
}

type AlertKey struct {
	Identifier string    `bson:"identifier"`
	Expires    time.Time `bson:"capInfo.info.expires"`
}

type NotNeededError struct {
	Msg string
}

func (e NotNeededError) Error() string {
	return e.Msg
}

func GetCanonicalIdentifier(vtec *NWS.VTEC) string {
	//Func to get the canonical identifier from the vtec
	canonicalIdentifier := fmt.Sprintf(
		"%s%s-%s-%d-%s",
		vtec.Phenomena,
		vtec.Significance,
		vtec.OfficeIdentifier,
		vtec.EventTrackingNumber,
		vtec.EndDateTime.Format("2006"),
	)
	return canonicalIdentifier
}

var ColorMap = map[string]string{
	"ADR": "#C0C0C0",
	"AVA": "#F4A460",
	"AVW": "#1E90FF",
	"BLU": "#FFFFFF",
	"BZW": "#FF4500",
	"CAE": "#FFFFFF",
	"CDW": "#FFB6C1",
	"CEM": "#FFB6C1",
	"CFA": "#66CDAA",
	"LSA": "#66CDAA",
	"CFW": "#228B22",
	"LSW": "#228B22",
	"DSW": "#FFE4C4",
	"EQW": "#8B4513",
	"EVI": "#EFEFEF",
	"EWW": "#FF8C00",
	"FFA": "#2E8B57",
	"FAA": "#2E8B57",
	"FFW": "#8B0000",
	"FLA": "#2E8B57",
	"FAW": "#00FF00",
	"FLW": "#00FF00",
	"FRW": "#A0522D",
	"HLS": "#EFEFEF",
	"TYS": "#EFEFEF",
	"HMW": "#4B0082",
	"HUA": "#FF00FF",
	"TYA": "#FF00FF",
	"HUW": "#DC143C",
	"TYW": "#DC143C",
	"HWA": "#B8860B",
	"HWW": "#DAA520",
	"LAE": "#C0C0C0",
	"LEW": "#C0C0C0",
	"NUW": "#4B0082",
	"AQA": "#808080",
	"ASY": "#808080",
	"AFY": "#696969",
	"MHY": "#696969",
	"MHW": "#A9A9A9",
	"SAB": "#CD853F",
	"BHS": "#40E0D0",
	"DUY": "#BDB76B",
	"DUW": "#FFE4C4",
	"BWY": "#D8BFD8",
	"CFY": "#7CFC00",
	"CFS": "#6B8E23",
	"CWY": "#AFEEEE",
	"FGY": "#708090",
	"MFY": "#708090",
	"MSY": "#F0E68C",
	"SMY": "#F0E68C",
	"DSY": "#BDB76B",
	"ECA": "#5F9EA0",
	"ECW": "#0000FF",
	"EHW": "#EFEFEF",
	"EHA": "#EFEFEF",
	"RFD": "#E9967A",
	"XHA": "#800000",
	"XHW": "#C71585",
	"FWA": "#FFDEAD",
	"FAY": "#00FF7F",
	"FLY": "#00FF7F",
	"FZW": "#483D8B",
	"FZA": "#00FFFF",
	"ZFY": "#8080",
	"ZYY": "#00BFFF",
	"FRY": "#6495ED",
	"GLW": "#DDA0DD",
	"GLA": "#FFC0CB",
	"HZW": "#EFEFEF",
	"HZA": "#EFEFEF",
	"SEW": "#D8BFD8",
	"SEA": "#483D8B",
	"HTY": "#FF7F50",
	"UPY": "#00BFFF",
	"UPW": "#00BFFF",
	"UPA": "#BC8F8F",
	"SUY": "#BA55D3",
	"SUW": "#228B22",
	"HFW": "#CD5C5C",
	"HFA": "#9932CC",
	"ESF": "#90EE90",
	"LWY": "#D2B48C",
	"LSY": "#7CFC00",
	"LSS": "#6B8E23",
	"LOY": "#A52A2A",
	"MWS": "#FFDAB9",
	"FWW": "#FF1493",
	"RPS": "#40E0D0",
	"SCY": "#D8BFD8",
	"SWY": "#EFEFEF",
	"RBY": "#EFEFEF",
	"SIY": "#EFEFEF",
	"MAW": "#FFA500",
	"SRW": "#9400D3",
	"SRA": "#FFE4B5",
	"HUS": "#EFEFEF",
	"TSY": "#D2691E",
	"WIY": "#D2B48C",
	"WWY": "#7B68EE",
	"RHW": "#4B0082",
	"SPS": "#FFE4B5",
	"SPW": "#FA8072",
	"SSA": "#DB7FF7",
	"SSW": "#B524F7",
	"SVA": "#DB7093",
	"SVW": "#FFA500",
	"SQW": "#C71585",
	"TOW": "#FF0000",
	"TOA": "#FFFF00",
	"TOE": "#C0C0C0",
	"TRA": "#F08080",
	"TRW": "#B22222",
	"TSA": "#FF00FF",
	"TSW": "#FD6347",
	"VOW": "#2F4F4F",
	"WSA": "#4682B4",
	"ISW": "#8B008B",
	"WSW": "#FF69B4",
}
