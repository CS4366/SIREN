import express, { Application, Request, Response } from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import { open } from "lmdb";

const ugcDB = open(process.env.LMDB_DB || "nws_ugc.lmdb", {
  noSubdir: true,
});

interface UGC {
  UGC: string;
  feature: [number, number] | [[[number, number]]];
  type: "Polygon" | "MultiPolygon";
  lat: number;
  lon: number;
  state: string;
  name: string;
}

function mapToUGC(ugcItem: any): UGC {
  let type: "Polygon" | "MultiPolygon" = "Polygon";
  const feature = ugcItem.get("feature");
  if (Array.isArray(feature) && Array.isArray(feature[0][0])) {
    type = "MultiPolygon";
  }

  return {
    UGC: ugcItem.get("UGC"),
    lat: ugcItem.get("lat"),
    lon: ugcItem.get("lon"),
    name: ugcItem.get("name"),
    state: ugcItem.get("state"),
    feature,
    type,
  };
}

function joinWithAnd(arr: string[]): string {
  if (arr.length === 0) return "";
  if (arr.length === 1) return arr[0];
  if (arr.length === 2) return arr.join(" & ");

  return arr.slice(0, -1).join(", ") + " & " + arr[arr.length - 1];
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

// Retrieve an array of UGC records from LMDB based on UGC codes
const getUGCInfoArray = async (ugc: string[]): Promise<UGC[]> => {
  const info = await ugcDB.getMany(ugc);
  if (info.length === 0) {
    return [];
  }

  const ugcs: UGC[] = [];

  for (const ugcItem of info) {
    if (!ugcItem) {
      continue;
    }

    let type: "Polygon" | "MultiPolygon" = "Polygon";
    let feature = ugcItem.get("feature");
    if (Array.isArray(feature)) {
      if (Array.isArray(feature[0][0])) {
        type = "MultiPolygon";
      }
    }

    ugcs.push({
      UGC: ugcItem.get("UGC"),
      lat: ugcItem.get("lat"),
      lon: ugcItem.get("lon"),
      name: ugcItem.get("name"),
      state: ugcItem.get("state"),
      feature: feature,
      type: type,
    });
  }
  return ugcs;
};

const getUGCInfo = (ugc: string): UGC => {
  try {
    const ugcInfo = ugcDB.get(ugc);
    if (!ugcInfo) {
      throw new Error("No UGC found");
    }

    let type: "Polygon" | "MultiPolygon" = "Polygon";
    let feature = ugcInfo.get("feature");
    if (Array.isArray(feature)) {
      if (Array.isArray(feature[0][0])) {
        type = "MultiPolygon";
      }
    }

    return {
      UGC: ugcInfo.get("UGC"),
      lat: ugcInfo.get("lat"),
      lon: ugcInfo.get("lon"),
      name: ugcInfo.get("name"),
      state: ugcInfo.get("state"),
      feature: feature,
      type: type,
    };
  } catch (error) {
    console.error("Error fetching UGC info", error);
    throw error;
  }
};

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
    const updatedEvents = await Promise.all(
      activeEvents.map(async (event) => {
        const features = await getUGCInfoArray(event.areas);
        const areaDesc = joinWithAnd(
          features.map((info) => `${info.name} ${info.state}`)
        );

        if (event.capInfo.info.area.polygon == null) {
          return {
            ...event,
            features: features.map((info) => ({
              data: info.feature,
              type: info.type,
            })),
            areaDescription: areaDesc,
          };
        } else {
          return {
            ...event,
            areaDescription: areaDesc,
          };
        }
      })
    );

    res.status(200).json(updatedEvents);
  } catch (error) {
    console.error("Error fetching active events", error);
    res.status(500).send("Error fetching active events");
  }
});

app.post<{}, {}, { codes: string[] }>(
  "/ugc",
  async (
    req: Request<{}, {}, { codes: string[] }>,
    res: Response
  ): Promise<void> => {
    const ugc = req.body.codes;
    if (!ugc || ugc.length === 0) {
      res.status(400).send("No UGC codes provided");
      return;
    }
    try {
      const ugcInfo = getUGCInfoArray(ugc);
      res.status(200).json(ugcInfo);
    } catch (error) {
      console.error("Error fetching UGC info", error);
      res.status(500).send("Error fetching UGC info");
    }
  }
);

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
