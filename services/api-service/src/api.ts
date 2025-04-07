import express, { Application, Request, Response } from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import Database from "better-sqlite3";

const ugcDB = new Database(process.env.SQLITE_DB || "nws_ugc.sqlite");

interface UGCRaw {
  UGC: string;
  feature: string;
  lat: number;
  lon: number;
  state: string;
  name: string;
}

interface UGC {
  UGC: string;
  feature: [number, number] | [[[number, number]]];
  type: "Polygon" | "MultiPolygon";
  lat: number;
  lon: number;
  state: string;
  name: string;
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
const uri = process.env.MONGO_URL || "mongodb://mongodb:27017";
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

const getUGCInfoArray = (ugc: string[]): UGC[] => {
  const ugcInfo = ugc.map((ugcItem) =>
    ugcDB
      .prepare<string, UGCRaw>(`SELECT * FROM ugc WHERE UGC = ?`)
      .get(ugcItem)
  );

  if (ugcInfo.length === 0) {
    throw new Error("No UGC found");
  }

  return ugcInfo.map((info: any) => {
    return {
      ...info,
      feature: JSON.parse(info.feature),
      type: info.feature.includes("[[[") ? "MultiPolygon" : "Polygon",
    };
  });
};

const getUGCInfo = async (ugc: string): Promise<UGC> => {
  const ugcInfo = ugcDB
    .prepare<string, UGCRaw>(`SELECT * FROM ugc WHERE UGC = ?`)
    .get(ugc);
  if (!ugcInfo) {
    throw new Error("No UGC found");
  }

  return {
    ...ugcInfo,
    feature: JSON.parse(ugcInfo.feature),
    type: ugcInfo.feature.includes("[[[") ? "MultiPolygon" : "Polygon",
  };
};

// Use middleware JSON
app.use(express.json());
app.use(cors());

// Routes
app.get("/", (req: Request, res: Response) => {
  res.send("SIREN API");
});

app.get("/active", async (req: Request, res: Response) => {
  if (client) {
    const active = events.aggregate([
      {
        $match: {
          state: "Active",
        },
      },
      {
        $lookup: {
          from: "alerts",
          localField: "mostRecentCAP",
          foreignField: "identifier",
          as: "capInfo",
        },
      },
      {
        $unwind: "$capInfo",
      },
      {
        $match: {
          "capInfo.info.expires": {
            $gt: new Date(),
          }, // Not expired
        },
      },
    ]);

    const activeEvents = await active.toArray();
    activeEvents.forEach((event, index) => {
      let features = getUGCInfoArray(event.areas);
      let areaDesc = joinWithAnd(
        features.map((info) => `${info.name} ${info.state}`)
      );

      if (event.capInfo.info.area.polygon == null) {
        activeEvents[index] = {
          ...event,
          features: features.map((info) => {
            return {
              data: info.feature,
              type: info.type,
            };
          }),
          areaDescription: areaDesc,
        };
      } else {
        activeEvents[index] = {
          ...event,
          // Join each features.name with a comma except for the last one
          areaDescription: areaDesc,
        };
      }
    });

    res.status(200).json(activeEvents);
  } else {
    res.status(500).send("MongoDB not connected");
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
