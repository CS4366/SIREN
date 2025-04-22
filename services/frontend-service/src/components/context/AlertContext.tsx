import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
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
  notificationVisible: boolean;
  setNotificationVisible: React.Dispatch<React.SetStateAction<boolean>>;
  currentNotification: SirenPushNotification | null;
  setCurrentNotification: React.Dispatch<
    React.SetStateAction<SirenPushNotification | null>
  >;
}

// Push URL
const LIVE_URL =
  import.meta.env.MODE === "production"
    ? "https://siren-live.jaxcksn.dev"
    : "localhost:4000";

// API URL
const API_URL =
  import.meta.env.MODE === "production"
    ? "https://siren-api.jaxcksn.dev"
    : "localhost:3030";

// GEO URL
const GEO_URL =
  import.meta.env.MODE === "production"
    ? "https://siren-geo.jaxcksn.dev"
    : "localhost:6906";

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
  const [notificationVisible, setNotificationVisible] =
    useState<boolean>(false);

  // Check if socket is connected
  useEffect(() => {
    function onLive(msg) {
      try {
        const uint8Array = new Uint8Array(msg);
        const alert = decode(uint8Array) as SirenPushNotification;

        notificationQueue.add(alert);
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

  useEffect(() => {
    if (!currentNotification && notificationQueue.size > 0) {
      const next = notificationQueue.first;
      notificationQueue.remove();
      if (next) {
        setCurrentNotification(next);
      }
    }
  }, [notificationQueue.size, currentNotification]);

  useEffect(() => {
    if (!currentNotification) return;

    setNotificationVisible(true);
    const hideTimer = setTimeout(() => {
      setNotificationVisible(false);
    }, 10000);

    return () => clearTimeout(hideTimer);
  }, [currentNotification]);

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
        notificationVisible,
        setNotificationVisible,
        currentNotification,
        setCurrentNotification,
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
