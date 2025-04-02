package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"regexp"
	"slices"
	"sort"
	"strings"
	"sync"
	"time"

	"trackingService/NWS"
	"trackingService/SIREN"

	"github.com/charmbracelet/log"
	"github.com/joho/godotenv"
	ampq "github.com/rabbitmq/amqp091-go"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

type CapReferenceHelper struct {
	Identifier        string
	VTEC              NWS.VTEC
	Areas             []string
	References        []NWS.Reference
	ExpiredReferences []NWS.Reference
	Sent              time.Time
}

type HistoryRectification struct {
	History []SIREN.SirenAlertHistory
	Areas   []string
}

type AlertLock struct {
	mu       sync.Mutex
	lastUsed time.Time
}

func debugLog(msg string) {
	if os.Getenv("ENV") != "PROD" {
		log.Debug(msg)
	}
}

var alertLocks sync.Map

func getLock(key string) *AlertLock {
	if lock, ok := alertLocks.Load(key); ok {
		alertLock := lock.(*AlertLock)
		alertLock.lastUsed = time.Now()
		return alertLock
	}

	newLock := &AlertLock{
		lastUsed: time.Now(),
	}
	actual, _ := alertLocks.LoadOrStore(key, newLock)
	return actual.(*AlertLock)
}

func cleanupAlertLocker(expiration time.Duration) {
	timer := time.NewTicker(expiration)
	defer timer.Stop()

	for range timer.C {
		alertLocks.Range(func(key, value interface{}) bool {
			alertLock := value.(*AlertLock)
			if time.Since(alertLock.lastUsed) > expiration {
				alertLocks.Delete(key)
			}
			return true
		})
		log.Info("Alert locker cleanup completed...")
	}

}

var conn *ampq.Connection
var ch *ampq.Channel
var trackingQueue ampq.Queue
var liveQueue ampq.Queue

// Connect to message queue
func connectToMQ() {
	var err error
	//Dial to the message queue
	conn, err = ampq.Dial(os.Getenv("RABBITMQ_URL"))
	if err != nil {
		log.Fatal("Failed to connect to the message queue")
		return
	}

	ch, err = conn.Channel()
	if err != nil {
		log.Fatal("Failed to open a channel")
	}

	//Connect to the tracking queue
	trackingQueue, err = ch.QueueDeclare("tracking", true, false, false, false, nil)
	if err != nil {
		log.Fatal("Failed to declare the tracking queue")
	}

	//Connect to the live queue
	liveQueue, err = ch.QueueDeclare("push", true, false, false, false, nil)
	if err != nil {
		log.Fatal("Failed to declare the push queue")
	}

}

var client *mongo.Client
var alertsCollection *mongo.Collection
var stateCollection *mongo.Collection

func ConnectToMongo() {
	//Connect to MongoDB
	uri := os.Getenv("MONGO_URI")
	if uri == "" {
		log.Warn("Warning: MONGO_URI not set. Using default value, this may not work.\n")
		uri = "mongodb://localhost:27017"
	}

	var err error
	client, err = mongo.Connect(options.Client().ApplyURI(uri))
	if err != nil {
		log.Fatal("Failed to connect to MongoDB")
	}

	alertsCollection = client.Database("siren").Collection("alerts")
	stateCollection = client.Database("siren").Collection("state")
}

var processingTime = prometheus.NewHistogram(
	prometheus.HistogramOpts{
		Name:    "alert_processing_time_seconds",
		Help:    "Time taken to process an alert",
		Buckets: prometheus.DefBuckets,
	},
)

func init() {
	prometheus.MustRegister(processingTime)
}

