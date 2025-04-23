package main

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"geoService/SIREN"
	"net/http"
	"os"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/charmbracelet/log"
	geojson "github.com/paulmach/go.geojson"
	"github.com/rubenv/topojson"

	"github.com/vmihailenco/msgpack"
	"go.etcd.io/bbolt"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

/**============================================
 *               BBolt Connection
 *=============================================**/
var CountyStore *bbolt.DB
var ZoneStore *bbolt.DB

func connectToUGCStore() {
	var err error
	CountyStore, err = bbolt.Open("nws_county.db", 0644, nil)
	if err != nil {
		log.Fatal("Failed to open NWS County BBolt datastore")
	}
	ZoneStore, err = bbolt.Open("nws_zone.db", 0644, nil)
	if err != nil {
		log.Fatal("Failed to open NWS Zone BBolt datastore")
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
			log.Error("Failed to fetch UGC data", "err", err)
			return SIREN.UGC{}, err
		}
	} else {
		// This is a marine zone
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
	}

	return ugcData, nil
}

/**============================================
 *             Geometry Calculations
 *=============================================**/

func CalculateGeometry(areas []string, id string) (SIREN.AlertGeometry, error) {
	var geometry SIREN.AlertGeometry
	var ugcs []SIREN.UGC

	for _, area := range areas {
		ugc, err := getUGC(area)
		if err != nil {
			// Maybe change this so failing is a bigger deal
			continue
		}
		ugcs = append(ugcs, ugc)
	}

	// Merge all the polygons into a single polygon
	if len(ugcs) == 0 {
		return geometry, fmt.Errorf("no UGC found for %v", areas)
	}

	var abstractGeoms []SIREN.AbstractGeom

	for _, ugc := range ugcs {
		// First, try converting to a multipolygon (assumed to be [][][2]float64).
		if mp, err := SIREN.ConvertToMultiPolygon(ugc.Feature); err == nil {
			// Convert each ring in the multipolygon.
			polygonRings := make([][][]float64, 0, len(mp))
			for _, ring := range mp {
				convRing := make([][]float64, len(ring))
				for j, pt := range ring {
					convRing[j] = []float64{pt[0], pt[1]}
				}
				polygonRings = append(polygonRings, convRing)
			}
			abstractGeom := [][][][]float64{polygonRings}
			abstractGeoms = append(abstractGeoms, abstractGeom)
			continue
		}

		// If multipolygon conversion fails, try converting as a simple polygon (assumed type: [][2]float64).
		if poly, err := SIREN.ConvertToPolygon(ugc.Feature); err == nil {
			convRing := make([][]float64, len(poly))
			for j, pt := range poly {
				convRing[j] = []float64{pt[0], pt[1]}
			}
			abstractGeom := [][][][]float64{{convRing}}
			abstractGeoms = append(abstractGeoms, abstractGeom)
		}
	}

	// If we have no valid polygons, return an empty geometry
	if len(abstractGeoms) == 0 {
		return geometry, fmt.Errorf("no valid polygons found for %v", areas)
	}

	// Merge all the polygons into a single multipolygon
	mergedPolygon := SIREN.UnionPolygons(abstractGeoms)
	if mergedPolygon == nil {
		return geometry, fmt.Errorf("failed to merge polygons for %v", areas)
	}

	geometry.GeometryType = "MultiPolygon"
	simplified := SIREN.SimplifyMultiPolygon(mergedPolygon, 0.1)
	if simplified == nil {
		return geometry, fmt.Errorf("failed to simplify multipolygon for %v", areas)
	}
	geometry.Coordinates = simplified
	geometry.Identifier = id
	return geometry, nil
}

