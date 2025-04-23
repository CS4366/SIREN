import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  AlertColorMap,
  SirenAlert,
  SirenPushNotification,
} from "../../model/Alert";
import { io } from "socket.io-client";
import { decode } from "@msgpack/msgpack";
import { feature } from "topojson-client";
import { addToast } from "@heroui/react";
import { useQueue } from "@uidotdev/usehooks";

interface AlertContextProps {
  alertsLoading: boolean;
  isPushConnected: boolean;
  isAPIConnected: boolean;
  alertData: SirenAlert[];
  setAlertData: React.Dispatch<React.SetStateAction<SirenAlert[]>>;
  polygonGeoJson: GeoJSON.FeatureCollection;
  setPolygonGeoJson: React.Dispatch<
    React.SetStateAction<GeoJSON.FeatureCollection>
  >;
  countyGeoJson: GeoJSON.FeatureCollection;
  setCountyGeoJson: React.Dispatch<
    React.SetStateAction<GeoJSON.FeatureCollection>
  >;
  activeAlerts: number;
  shownAt: React.MutableRefObject<number | null>;
  currentNotification: SirenPushNotification | null;
  setCurrentNotification: React.Dispatch<
    React.SetStateAction<SirenPushNotification | null>
  >;
  pushGeoJson: GeoJSON.FeatureCollection;
  pushAlertList: SirenAlert[];
}

// Push URL
const LIVE_URL =
  import.meta.env.MODE === "production"
    ? "https://live.sirenwx.io"
    : "https://localhost:4000";

// API URL
const API_URL =
  import.meta.env.MODE === "production"
    ? "https://api.sirenwx.io"
    : "https://localhost:3030";

// GEO URL
const GEO_URL =
  import.meta.env.MODE === "production"
    ? "https://geo.sirenwx.io"
    : "http://localhost:6906";

const AlertContext = createContext<AlertContextProps | undefined>(undefined);