func main() {
	if os.Getenv("ENV") != "PROD" {
		err := godotenv.Load()
		if err != nil {
			log.Fatal("Error loading .env file")
		}
	}

	log.Print("Starting tracking service...")
	log.Print("Connecting to message queue...")

	connectToMQ()
	defer conn.Close()
	defer ch.Close()

	ConnectToMongo()
	defer func() {
		if err := client.Disconnect(context.TODO()); err != nil {
			panic(err)
		}
	}()

	//Consume messages from the tracking queue
	msgs, err := ch.Consume(trackingQueue.Name, "", true, false, false, false, nil)
	if err != nil {
		log.Fatal("Failed to consume messages from the tracking queue")
	}

	forever := make(chan bool)

	// Start a goroutine to cleanup the alert locker every 5 minutes
	go cleanupAlertLocker(5 * time.Minute)

	// Start a worker pool of 10 goroutines to handle messages
	for i := 0; i < 10; i++ {
		go func(workerID int) {
			for d := range msgs {
				handleAlertMessage(string(d.Body), workerID)
			}
		}(i)
	}

	http.Handle("/metrics", promhttp.Handler())
	go func() {
		port, ok := os.LookupEnv("METRICS_PORT")
		if !ok {
			port = "6901"
		}

		log.Infof("Starting Prometheus metrics server on %s", port)
		if err := http.ListenAndServe(fmt.Sprintf(":%s", port), nil); err != nil {
			log.Fatal("Failed to start Prometheus metrics server", err)
		}
	}()

	log.Print("Waiting for messages. To exit press CTRL+C")
	<-forever
}

func getCanonicalIdentifier(vtec *NWS.VTEC) string {
	//Func to get the canonical identifier from the vtec
	canonicalIdentifier := fmt.Sprintf("%s%s-%s-%d", vtec.Phenomena, vtec.Significance, vtec.OfficeIdentifier, vtec.EventTrackingNumber)
	return canonicalIdentifier
}

func getShortenedId(alert NWS.Alert) string {
	//Func to get the shortened identifier from the alert
	wmoParts := strings.Split(alert.Info.Parameters.WMOidentifier, " ")
	if len(wmoParts) < 3 {
		log.Error("WMO identifier is not in the expected format, cannot generate shortened identifier")
		return alert.Identifier
	}

	alertIdentifier := fmt.Sprintf("%s-%s-%s", alert.Info.EventCode.NWS, wmoParts[1], wmoParts[2])
	return alertIdentifier
}

func extractVTEC(line string) string {
	re := regexp.MustCompile(NWS.VTEC_REGEX_PATTERN)
	matches := re.FindStringSubmatch(line)
	if len(matches) > 0 {
		return matches[0]
	}
	return ""
}

func determineUpgraded(alert NWS.Alert) string {
	//We're gonna use the textual bulletin to see if we can find the new VTEC that corresponds to the alert.
	//CAP only gives us the single VTEC value, so this is our hacky way around it.

	//Fetch the most recent product from https://api.weather.gov/products/types/{AWIPS_ID_FRONT}/locations/{AWIPS_ID_BACK}
	product := alert.Info.Parameters.AWIPSidentifier[:3]
	office := alert.Info.Parameters.AWIPSidentifier[3:6]

	var data NWS.ApiResponseData
	err := SIREN.GetJSON(context.TODO(), fmt.Sprintf("https://api.weather.gov/products/types/%s/locations/%s", product, office), &data)
	if err != nil {
		debugLog(fmt.Sprintf("Failed to fetch data from the API: %s", err))
		return ""
	}

	if len(data.Graph) == 0 {
		// No textual bulletin available
		debugLog("No textual bulletin available")
		return ""
	}

	var newVtecString string = ""
	for _, graph := range data.Graph {
		//Get the most recent product
		textProductURL := graph["@id"].(string)
		var productData NWS.JSON
		err = SIREN.GetJSON(context.TODO(), textProductURL, &productData)
		if err != nil {
			debugLog(fmt.Sprintf("Failed to fetch product data: %s", err))
			return ""
		}

		productText := productData["productText"].(string)
		vtecString := alert.Info.Parameters.VTEC

		//Find the VTEC string in the product text
		lines := strings.Split(productText, "\n")

		for i, line := range lines {
			if strings.Contains(line, vtecString) {
				if i < len(lines)-1 {
					if candidate := extractVTEC(lines[i+1]); candidate != "" && candidate != vtecString {
						newVtecString = candidate
						break
					}
				}

				if i > 0 {
					if candidate := extractVTEC(lines[i-1]); candidate != "" && candidate != vtecString {
						newVtecString = candidate
						break
					}
				}
			}
		}

		if newVtecString != "" {
			break
		}

	}
	if newVtecString == "" {
		debugLog("No new VTEC found")
		return ""
	}

	//Parse the new VTEC string
	newVtec, err := NWS.ParseVTEC(newVtecString)
	if err != nil {
		debugLog(fmt.Sprintf("Failed to parse new VTEC: %s", err))
		return ""
	}

	if newVtec.Action == NWS.VTEC_NEW ||
		newVtec.Action == NWS.VTEC_EXT ||
		newVtec.Action == NWS.VTEC_EXA ||
		newVtec.Action == NWS.VTEC_EXB {
		// Canonical identifier for the new VTEC
		newCanonicalIdentifier := getCanonicalIdentifier(newVtec)
		return newCanonicalIdentifier
	} else {
		debugLog(fmt.Sprintf("No new VTEC found: %s", newVtecString))
		return ""
	}
}

