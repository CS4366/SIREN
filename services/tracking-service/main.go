/**========================================================================
 *  						Tracking Service
 *  							  SIREN
 *========================================================================**/

package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"slices"
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

	"github.com/vmihailenco/msgpack"
	"go.etcd.io/bbolt"
)

/**============================================
 *               Prometheus Metrics
 *=============================================**/

var processingTime = prometheus.NewHistogram(
	prometheus.HistogramOpts{
		Name:    "alert_processing_time_seconds",
		Help:    "Time taken to process an alert",
		Buckets: prometheus.DefBuckets,
	},
)

var alertsReceived = prometheus.NewCounter(prometheus.CounterOpts{
	Name: "alerts_received_total",
	Help: "Total number of alert messages received",
})

var alertsProcessed = prometheus.NewCounter(prometheus.CounterOpts{
	Name: "alerts_processed_total",
	Help: "Total number of alerts processed successfully",
})

/**============================================
 *           Message Queue Connection
 *=============================================**/

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

/**============================================
 *               MongoDB Connection
 *=============================================**/

var client *mongo.Client
var alertsCollection *mongo.Collection
var stateCollection *mongo.Collection

func ConnectToMongo() {
	//Connect to MongoDB
	uri := os.Getenv("MONGO_URI")
	if uri == "" {
		log.Warn("MONGO_URI not set. Using default value, this may not work.\n")
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

/**============================================
 *               BBolt Connection
 *=============================================**/

var CountyStore *bbolt.DB
var ZoneStore *bbolt.DB
var MarineStore *bbolt.DB

func ConnectToUGCStore() {
	var err error
	CountyStore, err = bbolt.Open("nws_county.db", 0644, nil)
	if err != nil {
		log.Fatal("Failed to open NWS County BBolt datastore")
	}
	ZoneStore, err = bbolt.Open("nws_county.db", 0644, nil)
	if err != nil {
		log.Fatal("Failed to open NWS Zone BBolt datastore")
	}
	MarineStore, err = bbolt.Open("nws_county.db", 0644, nil)
	if err != nil {
		log.Fatal("Failed to open NWS Marine BBolt datastore")
	}
}

func getUGC(ugc string) (SIREN.UGC, error) {
	var ugcData SIREN.UGC
	// Determine which store to use based on the UGC type
	if ugc[2] == 'C' {
		err := CountyStore.View(func(tx *bbolt.Tx) error {
			b := tx.Bucket([]byte("Data"))
			if b == nil {
				return fmt.Errorf("bucket not found")
			}
			v := b.Get([]byte(ugc))
			if v == nil {
				return fmt.Errorf("key not found")
			}
			return msgpack.Unmarshal(v, &ugcData)
		})
		if err != nil {
			return SIREN.UGC{}, err
		}
	} else if ugc[2] == 'Z' {
		//Determine if the UGC is a zone or marine zone
		if SIREN.IsState(ugc[0:2]) {
			// This is a zone
			err := ZoneStore.View(func(tx *bbolt.Tx) error {
				b := tx.Bucket([]byte("Data"))
				if b == nil {
					return fmt.Errorf("bucket not found")
				}
				v := b.Get([]byte(ugc))
				if v == nil {
					return fmt.Errorf("key not found")
				}
				return msgpack.Unmarshal(v, &ugcData)
			})
			if err != nil {
				return SIREN.UGC{}, err
			}
		} else {
			// This is a marine zone
			err := MarineStore.View(func(tx *bbolt.Tx) error {
				b := tx.Bucket([]byte("Data"))
				if b == nil {
					return fmt.Errorf("bucket not found")
				}
				v := b.Get([]byte(ugc))
				if v == nil {
					return fmt.Errorf("key not found")
				}
				return msgpack.Unmarshal(v, &ugcData)
			})
			if err != nil {
				return SIREN.UGC{}, err
			}
		}

	}

	return ugcData, nil
}

/**============================================
 *            Concurrency Control
 *=============================================**/

type AlertLock struct {
	mu       sync.Mutex
	lastUsed time.Time
}

var alertLocker sync.Map

func getLock(key string) *AlertLock {
	if lock, ok := alertLocker.Load(key); ok {
		alertLock := lock.(*AlertLock)
		alertLock.lastUsed = time.Now()
		return alertLock
	}

	newLock := &AlertLock{
		lastUsed: time.Now(),
	}
	actual, _ := alertLocker.LoadOrStore(key, newLock)
	return actual.(*AlertLock)
}

func cleanupAlertLocker(expiration time.Duration) {
	timer := time.NewTicker(expiration)
	defer timer.Stop()

	for range timer.C {
		alertLocker.Range(func(key, value interface{}) bool {
			alertLock := value.(*AlertLock)
			if time.Since(alertLock.lastUsed) > expiration {
				alertLocker.Delete(key)
			}
			return true
		})
		log.Info("Alert locker cleanup completed...")
	}

}

/**============================================
 *               Driver Code
 *=============================================**/

func debugLog(msg string) {
	if os.Getenv("ENV") != "PROD" {
		log.Debug(msg)
	}
}

func init() {
	prometheus.MustRegister(processingTime)
	prometheus.MustRegister(alertsReceived)
	prometheus.MustRegister(alertsProcessed)
}

func main() {
	if os.Getenv("ENV") != "PROD" {
		err := godotenv.Load()
		if err != nil {
			log.Fatal("Error loading .env file")
		}
		log.SetLevel(log.DebugLevel)
	}

	log.Print("Starting tracking service...")
	log.Print("Connecting to message queue and MongoDB...")

	connectToMQ()
	defer conn.Close()
	defer ch.Close()

	ConnectToMongo()
	defer func() {
		if err := client.Disconnect(context.TODO()); err != nil {
			panic(err)
		}
	}()

	ConnectToUGCStore()
	defer CountyStore.Close()
	defer ZoneStore.Close()
	defer MarineStore.Close()

	log.Print("Connected to message queue and MongoDB")
	log.Print("Starting connection to NWWS ingress server...")

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
				handleAlertMessage(d.Body, workerID)
			}
		}(i)
	}

	// This server is used to expose the metrics to Prometheus
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

