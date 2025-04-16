import express, { Application, Request, Response } from "express";
import cors from "cors";
import { MongoClient } from "mongodb";

interface UGC {
  UGC: string;
  feature: [number, number] | [[[number, number]]];
  type: "Polygon" | "MultiPolygon";
  lat: number;
  lon: number;
  state: string;
  name: string;
}

// Init express application
const app: Application = express();
const PORT = process.env.PORT || 3030;

//MongoDB connection
const uri = process.env.MONGO_URL || "mongodb://localhost:27017";
const client = new MongoClient(uri);
client
  .connect()
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((err) => {
    console.error("Error connecting to MongoDB", err);
  });
const db = client.db("siren");
const events = db.collection("state");

// Use middleware JSON
app.use(express.json());
app.use(cors());

// Routes
app.get("/", (req: Request, res: Response) => {
  res.send("SIREN API");
});

// Get all alerts issued today
app.get("/alerts/today", async (req: Request, res: Response) => {
  // Check if MongoDB is connected
  if (!client) {
    res.status(500).send("MongoDB not connected");
    return;
  }
  // Get the alerts collection
  try {
    const alerts = db.collection("alerts");
    // Get the current date in UTC
    const now = new Date();
    const startOfDay = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );
    const endOfDay = new Date(startOfDay);
    endOfDay.setUTCDate(startOfDay.getUTCDate() + 1);
    // Get all alerts issued today
    const todaysAlerts = await alerts
      .find({
        sent: {
          $gte: startOfDay,
          $lt: endOfDay,
        },
      })
      .toArray();
    // Send the alerts as a response
    res.status(200).json(todaysAlerts);
  } catch (error) {
    console.error("Error fetching today's alerts", error);
    res.status(500).send("Error fetching today's alerts");
  }
});

// Get most common alert event from today
app.get("/alerts/today/common", async (req: Request, res: Response) => {
  // Check if MongoDB is connected
  if (!client) {
    res.status(500).send("MongoDB not connected");
    return;
  }
  // Get the alerts collection
  try {
    const alerts = db.collection("alerts");
    // Get the current date in UTC
    const now = new Date();
    const startOfDay = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );
    const endOfDay = new Date(startOfDay);
    endOfDay.setUTCDate(startOfDay.getUTCDate() + 1);
    // Get the most common alert event from today
    const todaysAlerts = await alerts
      .aggregate([
        {
          $match: {
            sent: {
              $gte: startOfDay,
              $lt: endOfDay,
            },
          },
        },
        {
          $group: {
            _id: "$info.event",
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 1 },
      ])
      .toArray();
    // Send the most common alert event as a response
    res.status(200).json(todaysAlerts);
  } catch (error) {
    console.error("Error fetching today's alerts", error);
    res.status(500).send("Error fetching today's alerts");
  }
});

// Get most common alert event from yesterday
app.get("/alerts/yesterday/common", async (req: Request, res: Response) => {
  // Check if MongoDB is connected
  if (!client) {
    res.status(500).send("MongoDB not connected");
    return;
  }
  // Get the alerts collection
  try {
    const alerts = db.collection("alerts");
    // Get the yesterdays date in UTC
    const now = new Date();
    const startOfDay = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );
    startOfDay.setUTCDate(startOfDay.getUTCDate() - 1);
    const endOfDay = new Date(startOfDay);
    endOfDay.setUTCDate(startOfDay.getUTCDate() + 1);
    // Get the most common alert event from yesterday
    const todaysAlerts = await alerts
      .aggregate([
        {
          $match: {
            sent: {
              $gte: startOfDay,
              $lt: endOfDay,
            },
          },
        },
        {
          $group: {
            _id: "$info.event", // Group by the event text
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 1 },
      ])
      .toArray();
    // Send the most common alert event as a response
    res.status(200).json(todaysAlerts);
  } catch (error) {
    console.error("Error fetching today's alerts", error);
    res.status(500).send("Error fetching today's alerts");
  }
});