// Recursively find all the references in a chain
func findReference(ctx context.Context, reference NWS.Reference, sirenId string, visited map[string]bool) []CapReferenceHelper {

	if visited[reference.Identifier] {
		// Already processed this alert
		return nil
	}
	visited[reference.Identifier] = true

	var referencedAlert NWS.CapResponseData
	err := SIREN.GetJSON(ctx, fmt.Sprintf("https://api.weather.gov/alerts/%s", reference.Identifier), &referencedAlert)
	if err != nil {
		debugLog(fmt.Sprintf("Failed to fetch referenced alert: %s", err))
		return nil
	}

	//Check if the referenced alert has a VTEC
	referenceVTEC := referencedAlert.Properties.Parameters.VTEC[0]
	if referenceVTEC == "" {
		debugLog(fmt.Sprintf("No VTEC found for referenced alert: %s", reference.Identifier))
		return nil
	}

	referenceVTECParsed, err := NWS.ParseVTEC(referenceVTEC)
	if err != nil {
		debugLog(fmt.Sprintf("Failed to parse VTEC: %s", err))
		return nil
	}

	if getCanonicalIdentifier(referenceVTECParsed) != sirenId {
		return nil
	}

	// Grab the areas
	referenceAreas := referencedAlert.Properties.Geocode.UGC
	if len(referenceAreas) == 0 {
		debugLog(fmt.Sprintf("No areas found for referenced alert: %s", reference.Identifier))
		return nil
	}

	var expiredReferences []NWS.Reference = []NWS.Reference{}
	if len(referencedAlert.Properties.Parameters.ExpiredReferences) > 0 {
		for _, v := range referencedAlert.Properties.Parameters.ExpiredReferences {
			expiredReferences = append(expiredReferences, NWS.ConvertReferences(v)...)
		}
	}

	var newRefHelper CapReferenceHelper
	newRefHelper.Identifier = reference.Identifier
	newRefHelper.VTEC = *referenceVTECParsed
	newRefHelper.Areas = referenceAreas
	newRefHelper.References = referencedAlert.Properties.References
	newRefHelper.ExpiredReferences = expiredReferences
	newRefHelper.Sent = reference.Sent

	var foundChildren []CapReferenceHelper
	for _, childID := range newRefHelper.References {
		children := findReference(ctx, childID, sirenId, visited)
		foundChildren = append(foundChildren, children...)
	}
	for _, childID := range newRefHelper.ExpiredReferences {
		children := findReference(ctx, childID, sirenId, visited)
		foundChildren = append(foundChildren, children...)
	}

	results := []CapReferenceHelper{newRefHelper}
	results = append(results, foundChildren...)
	return results
}