/**============================================
 *           Alert Processing Logic
 *=============================================**/

// Calculate geometry for the alert
func calculateGeometry(areas []string) (SIREN.SirenAlertGeometry, error) {
	var geometry SIREN.SirenAlertGeometry
	var ugcs []SIREN.UGC

	for _, area := range areas {
		ugc, err := getUGC(area)
		if err != nil {
			// Maybe change this so failing is a bigger deal
			continue
		}
		ugcs = append(ugcs, ugc)
	}

	// If the ugc.Feature is a [][][2]float64 it's a MultiPolygon
	if len(ugcs) == 0 {
		return geometry, fmt.Errorf("no UGC found")
	}

	var polygonsList []SIREN.GeoJSONPolygon       // For features of type [][2]float64 (simple polygon).
	var multiPolygons []SIREN.GeoJSONMultiPolygon // For features of type [][][2]float64 (multipolygon).

	for _, ugc := range ugcs {
		// Since ugc.Feature is a []interface{} from msgpack, we try the multipolygon conversion first.
		mp, err := SIREN.ConvertToMultiPolygon(ugc.Feature)
		if err == nil {
			multiPolygons = append(multiPolygons, mp)
			continue
		}

		// Otherwise, try converting to a simple polygon.
		poly, err := SIREN.ConvertToPolygon(ugc.Feature)
		if err != nil {
			// Could not convert; skip or handle the error.
			continue
		}
		polygonsList = append(polygonsList, poly)
	}

	calculatedPolygon := SIREN.UnionPolygons(polygonsList, multiPolygons, 0.01)
	if len(calculatedPolygon) == 1 {
		geometry.GeometryType = "Polygon"
		geometry.Coordinates = calculatedPolygon[0]

		return geometry, nil
	}

	geometry.GeometryType = "MultiPolygon"
	geometry.Coordinates = calculatedPolygon
	return geometry, nil
}

