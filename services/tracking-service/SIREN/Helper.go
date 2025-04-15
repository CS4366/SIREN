package SIREN

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"trackingService/NWS"

	"github.com/charmbracelet/log"
)

// This is the canonical identifier for the alert for use by the database
// The canonical identifier is in the format "PhenomenaSignificance-OfficeIdentifier-EventTrackingNumber-Year"
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

// GenerateSpecialAlertID creates a unique ID for alerts without VTEC
func GenerateSpecialAlertID(alert NWS.Alert) string {
    // Extract useful identifiers from the alert
    office := ""
    if alert.Info.Parameters != nil && alert.Info.Parameters.AWIPSidentifier != "" {
        parts := strings.Split(alert.Info.Parameters.AWIPSidentifier, "-")
        if len(parts) >= 1 {
            office = parts[0]
        }
    }
    
    eventCode := alert.Info.EventCode.NWS
    if eventCode == "" {
        eventCode = "UNK" // Unknown if not available
    }
    
    // Use event code + office + sent time as unique identifier
    sentTime := alert.Sent.Format("20060102T150405")
    return fmt.Sprintf("SPECIAL-%s-%s-%s", eventCode, office, sentTime)
}

// Gets a shortened identifier from the alert, mainly for logging purposes
// The shortened identifier is in the format "EventCode-Office-Timestamp"
func GetShortenedId(alert NWS.Alert) string {
	//Func to get the shortened identifier from the alert
	wmoParts := strings.Split(alert.Info.Parameters.WMOidentifier, " ")
	if len(wmoParts) < 3 {
		return alert.Identifier
	}

	alertIdentifier := fmt.Sprintf("%s-%s-%s", alert.Info.EventCode.NWS, wmoParts[1], wmoParts[2])
	return alertIdentifier
}

func GetJSON(ctx context.Context, url string, output any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		log.Error("Failed to create request", "err", err)
		return err
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Error("Failed to make GET request", "err", err)
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		log.Error("Failed to fetch data: status code", "status", resp.StatusCode)
		return errors.New("failed to fetch data")
	}

	if err := json.NewDecoder(resp.Body).Decode(output); err != nil {
		log.Error("Failed to decode response body", "err", err)
		return err
	}
	return nil
}
