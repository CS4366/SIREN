package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"trackingService/CAP"
	"trackingService/VTEC"

	"github.com/joho/godotenv"
	ampq "github.com/rabbitmq/amqp091-go"
	"github.com/redis/go-redis/v9"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

func debugLog(msg string) {
	if os.Getenv("ENV") != "PROD" {
		log.Println(msg)
	}
}

var ctx = context.Background()

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
		log.Fatalf("Failed to connect to the message queue")
		return
	}

	ch, err = conn.Channel()
	if err != nil {
		log.Fatalf("Failed to open a channel")
	}

	//Connect to the tracking queue
	trackingQueue, err = ch.QueueDeclare("tracking", true, false, false, false, nil)
	if err != nil {
		log.Fatalf("Failed to declare the tracking queue")
	}

	//Connect to the live queue
	liveQueue, err = ch.QueueDeclare("push", true, false, false, false, nil)
	if err != nil {
		log.Fatalf("Failed to declare the push queue")
	}

}

var client *mongo.Client
var alertsCollection *mongo.Collection

func ConnectToMongo() {
	//Connect to MongoDB
	uri := os.Getenv("MONGO_URI")
	if uri == "" {
		fmt.Printf("Warning: MONGO_URI not set. Using default value, this may not work.\n")
		uri = "mongodb://localhost:27017"
	}

	var err error
	client, err = mongo.Connect(options.Client().ApplyURI(uri))
	if err != nil {
		log.Fatalf("Failed to connect to MongoDB")
	}

	alertsCollection = client.Database("siren").Collection("alerts")
}

var r *redis.Client

func ConnectToRedis() {
	uri := os.Getenv("REDIS_URI")
	if uri == "" {
		fmt.Printf("Warning: REDIS_URI not set. Using default value, this may not work.\n")
		uri = "localhost:6379"
	}

	r = redis.NewClient(&redis.Options{
		Addr:     uri,
		Password: "",
		DB:       0,
	})

}

func main() {
	if os.Getenv("ENV") != "PROD" {
		err := godotenv.Load()
		if err != nil {
			log.Fatalf("Error loading .env file")
		}
	}

	fmt.Println("Starting tracking service...")
	fmt.Println("Connecting to message queue...")

	connectToMQ()
	defer conn.Close()
	defer ch.Close()

	ConnectToMongo()
	defer func() {
		if err := client.Disconnect(context.TODO()); err != nil {
			panic(err)
		}
	}()

	//ConnectToRedis()
	//defer r.Close()

	//Consume messages from the tracking queue
	msgs, err := ch.Consume(trackingQueue.Name, "", true, false, false, false, nil)
	if err != nil {
		log.Fatalf("Failed to consume messages from the tracking queue")
	}

	forever := make(chan bool)

	go func() {
		for d := range msgs {
			handleAlertMessage(string(d.Body))
		}
	}()

	log.Println("Waiting for messages. To exit press CTRL+C")
	<-forever
}

func getCanonicalIdentifier(vtec *VTEC.VTEC) string {
	//Func to get the canonical identifier from the vtec
	canonicalIdentifier := fmt.Sprintf("%s%s-%s-%d", vtec.Phenomena, vtec.Significance, vtec.OfficeIdentifier, vtec.EventTrackingNumber)
	return canonicalIdentifier
}

func determineAlertState(alert CAP.Alert, vtec *VTEC.VTEC) string {
	// Func to determine the alert state from the vtec
	canonicalIdentifier := getCanonicalIdentifier(vtec)

	return canonicalIdentifier
}

func handleAlertMessage(msg string) {
	var alert CAP.Alert
	//Unmarshal the message
	err := json.Unmarshal([]byte(msg), &alert)
	if err != nil {
		debugLog(fmt.Sprintf("SKIPPING: Failed to unmarshal the message: %s", err))
		return
	}

	debugLog(fmt.Sprintf("Received alert: %s", alert.Identifier))

	//Check if VTEC is available
	var alertInfo CAP.Info
	if len(alert.Info) > 0 {
		if alert.Info[0].Language == "en-US" {
			alertInfo = alert.Info[0]
		} else {
			alertInfo = alert.Info[1]
		}
	} else {
		debugLog(fmt.Sprintf("SKIPPING: No info available for alert: %s", alert.Identifier))
		return
	}

	vtec, err := VTEC.ParseVTEC(alertInfo.Parameters.VTEC)
	if err != nil {
		debugLog(fmt.Sprintf("SKIPPING: Failed to parse VTEC: %s", err))
	}

	if vtec != nil {
		alert.SirenIdentifier = getCanonicalIdentifier(vtec)
	} else {
		alert.SirenIdentifier = alert.Identifier
	}

	var existingAlert CAP.Alert
	err = alertsCollection.FindOne(context.TODO(), bson.M{"identifier": alert.Identifier}).Decode(&existingAlert)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			//Insert the alert into the database
			_, err = alertsCollection.InsertOne(context.TODO(), alert)
			//Handle the error
			if err != nil {
				debugLog(fmt.Sprintf("Failed to insert alert into the database: %s", err))
				return
			}

			//Publish the alert to the live queue
			alertJson, err := json.Marshal(alert)
			if err != nil {
				debugLog(fmt.Sprintf("Failed to marshal alert to JSON: %s", err))
				return
			}
			err = ch.Publish("", liveQueue.Name, false, false, ampq.Publishing{
				ContentType: "application/json",
				Body:        alertJson,
			})

			if err != nil {
				debugLog(fmt.Sprintf("Failed to publish alert to the live queue: %s", err))
				return
			}

		} else {
			debugLog(fmt.Sprintf("Failed to query the database: %s", err))
			return
		}
	} else {
		debugLog(fmt.Sprintf("SKIPPING: Alert already exists in the database: %s", alert.Identifier))
		return
	}

	debugLog(fmt.Sprintf("Alert inserted into the database: %s", alert.Identifier))
}