func findAlertHistory(cap NWS.Alert, vtec *NWS.VTEC, currentHistory []string, workerId int) HistoryRectification {
	sirenId := getCanonicalIdentifier(vtec)
	log.Debug("Rectifying history for alert", sirenId, "sirenId", sirenId, "worker", workerId)

	var references []NWS.Reference
	if len(cap.References) > 0 {
		references = append(references, cap.References...)
	}
	if len(cap.Info.Parameters.ExpiredReferences) > 0 {
		references = append(references, cap.Info.Parameters.ExpiredReferences...)
	}

	visited := make(map[string]bool)
	for _, hist := range currentHistory {
		visited[hist] = true
	}

	var allRefHelpers []CapReferenceHelper
	for _, ref := range references {
		// For each reference, fetch its chain of references (if any)
		refFetch := findReference(context.TODO(), ref, sirenId, visited)
		allRefHelpers = append(allRefHelpers, refFetch...)
	}

	sort.Slice(allRefHelpers, func(i, j int) bool {
		return allRefHelpers[i].Sent.Before(allRefHelpers[j].Sent)
	})

	var areas []string
	for _, ref := range allRefHelpers {
		for _, area := range ref.Areas {
			// Check if the areas are already in the list
			if !slices.Contains(areas, area) {
				areas = append(areas, area)
			}
		}
	}

	var history []SIREN.SirenAlertHistory
	sort.Slice(allRefHelpers, func(i, j int) bool {
		return allRefHelpers[i].Sent.After(allRefHelpers[j].Sent)
	})

	for _, ref := range allRefHelpers {
		history = append(history, SIREN.SirenAlertHistory{
			RecievedAt:            ref.Sent,
			VtecActionDescription: NWS.GetLongStateName(ref.VTEC.Action),
			VtecAction:            ref.VTEC.Action,
			AppliesTo:             ref.Areas,
			CapID:                 ref.Identifier,
		})
	}

	return HistoryRectification{
		History: history,
		Areas:   areas,
	}
}

func handleAlert(alert NWS.Alert, vtec *NWS.VTEC, workerId int) {
	sirenID := getCanonicalIdentifier(vtec)
	alertLock := getLock(sirenID) // Aquire the mutex for the alert
	if !alertLock.mu.TryLock() {
		log.Info("Worker is blocked waiting for lock on alert", "id", sirenID, "worker", workerId)
		alertLock.mu.Lock()
		log.Info("Worker has now acquired lock on alert", "id", sirenID, "worker", workerId)
	} // Have the worker wait for the lock to be released

	defer alertLock.mu.Unlock()

	if vtec.Action == NWS.VTEC_NEW {
		_, err := stateCollection.InsertOne(context.TODO(), SIREN.SirenAlert{
			Identifier:         sirenID,
			State:              "Active",
			MostRecentSentTime: time.Now(),
			LastUpdatedTime:    time.Now(),
			UpgradedTo:         "",
			History: []SIREN.SirenAlertHistory{
				{
					RecievedAt:            time.Now(),
					VtecAction:            vtec.Action,
					VtecActionDescription: NWS.GetLongStateName(vtec.Action),
					AppliesTo:             alert.Info.Area.Geocodes.UGC,
					CapID:                 alert.Identifier,
				},
			},
			MostRecentCAP: alert.Identifier,
			Areas:         alert.Info.Area.Geocodes.UGC,
		})

		if err != nil {
			log.Error("Failed to insert the alert into the database", "id", sirenID, "worker", workerId, "err", err)
			return
		}
		log.Debug("Alert is new and added to database.", "id", sirenID, "worker", workerId)
		return
	}

	var existingAlert SIREN.SirenAlert
	err := stateCollection.FindOne(context.TODO(), bson.M{"identifier": sirenID}).Decode(&existingAlert)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			existingAlert = SIREN.SirenAlert{
				Identifier:         sirenID,
				State:              "Active",
				MostRecentSentTime: time.Now(),
				LastUpdatedTime:    time.Now(),
				UpgradedTo:         "",
				History:            []SIREN.SirenAlertHistory{},
				Areas:              []string{},
				MostRecentCAP:      alert.Identifier,
			}
			historyResult := findAlertHistory(alert, vtec, []string{}, workerId)
			existingAlert.History = historyResult.History
			existingAlert.Areas = historyResult.Areas

		} else {
			log.Error("Failed to insert the alert into the database", "id", sirenID, "worker", workerId, "err", err)
			return
		}
	}

	history := SIREN.SirenAlertHistory{
		RecievedAt:            time.Now(),
		VtecActionDescription: NWS.GetLongStateName(vtec.Action),
		VtecAction:            vtec.Action,
		AppliesTo:             alert.Info.Area.Geocodes.UGC,
		CapID:                 alert.Identifier,
	}
	existingAlert.History = append([]SIREN.SirenAlertHistory{history}, existingAlert.History...)

	idsInHistory := make([]string, len(existingAlert.History))
	for i, hist := range existingAlert.History {
		idsInHistory[i] = hist.CapID
	}
	rectifiedHistory := findAlertHistory(alert, vtec, idsInHistory, workerId)

	existingAlert.History = append(existingAlert.History, rectifiedHistory.History...)

	//Sort the history by the recieved time
	sort.Slice(existingAlert.History, func(i, j int) bool {
		return existingAlert.History[i].RecievedAt.After(existingAlert.History[j].RecievedAt)
	})

	//Update the alert in the database
	existingAlert.LastUpdatedTime = time.Now()
	//Determine if every area in the alert has a final vtec action applied
	areaMap := make(map[string]bool)
	for _, historyObject := range existingAlert.History {
		if historyObject.VtecAction == NWS.VTEC_UPG ||
			historyObject.VtecAction == NWS.VTEC_CAN ||
			historyObject.VtecAction == NWS.VTEC_EXP {
			for _, area := range historyObject.AppliesTo {
				areaMap[area] = true
			}
		}

		for _, area := range historyObject.AppliesTo {
			//Check if the area is in the alert
			if !slices.Contains(existingAlert.Areas, area) {
				//If the area is not in the alert, add it
				existingAlert.Areas = append(existingAlert.Areas, area)
			}
		}
	}

	isInactive := false
	for _, area := range alert.Info.Area.Geocodes.UGC {
		if _, ok := areaMap[area]; !ok {
			//This area has not been applied to any final vtec action
			//So we can assume the alert is active
			isInactive = true
			break
		}
	}

	if isInactive {
		existingAlert.State = "Active"
	} else {
		existingAlert.State = "Inactive"
	}

	existingAlert.MostRecentSentTime = time.Now()
	existingAlert.MostRecentCAP = alert.Identifier

	_, err = stateCollection.UpdateOne(
		context.TODO(),
		bson.M{"identifier": sirenID},
		bson.M{"$set": existingAlert},
		options.UpdateOne().SetUpsert(true),
	)
	if err != nil {
		log.Error("Failed to upsert the alert in the database", "id", sirenID, "worker", workerId, "err", err)
		return
	}
	log.Debug("Alert was upserted to the database", "state", existingAlert.State, "id", sirenID, "worker", workerId)
}

