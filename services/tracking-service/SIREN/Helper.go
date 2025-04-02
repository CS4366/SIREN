package SIREN

import (
	"context"
	"encoding/json"
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
		vtec.StartDateTime.Format("2006"),
	)
	return canonicalIdentifier
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
		return err
	}

	if err := json.NewDecoder(resp.Body).Decode(output); err != nil {
		log.Error("Failed to decode response body", "err", err)
		return err
	}
	return nil
}