func CreateGeometryForActives() (geojson.FeatureCollection, error) {
	log.Debug("Calculating geometry for active alerts...")
	cursor, err := stateCollection.Aggregate(context.TODO(), bson.A{
		bson.M{"$match": bson.M{"state": "Active"}},
		bson.M{
			"$lookup": bson.M{
				"from":         "alerts",
				"localField":   "mostRecentCAP",
				"foreignField": "identifier",
				"as":           "capInfo",
			},
		},
		bson.M{"$unwind": "$capInfo"},
	})
	if err != nil {
		log.Error("Failed to aggregate active alerts", "err", err)
		return geojson.FeatureCollection{}, err
	}
	defer cursor.Close(context.TODO())

	var activeAlerts []SIREN.SirenAlert
	if err := cursor.All(context.TODO(), &activeAlerts); err != nil {
		log.Error("Failed to decode active alerts", "err", err)
		return geojson.FeatureCollection{}, err
	}

	//Create a , seperated list of active alerts
	activeAlertsIds := make([]string, 0, len(activeAlerts))
	for _, alert := range activeAlerts {
		activeAlertsIds = append(activeAlertsIds, alert.Identifier)
	}
	sort.Strings(activeAlertsIds)
	//Join with a comma
	activeAlertsIdsStr := strings.Join(activeAlertsIds, ",")
	hash := sha256.Sum256([]byte(activeAlertsIdsStr))
	if bytes.Equal(hash[:], lastActiveAlertsHash) {
		return geojson.FeatureCollection{}, SIREN.NotNeededError{Msg: "No new active alerts to process"}
	}

	lastActiveAlertsHash = hash[:]

	geometryList := make([]SIREN.AlertGeometry, 0)
	// Iterate over the results and calculate geometry for each active alert
	for _, alert := range activeAlerts {
		// Calculate geometry for the alert
		if alert.CapInfo != nil && alert.CapInfo.Info.Area.Polygon == nil {
			geometry, err := CalculateGeometry(alert.Areas, alert.Identifier)
			if err != nil {
				log.Error("Failed to calculate geometry", "err", err)
				continue
			}
			geometryList = append(geometryList, geometry)
		}
	}

	// Construct the GeoJSON with orb

	geoJSON := SIREN.CreateGeoJSON(geometryList)
	log.Info("Geometry calculation for active alerts completed.")

	return geoJSON, nil
}

func CreateGeometryForMultiple(alertIds []string) (geojson.FeatureCollection, error) {
	var alerts []SIREN.SirenAlert
	cursor, err := stateCollection.Find(context.TODO(), bson.M{"identifier": bson.M{"$in": alertIds}})
	if err != nil {
		log.Error("Failed to find alerts in mongo", "err", err)
		return geojson.FeatureCollection{}, err
	}
	defer cursor.Close(context.TODO())

	if err := cursor.All(context.TODO(), &alerts); err != nil {
		log.Error("Failed to decode alerts", "err", err)
		return geojson.FeatureCollection{}, err
	}

	var geometries []SIREN.AlertGeometry
	for _, alert := range alerts {
		geometry, err := CalculateGeometry(alert.Areas, alert.Identifier)
		if err != nil {
			log.Error("Failed to calculate geometry for alert", "alertId", alert.Identifier, "err", err)
			continue
		}
		geometries = append(geometries, geometry)
	}

	if len(geometries) == 0 {
		return geojson.FeatureCollection{}, fmt.Errorf("no valid geometries created for alertIds: %v", alertIds)
	}

	geojson := SIREN.CreateGeoJSON(geometries)
	return geojson, nil
}

/**============================================
 *             MongoDB Connection
 *=============================================**/

var client *mongo.Client
var stateCollection *mongo.Collection

func ConnectToMongo() {
	//Connect to MongoDB
	uri := os.Getenv("MONGO_URI")
	if uri == "" {
		log.Warn("MONGO_URI not set. Using default value, this may not work.\n")
		uri = "mongodb://192.168.0.169:27017"
	}

	var err error
	client, err = mongo.Connect(options.Client().ApplyURI(uri))
	if err != nil {
		log.Fatal("Failed to connect to MongoDB")
	}

	stateCollection = client.Database("siren").Collection("state")
}

/**============================================
 *               Driver Code
 *=============================================**/
var topoRWMutex sync.RWMutex
var lastActiveAlertsHash []byte
var topoData []byte

func HandleGeoRequest(res http.ResponseWriter, req *http.Request) {

	topoRWMutex.RLock()
	data := topoData
	topoRWMutex.RUnlock()

	res.Header().Set("Content-Type", "application/msgpack")
	res.Header().Set("Access-Control-Allow-Origin", "*")
	res.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	res.WriteHeader(http.StatusOK)

	res.Write(data)
}

