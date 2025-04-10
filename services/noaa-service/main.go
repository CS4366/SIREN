package main

import (
	"noaaService/CAP"
	"regexp"
	"strings"

	"crypto/tls"
	"encoding/xml"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/joho/godotenv"
	ampq "github.com/rabbitmq/amqp091-go"
	"github.com/xmppo/go-xmpp"

	"github.com/vmihailenco/msgpack"
)

func debugLog(msg string) {
	if os.Getenv("ENV") != "PROD" {
		log.Println(msg)
	}
}

// Message queue connection
var conn *ampq.Connection
var ch *ampq.Channel
var trackingQueue ampq.Queue

func connectToMQ() {
	var err error

	rmqURL := os.Getenv("RABBITMQ_URL")
	if rmqURL == "" {
		rmqURL = "amqp://localhost"
	}

	conn, err = ampq.Dial(rmqURL)
	if err != nil {
		log.Fatalf("Failed to connect to the message queue")
		return
	}

	ch, err = conn.Channel()
	if err != nil {
		log.Fatalf("Failed to open a channel")
	}

	trackingQueue, err = ch.QueueDeclare("tracking", true, false, false, false, nil)
	if err != nil {
		log.Fatalf("Failed to declare the tracking queue")
	}

	log.Println("Successfully connected to RabbitMQ and declared queue")
}

func main() {
	if os.Getenv("ENV") != "PROD" {
		err := godotenv.Load(".env")
		if err != nil {
			log.Fatalf("Error loading .env file")
		}
	}

	log.Println("SIREN - Service for Instant Relay of Emergency Notifications")

	// Connect to message queue
	log.Println("Starting connection to message queue...")
	connectToMQ()
	// Close the connection and channel when the main function exits
	defer conn.Close()
	defer ch.Close()

	log.Println("Starting connection to NWWS ingress server...")

	user := os.Getenv("NWWS_USER")
	if user == "" {
		log.Fatal("NWWS_USER environment variable not set")
	}
	password := os.Getenv("NWWS_PASSWORD")
	if password == "" {
		log.Fatal("NWWS_PASSWORD environment variable not set")
	}
	nickname := os.Getenv("NWWS_NICKNAME")
	if nickname == "" {
		log.Fatal("NWWS_NICKNAME environment variable not set")
	}

	// Reconnection Parameters, see https://en.wikipedia.org/wiki/Exponential_backoff
	minBackoff := 10 * time.Second
	maxBackoff := 5 * time.Minute
	backoff := minBackoff

	// Alert parsing channel and Goroutine
	alerts := make(chan string)
	go handleAlertXML(alerts)

	// Main loop for XMPP connection
	for {
		log.Println("Attempting NWWS connection...")
		options := xmpp.Options{
			Host:          "nwws-oi.weather.gov:5222",
			User:          fmt.Sprintf("%s@nwws-oi.weather.gov", user),
			Password:      password,
			Resource:      "nwws",
			NoTLS:         true,
			StartTLS:      true,
			Debug:         false,
			Session:       true,
			Status:        "chat",
			StatusMessage: "",
			TLSConfig: &tls.Config{
				ServerName: "nwws-oi.weather.gov",
			},
		}

		client, err := options.NewClient()
		if err != nil {
			log.Printf("\nError creating XMPP client (NWWS may be offline): %v", err)
		} else {
			log.Println("Logged into NWWS XMPP client")

			// Join the NWWS chatroom and get the last 50 messages
			// TODO: We'll probably want a way to reconcile the last 50 messages so we don't resend alerts. The REDIS cache is a good place to start.
			_, err = client.JoinMUC("NWWS@conference.nwws-oi.weather.gov", nickname, xmpp.StanzaHistory, 50, nil)
			if err != nil {
				log.Printf("\nFailed to join NWWS chatroom: %v", err)
			} else {
				log.Println("Joined NWWS chatroom")

				err = processChatroomMessages(client, alerts)
				if err != nil {
					log.Printf("\nClient disconnected with error: %v", err)
				}
			}

			client.Close()
		}

		// Ensure backoff is handled correctly
		log.Printf("\nDisconnected. Reconnecting in %v...", backoff)
		time.Sleep(backoff)
		backoff = increaseBackoff(backoff, maxBackoff)
	}
}

func increaseBackoff(backoff, maxBackoff time.Duration) time.Duration {
	if backoff < maxBackoff {
		backoff *= 2
		if backoff > maxBackoff {
			backoff = maxBackoff
		}
		return backoff
	}
	return maxBackoff
}

func processChatroomMessages(client *xmpp.Client, alerts chan string) error {
	for {
		stanza, err := client.Recv()
		if err != nil {
			log.Printf("\nError receiving XMPP stanza: %v", err)
			return err
		}
		switch v := stanza.(type) {
		// There is a lot of XMPP stanza parsing here, but the important part is that we are looking for CAP alerts
		case xmpp.Chat:
			if v.Type == "groupchat" {
				// Find the special <x> element with the CAP alert
				for _, child := range v.OtherElem {
					if child.XMLName.Local == "x" {
						awipsID := ""
						// Look for the awipsid attribute
						for _, attr := range child.Attr {
							if attr.Name.Local == "awipsid" {
								awipsID = attr.Value
								break
							}
						}
						// If the awipsid attribute is present, and it starts with "CAP", then we have a CAP alert
						if strings.HasPrefix(awipsID, "CAP") {
							// Grab the content of the <x> element
							content := child.InnerXML
							// Find the <alert> element within the content
							re := regexp.MustCompile(`(?s)(?:<!\[CDATA\[.*?)(<alert.*?>.*?</alert>)(?:.*?\]\]>)`)
							matches := re.FindStringSubmatch(content)
							if len(matches) < 2 {
								log.Println("No <alert> element found in content.")
								continue
							}
							// Send the alert to the alerts channel
							alerts <- matches[1]
						}
					}
				}
			}
		case xmpp.Presence:
			continue
		case xmpp.IQ:
			continue
		default:
			continue
		}
	}
}

func handleAlertXML(alerts <-chan string) {
	for alertXML := range alerts {
		var alert CAP.AlertXML
		err := xml.Unmarshal([]byte(alertXML), &alert)
		if err != nil {
			log.Printf("Failed to unmarshal alert: %v\n", err)
			continue
		}

		alertJson, err := CAP.ConvertXMLToJsonStruct(&alert)
		if err != nil {
			log.Printf("Failed to convert alert to JSON struct: %v\n", err)
			continue
		}

		alertJsonBytes, err := msgpack.Marshal(alertJson)
		if err != nil {
			log.Printf("Failed to convert alert to JSON: %v\n", err)
			continue
		}

		//Marshall to JSON and Send alert to message queue
		err = ch.Publish("", trackingQueue.Name, false, false, ampq.Publishing{
			ContentType: "application/msgpack",
			Body:        alertJsonBytes,
		})
		if err != nil {
			log.Printf("Failed to publish alert to message queue: %v\n", err)
			continue
		}
	}
}
