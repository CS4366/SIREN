package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"trackingService/CAP"

	"github.com/joho/godotenv"
	ampq "github.com/rabbitmq/amqp091-go"
	"github.com/redis/go-redis/v9"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

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

func handleAlertMessage(msg string) {
	var alert CAP.Alert
	//Unmarshal the message
	err := json.Unmarshal([]byte(msg), &alert)
	if err != nil {
		log.Printf("SKIPPING: Failed to unmarshal the message: %s\n", err)
		return
	}

	log.Printf("Received alert: %s\n", alert.Identifier)

	//Check if VTEC is available
	var alertInfo CAP.Info
	if len(alert.Info) > 0 {
		if alert.Info[0].Language == "en-US" {
			alertInfo = alert.Info[0]
		} else {
			alertInfo = alert.Info[1]
		}
	} else {
		log.Printf("SKIPPING: No info available for alert: %s\n", alert.Identifier)
		return
	}
	fmt.Printf("%v\n", alertInfo.Parameters.VTEC)

	var existingAlert CAP.Alert
	err = alertsCollection.FindOne(context.TODO(), bson.M{"identifier": alert.Identifier}).Decode(&existingAlert)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			//Insert the alert into the database
			_, err = alertsCollection.InsertOne(context.TODO(), alert)
			if err != nil {
				log.Printf("Failed to insert alert into the database: %s\n", err)
				return
			}
		} else {
			log.Printf("Failed to query the database: %s\n", err)
			return
		}
	} else {
		log.Printf("SKIPPING: Alert already exists in the database: %s\n", alert.Identifier)
		return
	}

	log.Printf("Alert inserted into the database: %s\n", alert.Identifier)

}