func HandleSingleGeoRequest(res http.ResponseWriter, req *http.Request) {
	if req.Method == http.MethodOptions {
		res.Header().Set("Access-Control-Allow-Origin", "*")
		res.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		res.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
		res.WriteHeader(http.StatusNoContent)
		return
	}

	if req.Method != http.MethodPost {
		http.Error(res, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

	var alertIds []string
	if err := json.NewDecoder(req.Body).Decode(&alertIds); err != nil {
		http.Error(res, "Invalid request body", http.StatusBadRequest)
		return
	}

	if len(alertIds) == 0 {
		http.Error(res, "No alert IDs provided", http.StatusBadRequest)
		return
	}

	geoJSON, err := CreateGeometryForMultiple(alertIds)
	if err != nil {
		http.Error(res, "Failed to create geometry", http.StatusInternalServerError)
		return
	}

	b, err := json.Marshal(geoJSON)
	if err != nil {
		http.Error(res, "Failed to create geometry", http.StatusInternalServerError)
		return
	}

	goGeoJSON, err := geojson.UnmarshalFeatureCollection(b)
	if err != nil {
		http.Error(res, "Failed to create geometry", http.StatusInternalServerError)
		return
	}

	topology := topojson.NewTopology(goGeoJSON, nil)
	topoJson, err := topology.MarshalJSON()
	if err != nil {
		http.Error(res, "Failed to create geometry", http.StatusInternalServerError)
		return
	}

	// Convert to any
	var jsonObject map[string]any
	err = json.Unmarshal(topoJson, &jsonObject)
	if err != nil {
		http.Error(res, "Failed to create geometry", http.StatusInternalServerError)
		return
	}

	// Convert to MsgPack
	topoData, err = msgpack.Marshal(jsonObject)
	if err != nil {
		http.Error(res, "Failed to create geometry", http.StatusInternalServerError)
		return
	}

	res.Header().Set("Content-Type", "application/msgpack")
	res.Header().Set("Access-Control-Allow-Origin", "*")
	res.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	res.WriteHeader(http.StatusOK)
	res.Write(topoData)
}

func ScheduleTopoJSON(duration time.Duration) {
	// Schedule the function to run every 5 minutes
	ticker := time.NewTicker(duration)
	defer ticker.Stop()

	for range ticker.C {
		ConstructTopoJSON()
	}
}

func ConstructTopoJSON() {
	topoRWMutex.Lock()
	defer topoRWMutex.Unlock()

	log.Debug("Creating TopoJSON...")
	orbGeoJSON, err := CreateGeometryForActives()
	if err != nil {
		if _, ok := err.(SIREN.NotNeededError); ok {
			log.Debug("No new active alerts to process")
			return
		}

		log.Error("Failed to create geometry for active alerts", "err", err)
		return
	}

	// Convert orb geojson.FeatureCollection to go.geojson.FeatureCollection via JSON marshalling/unmarshalling
	b, err := json.Marshal(orbGeoJSON)
	if err != nil {
		log.Error("Failed to marshal orb geojson", "err", err)
		return
	}

	goGeoJSON, err := geojson.UnmarshalFeatureCollection(b)
	if err != nil {
		log.Error("Failed to unmarshal to go geojson", "err", err)
		return
	}

	topology := topojson.NewTopology(goGeoJSON, nil)
	// Convert the topology to TopoJSON
	topoJson, err := topology.MarshalJSON()
	if err != nil {
		log.Error("Failed to marshal TopoJSON", "err", err)
		return
	}

	//Convert to any
	var jsonObject map[string]any
	err = json.Unmarshal(topoJson, &jsonObject)
	if err != nil {
		log.Error("Failed to unmarshal TopoJSON", "err", err)
		return
	}

	log.Debug("Serializing to MsgPack")
	// Convert to MsgPack
	topoData, err = msgpack.Marshal(jsonObject)
	if err != nil {
		log.Error("Failed to marshal TopoJSON to MsgPack", "err", err)
		return
	}

	log.Debug("Successfully serialized TopoJSON to MsgPack")
}

func main() {
	lastActiveAlertsHash = make([]byte, 32)
	log.SetLevel(log.DebugLevel)

	ConnectToMongo()
	defer client.Disconnect(context.TODO())

	connectToUGCStore()
	defer CountyStore.Close()
	defer ZoneStore.Close()

	http.HandleFunc("/polygons", HandleGeoRequest)
	http.HandleFunc("/polygon", HandleSingleGeoRequest)

	go ConstructTopoJSON()
	go ScheduleTopoJSON(1 * time.Minute)
	http.ListenAndServe(":6906", nil)
}
