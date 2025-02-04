package main

import (
	"fmt"
	"log"
	"os"

	ampq "github.com/rabbitmq/amqp091-go"
)

var ch *ampq.Channel
var trackingQueue ampq.Queue
var liveQueue ampq.Queue

// Connect to message queue
func connectToMQ() {
	//Dial to the message queue
	conn, err := ampq.Dial(os.Getenv("RABBITMQ_URL"))
	if err != nil {
		log.Fatalf("Failed to connect to the message queue")
		return
	}
	defer conn.Close()

	ch, err = conn.Channel()
	if err != nil {
		log.Fatalf("Failed to open a channel")
	}
	defer ch.Close()

	//Connect to the tracking queue
	trackingQueue, err = ch.QueueDeclare("tracking", true, false, false, false, nil)
	if err != nil {
		log.Fatalf("Failed to declare the tracking queue")
	}

	//Connect to the live queue
	liveQueue, err = ch.QueueDeclare("live", true, false, false, false, nil)
	if err != nil {
		log.Fatalf("Failed to declare the live queue")
	}

}

func main() {
	fmt.Println("Starting tracking service...")
	connectToMQ()

	//Consume messages from the tracking queue
	msgs, err := ch.Consume(trackingQueue.Name, "", true, false, false, false, nil)
	if err != nil {
		log.Fatalf("Failed to consume messages from the tracking queue")
	}

	forever := make(chan bool)

	go func() {
		for d := range msgs {
			handleAlertMessage(string(d.Body))
			//Publish the message to the live queue
			err := ch.Publish("", liveQueue.Name, false, false, ampq.Publishing{
				ContentType: "text/plain",
				Body:        d.Body,
			})
			if err != nil {
				log.Panicf("Failed to publish a message to the live queue")
			}
		}
	}()

	log.Println("Waiting for messages. To exit press CTRL+C")
	<-forever
}

func handleAlertMessage(msg string) {
	//EDIT ME TO HANDLE ALERT TRACKING
	fmt.Println("Handling alert message: ", msg)
}