// Recursively finds all the references from a given reference.
func findReference(ctx context.Context, reference NWS.Reference, sirenId string, visited map[string]bool) []SIREN.MiniCAP {
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

	if SIREN.GetCanonicalIdentifier(referenceVTECParsed) != sirenId {
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

	var miniCAP SIREN.MiniCAP
	miniCAP.Identifier = reference.Identifier
	miniCAP.VTEC = *referenceVTECParsed
	miniCAP.Areas = referenceAreas
	miniCAP.References = referencedAlert.Properties.References
	miniCAP.ExpiredReferences = expiredReferences
	miniCAP.Sent = reference.Sent

	var foundChildren []SIREN.MiniCAP
	for _, childID := range miniCAP.References {
		children := findReference(ctx, childID, sirenId, visited)
		foundChildren = append(foundChildren, children...)
	}
	for _, childID := range miniCAP.ExpiredReferences {
		children := findReference(ctx, childID, sirenId, visited)
		foundChildren = append(foundChildren, children...)
	}

	results := []SIREN.MiniCAP{miniCAP}
	results = append(results, foundChildren...)
	return results
}

// Recitifies the history and areas for a given alert using CAP references
func findAlertHistory(cap NWS.Alert, vtec *NWS.VTEC, currentHistory []string, workerId int) SIREN.Rectification {
	sirenId := SIREN.GetCanonicalIdentifier(vtec)
	log.Debug("Rectifying history for alert", "sirenId", sirenId, "worker", workerId)

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

	var miniCAPs []SIREN.MiniCAP
	for _, ref := range references {
		// For each reference, fetch its chain of references (if any)
		refFetch := findReference(context.TODO(), ref, sirenId, visited)
		miniCAPs = append(miniCAPs, refFetch...)
	}

	var areas []string
	for _, miniCAP := range miniCAPs {
		for _, area := range miniCAP.Areas {
			// Check if the areas are already in the list
			if !slices.Contains(areas, area) {
				areas = append(areas, area)
			}
		}
	}

	var history []SIREN.SirenAlertHistory

	//Sort the miniCAPs by the sent time so the most recent is first
	slices.SortFunc(miniCAPs, func(a, b SIREN.MiniCAP) int {
		return b.Sent.Compare(a.Sent)
	})

	for _, miniCAP := range miniCAPs {
		history = append(history, SIREN.SirenAlertHistory{
			RecievedAt:            miniCAP.Sent,
			VtecActionDescription: NWS.GetLongStateName(miniCAP.VTEC.Action),
			VtecAction:            miniCAP.VTEC.Action,
			AppliesTo:             miniCAP.Areas,
			CapID:                 miniCAP.Identifier,
		})
	}

	return SIREN.Rectification{
		History: history,
		Areas:   areas,
	}
}

func handleAlertHistory(existingAlert *SIREN.SirenAlert, alert NWS.Alert, vtec *NWS.VTEC, workerId int) {
	// Create the history entry for this CAP
	history := SIREN.SirenAlertHistory{
		RecievedAt:            time.Now(),
		VtecActionDescription: NWS.GetLongStateName(vtec.Action),
		VtecAction:            vtec.Action,
		AppliesTo:             alert.Info.Area.Geocodes.UGC,
		CapID:                 alert.Identifier,
	}
	// Add the history entry to the existing alert
	existingAlert.History = append([]SIREN.SirenAlertHistory{history}, existingAlert.History...)

	// Get all the CAP IDs from the history
	// This is used for the rectification process to avoid duplicate history entries
	idsInHistory := make([]string, len(existingAlert.History))
	for i, hist := range existingAlert.History {
		idsInHistory[i] = hist.CapID
	}

	// Attempt to rectify any history we are missing. If were not missing anything
	// this won't do anything, it'll run a single O(n log n) operation.
	rectifiedHistory := findAlertHistory(alert, vtec, idsInHistory, workerId)
	// Add the rectified history to the existing alert
	existingAlert.History = append(existingAlert.History, rectifiedHistory.History...)

	//Sort the history by the recieved time so the most recent history is first
	slices.SortFunc(existingAlert.History, func(a, b SIREN.SirenAlertHistory) int {
		return b.RecievedAt.Compare(a.RecievedAt)
	})

	//Update the alert in the database
	existingAlert.LastUpdatedTime = time.Now()

	//Determine if every area in the alert has a final vtec action applied
	areaMap := make(map[string]bool)
	for _, historyObject := range existingAlert.History {
		// Used to determine if the alert is active or inactive
		if historyObject.VtecAction == NWS.VTEC_UPG ||
			historyObject.VtecAction == NWS.VTEC_CAN ||
			historyObject.VtecAction == NWS.VTEC_EXP {
			for _, area := range historyObject.AppliesTo {
				// This area has a final vtec action applied to it
				areaMap[area] = true
			}
		}

		//Recitify the areas in the alert too
		for _, area := range historyObject.AppliesTo {
			if !slices.Contains(existingAlert.Areas, area) {
				existingAlert.Areas = append(existingAlert.Areas, area)
			}
		}
	}

	// These next couple of lines are used to determine if the alert is active or inactive
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
}

// Processes the alert and updates the database, this is the main meat of the alert processing logic.
// It is run in a goroutine, and uses a mutex to ensure that only one goroutine can process a given event at a time.
func handleAlert(alert NWS.Alert, vtec *NWS.VTEC, workerId int) {
	// Generate a unique identifier for the alert based on its VTEC
	sirenID := SIREN.GetCanonicalIdentifier(vtec)

	// Retrieve or create a mutex lock for the alert using its unique identifier
	alertLock := getLock(sirenID)
	log.Debug("Attempting to aquire mutex lock", "id", sirenID, "worker", workerId)
	// Block until the lock becomes available and then acquire it
	alertLock.mu.Lock()
	log.Debug("Worker has now acquired lock on alert", "id", sirenID, "worker", workerId)

	// Store the starting time of the alert processing execution
	start := time.Now()
	defer func() {
		// Record the processing time so the dashboard can track the time
		processingTime.Observe(time.Since(start).Seconds())
	}()

	// Ensure the lock is released when the function exits
	defer alertLock.mu.Unlock()

	// For new alerts, we can skip most of the processing
	if vtec.Action == NWS.VTEC_NEW {
		newAlert := SIREN.SirenAlert{
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
		}

		if alert.Info.Area.Polygon == nil {
			log.Debug("No polygon found in the alert, attempting to calculate geometry from UGC", "id", sirenID, "worker", workerId)
			geometry, err := calculateGeometry(alert.Info.Area.Geocodes.UGC)
			if err != nil {
				log.Error("Failed to calculate geometry for the alert", "id", sirenID, "worker", workerId, "err", err)
				return
			}
			// Set the geometry for the alert
			newAlert.Geometry = geometry
		} else {
			if len(alert.Info.Area.Polygon.Coordinates) > 0 {
				newAlert.Geometry = SIREN.SirenAlertGeometry{
					GeometryType: "Polygon",
					Coordinates:  alert.Info.Area.Polygon.Coordinates[0],
				}
			}
		}

		_, err := stateCollection.InsertOne(context.TODO(), newAlert)
		if err != nil {
			log.Error("Failed to insert the alert into the database", "id", sirenID, "worker", workerId, "err", err)
			return
		}
		log.Debug("Alert is new and added to database.", "id", sirenID, "worker", workerId)
		return
	}

	// Check if the alert is already in the database
	var existingAlert SIREN.SirenAlert
	err := stateCollection.FindOne(context.TODO(), bson.M{"identifier": sirenID}).Decode(&existingAlert)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			// Create a new alert for us to work with
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

	//We'll process the history here.
	handleAlertHistory(&existingAlert, alert, vtec, workerId)

	//Calculate the geometry for the alert
	if alert.Info.Area.Polygon == nil && existingAlert.State == "Active" {
		log.Debug("No polygon found in the alert, attempting to calculate geometry from UGC", "id", sirenID, "worker", workerId)
		geometry, err := calculateGeometry(alert.Info.Area.Geocodes.UGC)
		if err != nil {
			log.Error("Failed to calculate geometry for the alert", "id", sirenID, "worker", workerId, "err", err)
		} else {
			// Set the geometry for the alert
			existingAlert.Geometry = geometry
		}
	} else if alert.Info.Area.Polygon != nil && existingAlert.State == "Active" {
		if len(alert.Info.Area.Polygon.Coordinates) > 0 {
			existingAlert.Geometry = SIREN.SirenAlertGeometry{
				GeometryType: "Polygon",
				Coordinates:  alert.Info.Area.Polygon.Coordinates[0],
			}
		}
	}

	//Update the most recent sent time and CAP ID
	existingAlert.MostRecentSentTime = alert.Sent
	existingAlert.MostRecentCAP = alert.Identifier

	//Upsert the alert in the database
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

// Stores the CAP alert in the database
func storeCap(alert NWS.Alert, shortId string, workerId int) {
	var existingAlert NWS.Alert
	err := alertsCollection.FindOne(context.TODO(), bson.M{"identifier": alert.Identifier}).Decode(&existingAlert)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			//Insert the alert into the database
			_, err = alertsCollection.InsertOne(context.TODO(), alert)
			//Handle the error
			if err != nil {
				log.Error("Failed to insert the alert into the database", "id", shortId, "worker", workerId, "err", err)
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
}

// Handles parsing the alert JSON and processing it.
// This is the main entry point for the alert processing logic.
func handleAlertMessage(msg []byte, workerId int) {
	alertsReceived.Inc()
	var alert NWS.Alert
	// Unmarshal the message
	err := msgpack.Unmarshal(msg, &alert)
	if err != nil {
		log.Error("Failed to unmarshal the alert", "worker", workerId, "err", err)
		return
	}

	shortId := SIREN.GetShortenedId(alert)
	log.Debug("Received message", "id", shortId, "worker", workerId)

	vtec, err := NWS.ParseVTEC(alert.Info.Parameters.VTEC)
	if err != nil {
		log.Debug("Failed to parse VTEC, skipping alert processing", "id", shortId, "worker", workerId, "err", err)
	}

	//TODO: Handle SPS (Special Weather Statements) processing
	if vtec != nil {
		// It's sort of hidden, but this is where the alert is actually processed
		handleAlert(alert, vtec, workerId)
	}

	// Save the CAP alert to the database
	storeCap(alert, shortId, workerId)

	//TODO: Publish the alert to the live queue

	log.Debug("Alert processed successfully, worker is free", "id", shortId, "worker", workerId)
	alertsProcessed.Inc()
}