// Get all alerts issued yesterday (UTC)
app.get("/alerts/yesterday", async (req: Request, res: Response) => {
  // Check if MongoDB is connected
  if (!client) {
    res.status(500).send("MongoDB not connected");
    return;
  }
  // Get the alerts collection
  try {
    const alerts = db.collection("alerts");
    // Get the yesterdays date in UTC
    const now = new Date();
    const startOfDay = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );
    startOfDay.setUTCDate(startOfDay.getUTCDate() - 1);
    const endOfDay = new Date(startOfDay);
    endOfDay.setUTCDate(startOfDay.getUTCDate() + 1);
    // Get all alerts issued yesterday
    const todaysAlerts = await alerts
      .find({
        sent: {
          $gte: startOfDay,
          $lt: endOfDay,
        },
      })
      .toArray();
    // Send the alerts as a response
    res.status(200).json(todaysAlerts);
  } catch (error) {
    console.error("Error fetching today's alerts", error);
    res.status(500).send("Error fetching today's alerts");
  }
});

// Get the 3 most commonly used sendernames from today
app.get("/alerts/today/regions", async (req: Request, res: Response) => {
  // Check if MongoDB is connected
  if (!client) {
    res.status(500).send("MongoDB not connected");
    return;
  }
  // Get the alerts collection
  try {
    const alerts = db.collection("alerts");
    // Get the current date in UTC
    const now = new Date();
    const startOfDay = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );
    const endOfDay = new Date(startOfDay);
    endOfDay.setUTCDate(startOfDay.getUTCDate() + 1);
    // Get the 3 most commonly used sendernames from today
    const topSendernames = await alerts
      .aggregate([
        {
          $match: {
            sent: {
              $gte: startOfDay,
              $lt: endOfDay,
            },
          },
        },
        {
          $group: {
            _id: "$info.sendername", // Group by sendername
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 3 },
        {
          $project: {
            _id: 0,
            sendername: "$_id", // Rename _id to sendername
          },
        },
      ])
      .toArray();
    // Map the results to get the sendernames
    const sendernamesList = topSendernames.map((item) => item.sendername);
    // Send the sendernames as a response
    res.status(200).json(sendernamesList);
  } catch (error) {
    console.error("Error fetching top sendernames", error);
    res.status(500).send("Error fetching top sendernames");
  }
});

// Get the 3 most commonly used sendernames from today
app.get("/alerts/yesterday/regions", async (req: Request, res: Response) => {
  // Check if MongoDB is connected
  if (!client) {
    res.status(500).send("MongoDB not connected");
    return;
  }
  // Get the alerts collection
  try {
    const alerts = db.collection("alerts");
    // Get the yesterdays date in UTC
    const now = new Date();
    const startOfDay = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );
    startOfDay.setUTCDate(startOfDay.getUTCDate() - 1);
    const endOfDay = new Date(startOfDay);
    endOfDay.setUTCDate(startOfDay.getUTCDate() + 1);
    // Get the 3 most commonly used sendernames from yesterday
    const topSendernames = await alerts
      .aggregate([
        {
          $match: {
            sent: {
              $gte: startOfDay,
              $lt: endOfDay,
            },
          },
        },
        {
          $group: {
            _id: "$info.sendername", // Group by sendername
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 2 },
        {
          $project: {
            _id: 0,
            sendername: "$_id", // Rename _id to sendername
          },
        },
      ])
      .toArray();
    // Map the results to get the sendernames
    const sendernamesList = topSendernames.map((item) => item.sendername);
    // Send the sendernames as a response
    res.status(200).json(sendernamesList);
  } catch (error) {
    console.error("Error fetching top sendernames", error);
    res.status(500).send("Error fetching top sendernames");
  }
});

// Get all active alerts
app.get("/active", async (req: Request, res: Response) => {
  // Check if MongoDB is connected
  if (!client) {
    res.status(500).send("MongoDB not connected");
    return;
  }
  // Get the alerts collection
  try {
    //This is an extremely inefficient way to do this, but it works for now
    //we need to actively modifying the state instead of trying to do it this way
    const active = events.aggregate([
      { $match: { state: "Active" } },
      {
        $lookup: {
          from: "alerts",
          localField: "mostRecentCAP",
          foreignField: "identifier",
          as: "capInfo",
        },
      },
      { $unwind: "$capInfo" },
    ]);
    // Get all active alerts
    const activeEvents = await active.toArray();
    // Send the active alerts as a response
    res.status(200).json(activeEvents);
  } catch (error) {
    console.error("Error fetching active events", error);
    res.status(500).send("Error fetching active events");
  }
});

// Listen for requests
app.listen(PORT, () => {
  console.log(`SIREN api-service is running on port ${PORT}`);
});

// Close on exit
process.on("exit", (code: number) => {
  console.log(`Process exited with code ${code}`);
  console.log("Closing MongoDB connection...");
  client.close();
});
