import { useEffect, useState } from "react";
import { Position } from "geojson";
import "mapbox-gl/dist/mapbox-gl.css";
import { io } from "socket.io-client";
import Alert from "../elements/Alert";
import UpArrow from "../../assets/up-arrow.png";
import DownArrow from "../../assets/down-arrow.png";
import { useWindowSize } from "@uidotdev/usehooks";
import { AlertColorMap, SirenAlert } from "../../model/Alert";
import Map, {
  Layer,
  LayerProps,
  MapMouseEvent,
  Popup,
  Source,
} from "react-map-gl/mapbox";

interface SelectedSirenAlert {
  longitude: number;
  latitude: number;
  alertData: SirenAlert;
}

const LIVE_URL =
  import.meta.env.MODE === "production"
    ? "https://siren-live.jaxcksn.dev"
    : "http://localhost:4000";

const socket = io(LIVE_URL, {
  autoConnect: false,
});

const API_URL =
  import.meta.env.MODE === "production"
    ? "https://siren-api.jaxcksn.dev"
    : "http://localhost:3030";

const HomePage = () => {
  const [isLoading, setIsLoading] = useState(true);

  // State variables for push and API connection status
  const [isPushConnected, setIsPushConnected] = useState(socket.connected);
  const [isAPIConnected, setIsAPIConnected] = useState(false);
  // State variables for alert data this will be fetched from API later on
  // Sets will need to be added back in later they were taken out so there wouldnt be any hosting errors

  const [alertData, setAlertData] = useState([]);
  const [polygonGeojson, setPolygonGeojson] =
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
  const [polygonFillStyle] = useState<LayerProps>({
    id: "alert-polygons-fill",
    type: "fill",
    paint: {
      "fill-color": ["get", "color"],
      "fill-opacity": 0.5,
    },
  });
  const [polygonLineStyle] = useState<LayerProps>({
    id: "alert-polygons-outline",
    type: "line",
    paint: {
      "line-color": ["get", "color"],
      "line-width": 2,
    },
  });
  const [countyFillStyle] = useState<LayerProps>({
    id: "county-polygons-fill",
    type: "fill",
    paint: {
      "fill-color": ["get", "color"],
      "fill-opacity": 0.5,
    },
  });
  const [countyLineStyle] = useState<LayerProps>({
    id: "county-polygons-outline",
    type: "line",
    paint: {
      "line-color": ["get", "color"],
      "line-width": 2,
    },
  });

  const [selectedAlert, setSelectedAlert] = useState<SelectedSirenAlert>();

  const [activeAlerts] = useState(8);
  const [activeIncrease] = useState(1);
  const [totalAlerts] = useState(148);
  const [totalAlertsIncrease] = useState(1);
  const [commonAlertType] = useState("Servere Thunderstorm Warning");
  const [commonAlertTypeYesterday] = useState("Special Weather Statement");
  const [mostAlertAreas] = useState([
    "West Texas",
    "East Texas",
    "Great Plains",
  ]);
  const [yesterdayMostAlertAreas] = useState(["West Texas", "East Texas"]);

  const { width } = useWindowSize();

  // TODO: Add functionality to fetch data for components from API
  // getTotalAlertsToday
  // getCurrentAlerts
  // getMostPrevelentAlert
  // getMostAffected Areas (Today/Right Now)
  // getAlertsForArea (City/State/Zip, etc)
  // displayAlertOnMap (Logic done, but data still needs to be fetched from API)

  useEffect(() => {
    // Calculate the alert polygon data
  }, [alertData]);

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

  // Check if socket is connected
  useEffect(() => {
    function onConnect() {
      setIsPushConnected(true);
    }

    function onDisconnect() {
      setIsPushConnected(false);
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, []);

  useEffect(() => {
    setIsLoading(true);
    fetch(`${API_URL}/active`)
      .then((res) => {
        if (res.ok) {
          res.json().then((data) => {
            setAlertData(data);
          });
        } else {
          console.log("Error fetching data");
        }
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
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
    setPolygonGeojson({
      type: "FeatureCollection",
      features: polygonFeatures as GeoJSON.Feature[],
    });

    //Do county next
    const countyFeatures: GeoJSON.Feature[] = [];
    alertData.forEach((alert: SirenAlert) => {
      if (alert.geometry && alert.geometry.coordinates) {
        if (alert.geometry.geometryType === "Polygon") {
          countyFeatures.push({
            type: "Feature",
            geometry: {
              type: "Polygon",
              coordinates: [alert.geometry.coordinates as Position[]],
            },
            properties: {
              id: alert.identifier,
              name: alert.capInfo.info.event,
              color:
                AlertColorMap.get(alert.capInfo.info.eventcode.nws) ||
                "#efefef",
            },
          });
        } else if (alert.geometry.geometryType === "MultiPolygon") {
          countyFeatures.push({
            type: "Feature",
            geometry: {
              type: "MultiPolygon",
              coordinates: [alert.geometry.coordinates as Position[][]],
            },
            properties: {
              id: alert.identifier,
              name: alert.capInfo.info.event,
              color:
                AlertColorMap.get(alert.capInfo.info.eventcode.nws) ||
                "#efefef",
            },
          });
        }
      }
    });

    // Insert county features into the polygonGeojson state
    setCountyGeoJson({
      type: "FeatureCollection",
      features: countyFeatures.filter(Boolean),
    });
  }, [alertData]);

  const getAlertList = () => {
    if (isLoading) {
      return (
        <div className="flex justify-center items-center w-full h-full">
          <p className="text-white text-lg">Loading Alerts...</p>
        </div>
      );
    } else if (alertData.length === 0) {
      return (
        <div className="flex justify-center items-center w-full h-full">
          <p className="text-white text-lg">No active alerts found!</p>
        </div>
      );
    } else {
      return alertData.map((alert: SirenAlert, index: number) => {
        return (
          <Alert
            key={index}
            alertType={alert.capInfo.info.event}
            alertIssue={alert.capInfo.sender}
            alertAreas={alert.capInfo.info.area.description}
            alertStartTime={alert.capInfo.info.effective}
            alertEndTime={alert.capInfo.info.expires}
            alertDescription={alert.capInfo.info.description.replace("/n", " ")}
            alertInstructions={alert.capInfo.info.instruction}
            alertHistory={["Alert Issued", "Alert Updated - Time Extended"]}
            color={
              AlertColorMap.get(alert.capInfo.info.eventcode.nws) || "#efefef"
            }
          />
        );
      });
    }
  };

  const handleMapClick = (event: MapMouseEvent) => {
    event.preventDefault();

    console.log(event);
    const feature = event.features && event.features[0];
    if (feature && feature.properties?.id) {
      const foundAlert = alertData.find(
        (alert: SirenAlert) => alert.identifier === feature.properties?.id
      );
      if (foundAlert) {
        setSelectedAlert({
          longitude: event.lngLat.lng,
          latitude: event.lngLat.lat,
          alertData: foundAlert,
        });
      }
    }
  };

  return (
    <div className="flex h-full w-full flex-col bg-[#283648] text-white items-start md:m-5 lg:m-5 xl:m-5 overflow-y-auto">
      {/* Header */}
      <div className="flex w-full flex-row justify-between ">
        {/* Page Info */}
        <div className="flex-col w-full justify-start mt-5 ml-5 md:ml-0 lg:ml-0 xl:ml-0">
          <div className="flex w-full justify-start text-3xl font-bold italic">
            SIREN
          </div>
          <div className="flex w-full justify-start txt-small font-light">
            Web Dashboard
          </div>
        </div>
        {/* Connection Status */}
        <div className="flex-col w-full justify-items-end m-5">
          <div className="flex items-center">
            SIREN Live Status:{" "}
            {isPushConnected ? (
              <>
                <div className="mx-1 w-4 h-4 rounded-full bg-green-500 animate-pulse"></div>
                <p>Online</p>
              </>
            ) : (
              <>
                <div className="mx-1 w-4 h-4 rounded-full bg-red-500 animate-pulse"></div>
                <p>Offline</p>
              </>
            )}
          </div>
          <div className="flex items-center">
            SIREN API Status:{" "}
            {isAPIConnected ? (
              <>
                <div className="mx-1 w-4 h-4 rounded-full bg-green-500 animate-pulse"></div>
                <p>Online</p>
              </>
            ) : (
              <>
                <div className="mx-1 w-4 h-4 rounded-full bg-red-500 animate-pulse"></div>
                <p>Offline</p>
              </>
            )}
          </div>
        </div>
      </div>
      {/* Info */}
      {width !== null && width >= 768 && (
        <div className="flex flex-col md:flex-row lg:flex-row xl:flex-row w-full h-1/3 md:h-1/5 gap-3 mt-3">
          <div className="flex flex-col h-auto w-full md:w-1/5 lg:w-1/5 xl:1/5 border border-[#71717a] rounded-2xl justify-between overflow-y-auto">
            <p className="font-bold p-2 text-xs sm:text-xs md:text-sm lg:text-sm xl:text-sm truncate">
              Total Active Alerts
            </p>
            <h1 className="font-bold p-2 text-xl sm:text-2xl md:text-3xl lg:text-5xl xl:text-7xl truncate">
              {activeAlerts}
            </h1>
            <div className="flex justify-start items-center p-2">
              <img
                src={activeIncrease > 0 ? UpArrow : DownArrow}
                alt="arrow"
                className="w-4 h-4"
              />
              <p className="p-2 text-xs sm:text-xs md:text-xs lg:text-xs xl:text-xs truncate">
                {activeIncrease > 0 ? "Up" : "Down"} {activeIncrease}% from
                yesterday
              </p>
            </div>
          </div>
          <div className="flex flex-col h-full w-full md:w-1/5 lg:w-1/5 xl:1/5 border border-[#71717a] rounded-2xl justify-between overflow-y-auto">
            <p className="font-bold p-2 text-xs sm:text-xs md:text-sm lg:text-sm xl:text-sm truncate">
              Total Alerts
            </p>
            <h1 className="font-bold p-2 text-xl sm:text-2xl md:text-3xl lg:text-5xl xl:text-7xl truncate">
              {totalAlerts}
            </h1>
            <div className="flex justify-start items-center p-2">
              <img
                src={totalAlertsIncrease > 0 ? UpArrow : DownArrow}
                alt="arrow"
                className="w-4 h-4"
              />
              <p className="p-2 text-xs sm:text-xs md:text-xs lg:text-xs xl:text-xs truncate">
                {totalAlertsIncrease > 0 ? "Up" : "Down"} {totalAlertsIncrease}%
                from yesterday
              </p>
            </div>
          </div>
          <div className="flex flex-col h-full w-full md:w-1/3 lg:w-1/3 xl:1/3 border border-[#71717a] rounded-2xl justify-between overflow-y-auto">
            <p className="font-bold p-2 text-xs sm:text-xs md:text-sm lg:text-sm xl:text-sm truncate">
              Most Issued Alert Type Today
            </p>
            <p className="font-bold p-2 text-xs sm:text-sm md:text-sm lg:text-xl xl:text-xl truncate">
              {commonAlertType}
            </p>
            <p className="p-2 text-xs sm:text-xs md:text-xs lg:text-xs xl:text-xs truncate">
              Yesterday: {commonAlertTypeYesterday}
            </p>
          </div>
          <div className="flex flex-col h-full w-full md:w-1/2 lg:w-1/2 xl:1/2 border border-[#71717a] rounded-2xl justify-between overflow-y-auto">
            <p className="font-bold p-2 text-xs sm:text-xs md:text-xs lg:text-sm xl:text-sm truncate">
              Regions with Most Alerts
            </p>
            <div className="flex-col w-full p-2 font-bold truncate">
              <h1 className="text-sm sm:text-sm md:text-md lg:text-lg xl:text-xl">
                1. {mostAlertAreas[0]}
              </h1>
              <h1 className="text-sm sm:text-sm md:text-md lg:text-lg xl:text-xl">
                2. {mostAlertAreas[1]}
              </h1>
              <h1 className="text-sm sm:text-sm md:text-md lg:text-lg xl:text-xl">
                3. {mostAlertAreas[2]}
              </h1>
            </div>
            <p className="p-2 text-xs sm:text-xs md:text-xs lg:text-xs xl:text-xs truncate">
              Yesterday: {yesterdayMostAlertAreas[0]} |{" "}
              {yesterdayMostAlertAreas[1]}
            </p>
          </div>
        </div>
      )}

      {/* Alerts/Map */}
      <div className="flex flex-col md:flex-row w-full h-full mt-5 mb-5 mr-0 justify-start items-center gap-3 overflow-hidden bg-[#283648]">
        {/* Active Alert Contatiner */}
        <div className="flex w-full md:w-1/2 h-1/2 md:h-full border border-[#71717a] rounded-2xl">
          <div className="flex flex-col w-full h-full">
            {/* Active Alert Header */}
            <div className="flex w-full justify-between items-center p-3">
              <h2 className="text-lg font-bold">Active Alert List</h2>
              <input
                type="text"
                placeholder="Filter by Location"
                className="p-2 border w-2/5 border-white rounded-md focus:outline-none bg-transparent text-xs sm:text-xs md:text-sm lg:text-md xl:text-lg font-light"
              />
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              {getAlertList()}
            </div>
          </div>
        </div>
        {/* Alert-Map Containter */}
        <div className="relative w-full md:w-1/2 h-full border border-[#71717a] rounded-2xl mt-0">
          <Map
            mapboxAccessToken="pk.eyJ1IjoiYmdvcm1hbiIsImEiOiJjbTh5eDZtM2EwM2Q0MmtvOWxtZHUydjY0In0.95ybhEJ2-Z9VcKABogtE5A"
            initialViewState={{
              longitude: -101.87457,
              latitude: 33.58462,
              zoom: 5,
            }}
            style={{ width: "100%", height: "100%", borderRadius: "1rem" }}
            mapStyle="mapbox://styles/mapbox/navigation-night-v1"
            onClick={handleMapClick}
            interactiveLayerIds={[
              "alert-polygons-fill",
              "county-polygons-fill",
            ]}
          >
            {selectedAlert && (
              <Popup
                longitude={selectedAlert.longitude}
                latitude={selectedAlert.latitude}
                anchor="top"
                onClose={() => setSelectedAlert(undefined)}
                closeOnClick={false}
              >
                <div>
                  <h3>{selectedAlert.alertData.capInfo.info.event}</h3>
                  <p>
                    Updated:{" "}
                    {new Date(
                      selectedAlert.alertData.lastUpdatedTime
                    ).toLocaleString("en-US")}
                  </p>
                </div>
              </Popup>
            )}
            {polygonGeojson.features.length > 0 && (
              <Source id="alert-polygons" type="geojson" data={polygonGeojson}>
                {polygonFillStyle && <Layer {...polygonFillStyle}></Layer>}
                {polygonLineStyle && <Layer {...polygonLineStyle}></Layer>}
              </Source>
            )}
            {countyGeoJson.features.length > 0 && (
              <Source id="county-polygons" type="geojson" data={countyGeoJson}>
                {countyFillStyle && <Layer {...countyFillStyle}></Layer>}
                {countyLineStyle && <Layer {...countyLineStyle}></Layer>}
              </Source>
            )}
          </Map>
          <div className="absolute top-2 left-2 z-10">
            <h2 className="text-lg font-bold">Active Mini-Map</h2>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