export const AlertProvider = ({ children }: { children: ReactNode }) => {
  // Socket connection to Push service
  const socket = io(LIVE_URL, {
    autoConnect: false,
  });

  // State variables for push and API connection status
  const [isLoading, setIsLoading] = useState(true);
  const [isPushConnected, setIsPushConnected] = useState(socket.connected);
  const [isAPIConnected, setIsAPIConnected] = useState(false);
  const [activeAlerts, setActiveAlerts] = useState(0);
  const [alertData, setAlertData] = useState<SirenAlert[]>([]);
  const [polygonGeoJson, setPolygonGeoJson] =
    useState<GeoJSON.FeatureCollection>({
      type: "FeatureCollection",
      features: [],
    });
  const [countyGeoJson, setCountyGeoJson] = useState<GeoJSON.FeatureCollection>(
    {
      type: "FeatureCollection",
      features: [],
    }
  );

  // Push service connection
  const [alerts, setAlerts] = useState<Record<string, SirenAlert>>({});
  const [polys, setPolys] = useState<Record<string, GeoJSON.Feature>>({});

  const pendingIds = useRef<Set<string>>(new Set());
  const BATCH_WAIT = 800; // ms idle-time before we fire the batch
  const BATCH_MAX = 25; // never ask the API for more than 25 IDs
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pushGeoJson = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: "FeatureCollection",
      features: Object.values(polys),
    }),
    [polys]
  );

  const pushAlertList = useMemo(() => Object.values(alerts), [alerts]);

  // Socket Handling and Setup
  useEffect(() => {
    socket.connect();

    return () => {
      socket.disconnect();
    };
  }, []);

  // Check if API is connected
  useEffect(() => {
    fetch(API_URL).then((res) => {
      if (res.ok) {
        setIsAPIConnected(true);
      } else {
        setIsAPIConnected(false);
      }
    });
  }, []);

  const notificationQueue = useQueue<SirenPushNotification>();
  const [currentNotification, setCurrentNotification] =
    useState<SirenPushNotification | null>(null);

  const shownAt = useRef<number | null>(null);

  async function flushBatch() {
    timer.current = null;
    const ids = Array.from(pendingIds.current).slice(0, BATCH_MAX);
    ids.forEach((id) => pendingIds.current.delete(id));

    try {
      const capRes = await fetch(`${API_URL}/alerts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(ids),
      });
      const capData: SirenAlert[] = await capRes.json();

      const geoIds: string[] = [];
      capData.forEach((alert) => {
        if (!alert.capInfo.info.area.polygon) {
          geoIds.push(alert.identifier);
        }
      });

      let topo: TopoJSON.Topology | undefined;
      if (geoIds.length > 0) {
        const geoRes = await fetch(`${GEO_URL}/polygon`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(geoIds),
        });
        const topoBuf = new Uint8Array(await geoRes.arrayBuffer());
        topo = decode(topoBuf) as TopoJSON.Topology;
      }

      // merge into caches
      setAlerts((prev) => {
        const next = { ...prev };
        for (const alert of capData) next[alert.identifier] = alert;
        return next;
      });

      setPolys((prev) => {
        const next = { ...prev };
        for (const alert of capData) {
          if (!alert.capInfo.info.area.polygon) continue;
          next[alert.identifier] = {
            type: "Feature",
            geometry: alert.capInfo.info.area.polygon,
            properties: {
              id: alert.identifier,
              name: alert.capInfo.info.event,
              color:
                AlertColorMap.get(alert.capInfo.info.eventcode.nws) ||
                "#efefef",
            },
          };
        }
        if (!topo) return next;
        const fcs = Object.values(topo.objects).map((o) => feature(topo, o));
        for (const fc of fcs) {
          (fc.type === "FeatureCollection" ? fc.features : [fc]).forEach(
            (f) => {
              next[f.properties!.id] = {
                ...f,
                properties: {
                  ...f.properties,
                  name: alerts[f.properties!.id]?.capInfo.info.event,
                  color:
                    AlertColorMap.get(
                      alerts[f.properties!.id]?.capInfo.info.eventcode.nws ?? ""
                    ) ?? "#efefef",
                },
              };
            }
          );
        }
        return next;
      });
    } catch (e) {
      console.error("batch fetch failed", e);
    }

    // still more IDs queued? schedule another burst right away
    if (pendingIds.current.size) flushBatch();
  }

  // Check if socket is connected
  useEffect(() => {
    async function onLive(msg) {
      try {
        let bytes: Uint8Array;
        if (msg instanceof Uint8Array) {
          bytes = msg;
        } else {
          bytes = new Uint8Array(msg);
        }
        const alert = decode(bytes) as SirenPushNotification;

        notificationQueue.add(alert);

        if (
          alert.Action == "New" ||
          !alertData.find((existing) => alert.Identifier == existing.identifier)
        ) {
          pendingIds.current.add(alert.Identifier);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(flushBatch, BATCH_WAIT);
        }
      } catch (error) {
        console.error("Error decoding live message:", error);
      }
    }

    function onConnect() {
      setIsPushConnected(true);
      addToast({
        title: "Connected to Push Service",
        description: "You are now receiving live alerts.",
        timeout: 5000,
        color: "success",
      });

      socket.on("live", onLive);
    }

    function onDisconnect() {
      setIsPushConnected(false);
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("live", onLive);
    };
  }, []);

  const tryShow = useCallback(
    (next: SirenPushNotification) => {
      const now = Date.now();

      // Nothing on screen yet → show right away.
      if (!currentNotification) {
        shownAt.current = now;
        setCurrentNotification(next);
        return;
      }

      // How long has the current banner been up?
      const elapsed = now - (shownAt.current ?? now);

      // Has it been visible ≥ 10 s?
      if (elapsed >= 10000) {
        shownAt.current = now;
        setCurrentNotification(next);
      } else {
        // Need to wait the remaining time, then try again.
        const waiting = 100000 - elapsed;
        setTimeout(() => tryShow(next), waiting);
      }
    },
    [currentNotification]
  );

  useEffect(() => {
    if (notificationQueue.size === 0) return;

    const next = notificationQueue.first;
    notificationQueue.remove();
    if (next) tryShow(next);
  }, [notificationQueue.size, currentNotification]);

  // Gathering active alerts from the API
  useEffect(() => {
    setIsLoading(true);
    fetch(`${API_URL}/active`)
      .then((res) => {
        if (res.ok) {
          res.json().then((data) => {
            setAlertData(data);
            setActiveAlerts(data.length);
          });
        } else {
          console.log("Error fetching active alerts data");
        }
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  // Gathering polygons from geo service
  useEffect(() => {
    fetch(`${GEO_URL}/polygons`).then((res) => {
      if (res.ok) {
        res.arrayBuffer().then((arrayBuffer) => {
          const uint8Array = new Uint8Array(arrayBuffer);
          // Decode the MessagePack data
          const topoData = decode(uint8Array) as TopoJSON.Topology;

          const combinedFeatures: GeoJSON.FeatureCollection = {
            type: "FeatureCollection",
            features: [],
          };

          let features: GeoJSON.Feature[] = [];
          for (const key in topoData.objects) {
            const geo = feature(topoData, topoData.objects[key]);

            if (geo.type == "FeatureCollection") {
              features = features.concat(geo.features);
            } else {
              features.push(geo);
            }
          }
          combinedFeatures.features = features;
          combinedFeatures.features.forEach((feature, index) => {
            // Add the color property to each feature
            const alert = alertData.find(
              (alert: SirenAlert) => alert.identifier === feature.properties?.id
            );
            if (alert) {
              if (!combinedFeatures.features[index].properties) {
                combinedFeatures.features[index].properties = {};
              }
              combinedFeatures.features[index].properties.name =
                alert.capInfo.info.event;
            }
          });

          setCountyGeoJson({
            type: "FeatureCollection",
            features: combinedFeatures.features,
          });
        });
      } else {
        console.log("Error fetching polygons for counties");
      }
    });
  }, [alertData]);

  // Mapping properties for polygons on map
  useEffect(() => {
    const updatePolygonFeatures = () => {
      const polygonFeatures = alertData
        .map((alert: SirenAlert) => {
          const polygon = alert.capInfo.info.area.polygon;
          if (polygon) {
            return {
              type: "Feature",
              geometry: polygon,
              properties: {
                id: alert.identifier,
                name: alert.capInfo.info.event,
                color:
                  AlertColorMap.get(alert.capInfo.info.eventcode.nws) ||
                  "#efefef",
              },
            };
          }
        })
        .filter(Boolean);

      // Insert polygon features into the polygonGeojson state
      setPolygonGeoJson({
        type: "FeatureCollection",
        features: polygonFeatures as GeoJSON.Feature[],
      });
    };

    updatePolygonFeatures();
  }, [alertData]);

  return (
    <AlertContext.Provider
      value={{
        alertsLoading: isLoading,
        isPushConnected,
        isAPIConnected,
        alertData,
        setAlertData,
        polygonGeoJson,
        setPolygonGeoJson,
        countyGeoJson,
        setCountyGeoJson,
        activeAlerts,
        shownAt,
        currentNotification,
        setCurrentNotification,
        pushGeoJson,
        pushAlertList,
      }}
    >
      {children}
    </AlertContext.Provider>
  );
};

export const useAlertContext = () => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error("useAlertContext must be used within an AlertProvider");
  }
  return context;
};