func handleAlertMessage(msg string, workerId int) {
	start := time.Now()

	defer func() {
		elapsed := time.Since(start)
		processingTime.Observe(elapsed.Seconds())
	}()

	var alert NWS.Alert
	//Unmarshal the message
	err := json.Unmarshal([]byte(msg), &alert)
	if err != nil {
		log.Error("Failed to unmarshal the alert", "worker", workerId, "err", err)
		return
	}

	shortId := getShortenedId(alert)

	log.Debug("Received message", "id", shortId, "worker", workerId)

	vtec, err := NWS.ParseVTEC(alert.Info.Parameters.VTEC)
	if err != nil {
		log.Info("Failed to parse VTEC, skipping alert processing", "id", shortId, "worker", workerId, "err", err)
	}

	if vtec != nil {
		handleAlert(alert, vtec, workerId)
	}

	var existingAlert NWS.Alert
	err = alertsCollection.FindOne(context.TODO(), bson.M{"identifier": alert.Identifier}).Decode(&existingAlert)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			//Insert the alert into the database
			_, err = alertsCollection.InsertOne(context.TODO(), alert)
			//Handle the error
			if err != nil {
				log.Error("Failed to insert the alert into the database", "id", shortId, "worker", workerId, "err", err)
				return
			}

			//Publish the alert to the live queue
			alertJson, err := json.Marshal(alert)
			if err != nil {
				log.Error("Failed to marshal the alert to JSON", "id", shortId, "worker", workerId, "err", err)
				return
			}
			err = ch.Publish("", liveQueue.Name, false, false, ampq.Publishing{
				ContentType: "application/json",
				Body:        alertJson,
			})

			if err != nil {
				log.Error("Failed to publish the alert to the live queue", "id", shortId, "worker", workerId, "err", err)
				return
			}

		} else {
			log.Error("Failed to find the alert in the database", "id", shortId, "worker", workerId, "err", err)
			return
		}
	} else {
		log.Warn("Alert already exists in the database", "id", shortId, "worker", workerId)
		return
	}

	log.Info("Alert processed successfully, worker is free", "id", shortId, "worker", workerId)
}
