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

app.get("/active", async (req: Request, res: Response) => {
  if (!client) {
    res.status(500).send("MongoDB not connected");
    return;
  }

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
      { $match: { "capInfo.info.expires": { $gt: new Date() } } },
    ]);

    const activeEvents = await active.toArray();

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
