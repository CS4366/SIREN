import { useEffect, useState, useRef } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import { io } from "socket.io-client";
import Alert from "../elements/Alert";
import UpArrow from "../../assets/up-arrow.png";
import DownArrow from "../../assets/down-arrow.png";
import { useWindowSize } from "@uidotdev/usehooks";
import { AlertColorMap, SirenAlert } from "../../model/Alert";
import { decode } from "@msgpack/msgpack";
import { feature } from "topojson-client";
import { useSettings } from "../context/SettingsContext";
import Map, {
  Layer,
  LayerProps,
  MapMouseEvent,
  Popup,
  Source,
  MapRef,
} from "react-map-gl/mapbox";

interface SelectedSirenAlert {
  longitude: number;
  latitude: number;
  alertData: SirenAlert;
}

// Push URL
const LIVE_URL =
  import.meta.env.MODE === "production"
    ? "https://siren-live.jaxcksn.dev"
    : "http://localhost:4000";

// Socket connection to Push service
const socket = io(LIVE_URL, {
  autoConnect: false,
});

// API URL
const API_URL =
  import.meta.env.MODE === "production"
    ? "https://siren-api.jaxcksn.dev"
    : "http://localhost:3030";

// GEO URL
const GEO_URL =
  import.meta.env.MODE === "production"
    ? "https://siren-geo.jaxcksn.dev"
    : "http://localhost:6906";

// Home Page Component
const HomePage = () => {
  // Map ref
  const mapRef = useRef<MapRef | null>(null);

  // Get the coordinates and map style from the context
  const { coordinates, mapStyle, borderOpacity, fillOpacity } = useSettings();

  // Loading State for Alerts
  const [isLoading, setIsLoading] = useState(true);
  // State variables for push and API connection status
  const [isPushConnected, setIsPushConnected] = useState(socket.connected);
  const [isAPIConnected, setIsAPIConnected] = useState(false);
  // State variables for alert data
  const [alertData, setAlertData] = useState<SirenAlert[]>([]);
  // State variable for selected alert
  const [selectedAlert, setSelectedAlert] = useState<SelectedSirenAlert>();
  // State variables for total alerts and active alerts
  const [activeAlerts, setActiveAlerts] = useState(0);
  const [totalAlerts, setTotalAlerts] = useState(0); // Total Alerts Today
  const [totalAlertsDiff, setTotalAlertsDiff] = useState(0); // Total Alerts Difference
  const [totalAlertsBool, setTotalAlertsBool] = useState(false); // Total Alerts Increase Bool T->Increase F->Decrease
  // State variables for common alert type
  const [commonAlertType, setCommonAlertType] = useState("");
  const [commonAlertTypePrev, setCommonAlertTypePrev] = useState("test");
  // State variables for common regions
  const [commonRegions, setCommonRegions] = useState<string[]>([]);
  const [commonRegionsPrev, setCommonRegionsPrev] = useState<string[]>([]);
  // State variables for resize
  const { width } = useWindowSize();
  // State variables for polygons and styles
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
  const [polygonFillStyle, setPolygonFillStyle] = useState<LayerProps>({
    id: "alert-polygons-fill",
    type: "fill",
    paint: {
      "fill-color": ["get", "color"],
      "fill-opacity": fillOpacity / 100,
    },
  });
  const [polygonLineStyle, setPolygonLineStyle] = useState<LayerProps>({
    id: "alert-polygons-outline",
    type: "line",
    paint: {
      "line-color": ["get", "color"],
      "line-opacity": borderOpacity / 100,
    },
  });
  const [countyFillStyle, setCountyFillStyle] = useState<LayerProps>({
    id: "county-polygons-fill",
    type: "fill",
    paint: {
      "fill-color": ["get", "color"],
      "fill-opacity": fillOpacity / 100,
    },
  });
  const [countyLineStyle, setCountyLineStyle] = useState<LayerProps>({
    id: "county-polygons-outline",
    type: "line",
    paint: {
      "line-color": ["get", "color"],
      "line-opacity": borderOpacity / 100,
    },
  });

  // Effect to handle alert polygon data
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

  // Gathering number of alerts from today including inactive alerts from API
  useEffect(() => {
    fetch(`${API_URL}/alerts/today`)
      .then((res) => {
        if (res.ok) {
          return res.json();
        } else {
          throw new Error("Failed to fetch total-today data");
        }
      })
      .then((data) => {
        // Set total alerts length
        setTotalAlerts(data.length);
      })
      .catch((error) => {
        console.error("Error fetching total-today data:", error);
      });
  }, []);

  // Gathering active alerts for the previous day and calculating the increase from API
  useEffect(() => {
    fetch(`${API_URL}/alerts/yesterday`)
      .then((res) => {
        if (res.ok) {
          return res.json();
        } else {
          throw new Error("Failed to fetch total-yesterday data");
        }
      })
      .then((data) => {
        // Updating the total alerts difference
        setTotalAlertsDiff(Math.abs(totalAlerts - data.length));
        setTotalAlertsBool(totalAlerts > data.length);
      })
      .catch((error) => {
        console.error("Error fetching total-yesterday data:", error);
      });
  }, [totalAlerts]);

  // Gathering most common alert type from today from API
  useEffect(() => {
    fetch(`${API_URL}/alerts/today/common`)
      .then((res) => {
        if (res.ok) {
          return res.json();
        } else {
          throw new Error("Failed to fetch today-common data");
        }
      })
      .then((data) => {
        // Set current common alert type
        if (data.length === 0) {
          setCommonAlertType("No Data");
          return;
        }
        setCommonAlertType(data[0]._id);
      })
      .catch((error) => {
        console.error("Error fetching today-common data:", error);
      });
  }, []);

  // Gathering most common alert type from yesterday from API
  useEffect(() => {
    fetch(`${API_URL}/alerts/yesterday/common`)
      .then((res) => {
        if (res.ok) {
          return res.json();
        } else {
          throw new Error("Failed to fetch yesterday-common data");
        }
      })
      .then((data) => {
        // Safegaurd for testing
        if (data.length === 0) {
          setCommonAlertTypePrev(
            "Check with more data in DB (no last day data)"
          );
          return;
        }
        // Set previous common alert type
        setCommonAlertTypePrev(data[0]._id);
      })
      .catch((error) => {
        console.error("Error fetching yesterday-common data:", error);
      });
  }, []);

  // Gathering most common regions from today from API
  useEffect(() => {
    fetch(`${API_URL}/alerts/today/regions`)
      .then((res) => {
        if (res.ok) {
          return res.json();
        } else {
          throw new Error("Failed to fetch most today-regions data");
        }
      })
      .then((data) => {
        // Setting common regions
        if (data.length === 0) {
          setCommonRegions(["    No Data", "    No Data", "    No Data"]);
          return;
        }
        setCommonRegions(data);
      })
      .catch((error) => {
        console.error("Error fetching today-regions data:", error);
      });
  }, []);

  // Gathering most common alert type from yesterday from API
  useEffect(() => {
    fetch(`${API_URL}/alerts/yesterday/regions`)
      .then((res) => {
        if (res.ok) {
          return res.json();
        } else {
          throw new Error("Failed to fetch most yesterday-regions data");
        }
      })
      .then((data) => {
        // Safegaurd for testing
        if (data.length === 0) {
          setCommonRegionsPrev(["    No Data", "    No Data"]);
          return;
        }
        // Set previous common alert type
        setCommonRegionsPrev(data);
      })
      .catch((error) => {
        console.error("Error fetching yesterday-regions data:", error);
      });
  }, []);

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
      setPolygonGeojson({
        type: "FeatureCollection",
        features: polygonFeatures as GeoJSON.Feature[],
      });
    };

    updatePolygonFeatures();
  }, [alertData]);

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

  useEffect(() => {
    // Check if mapRef is defined and current
    if (mapRef.current) {
      // Set the map style using the mapRef
      mapRef.current?.getMap().setStyle(mapStyle); // Force the map to update its style
    }
  }, [mapStyle]);

  // Effect to handle border opacity changes
  useEffect(() => {
    const newPolygonLineStyle = polygonLineStyle;
    newPolygonLineStyle.paint = {
      "line-color": ["get", "color"],
      "line-opacity": borderOpacity / 100,
    };
    setPolygonLineStyle(newPolygonLineStyle);

    const newCountyLineStyle = countyLineStyle;
    newCountyLineStyle.paint = {
      "line-color": ["get", "color"],
      "line-opacity": borderOpacity / 100,
    };
    setCountyLineStyle(newCountyLineStyle);
  }, [borderOpacity]);

  useEffect(() => {
    const newFillStyle = countyFillStyle;
    newFillStyle.paint = {
      "fill-color": ["get", "color"],
      "fill-opacity": fillOpacity / 100,
    };

    setCountyFillStyle(newFillStyle);

    const newPolygonFillStyle = polygonFillStyle;
    newPolygonFillStyle.paint = {
      "fill-color": ["get", "color"],
      "fill-opacity": fillOpacity / 100,
    };
    setPolygonFillStyle(newPolygonFillStyle);
  }, [fillOpacity]);

  // Function to render the alert list
  const getAlertList = () => {
    // If loading
    if (isLoading) {
      return (
        <div className="flex justify-center items-center w-full h-full">
          <p className="text-white text-lg">Loading Alerts...</p>
        </div>
      );
    }
    // If no alerts
    else if (alertData.length === 0) {
      return (
        <div className="flex justify-center items-center w-full h-full">
          <p className="text-white text-lg">No active alerts found!</p>
        </div>
      );
    }
    // Map alerted to alert component
    else {
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
            onShowOnMap={() => flyToAlert(alert)}
          />
        );
      });
    }
  };

  // Handle map click event
  const handleMapClick = (event: MapMouseEvent) => {
    event.preventDefault();

    console.log(event);
    const feature = event.features && event.features[0];
    // Check if the clicked feature is a polygon
    if (feature && feature.properties?.id) {
      const foundAlert = alertData.find(
        (alert: SirenAlert) => alert.identifier === feature.properties?.id
      );
      // If an alert is found, set it as the selected alert
      if (foundAlert) {
        setSelectedAlert({
          longitude: event.lngLat.lng,
          latitude: event.lngLat.lat,
          alertData: foundAlert,
        });
      }
    }
  };

  // Filter alert by area
  const filterByArea = (area: string) => {
    // Filter the alert data based on the area input
    const filteredAlerts = alertData.filter((alert: SirenAlert) =>
      alert.capInfo.info.area.description.includes(area)
    );
    // If the input is empty, reset to the original alert data
    if (area.trim() === "") {
      // If the input is empty, reset to the original alert data
      fetch(`${API_URL}/active`)
        .then((res) => {
          if (res.ok) {
            res.json().then((data) => {
              setAlertData(data);
            });
          } else {
            console.log("Error fetching active alerts data");
          }
        })
        .catch((error) => {
          console.error("Error resetting alert data:", error);
        });
    } else {
      setAlertData(filteredAlerts);
    }
  };

  // Function to fly to the alert area on the map
  const flyToAlert = (alert: SirenAlert) => {
    if (mapRef.current) {
      let coordinates: GeoJSON.Position = [0, 0];
      //Find alert coordinates
      if (!alert.capInfo.info.area.polygon) {
        //Get it from the county geojson
        const alertId = alert.identifier;
        const foundAlert = countyGeoJson.features.find(
          (feature) => feature.properties?.id === alertId
        );
        if (foundAlert) {
          if (foundAlert.geometry.type === "Polygon") {
            coordinates = foundAlert.geometry.coordinates[0][0];
          } else if (foundAlert.geometry.type === "MultiPolygon") {
            coordinates = foundAlert.geometry.coordinates[0][0][0];
          } else {
            console.error(
              "Geometry type is not supported for coordinates extraction:",
              foundAlert.geometry.type
            );
          }
          setSelectedAlert({
            longitude: coordinates[0],
            latitude: coordinates[1],
            alertData: alert,
          });
          mapRef.current.flyTo({
            center: [coordinates[0], coordinates[1]],
            zoom: 7,
          });
        }
      } else {
        //Get it from the alert data
        const coordinates = alert.capInfo.info.area.polygon.coordinates[0][0];
        // Set the selected alert
        setSelectedAlert({
          longitude: coordinates[0],
          latitude: coordinates[1],
          alertData: alert,
        });
      }

      if (coordinates[0] !== 0 && coordinates[1] !== 0) {
        mapRef.current.flyTo({
          center: [coordinates[0], coordinates[1]],
          zoom: 7,
        });
      }
    }
  };

  // Render the HomePage component
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
              <p className="p-2 text-xs sm:text-xs md:text-xs lg:text-xs xl:text-xs truncate">
                Across all Regions
              </p>
            </div>
          </div>
          <div className="flex flex-col h-full w-full md:w-1/5 lg:w-1/5 xl:1/5 border border-[#71717a] rounded-2xl justify-between overflow-y-auto">
            <p className="font-bold p-2 text-xs sm:text-xs md:text-sm lg:text-sm xl:text-sm truncate">
              Issued Today
            </p>
            <h1 className="font-bold p-2 text-xl sm:text-2xl md:text-3xl lg:text-5xl xl:text-7xl truncate">
              {totalAlerts}
            </h1>
            <div className="flex justify-start items-center p-2">
              <img
                src={totalAlertsBool === true ? UpArrow : DownArrow}
                alt="arrow"
                className="w-4 h-4"
              />
              <p className="p-2 text-xs sm:text-xs md:text-xs lg:text-xs xl:text-xs truncate">
                {totalAlertsBool === true ? "Up" : "Down"} {totalAlertsDiff}{" "}
                alerts from yesterday
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
            <p className="p-2 pb-4 text-xs sm:text-xs md:text-xs lg:text-xs xl:text-xs truncate">
              Yesterday: {commonAlertTypePrev}
            </p>
          </div>
          <div className="flex flex-col h-full w-full md:w-1/2 lg:w-1/2 xl:1/2 border border-[#71717a] rounded-2xl justify-between overflow-y-auto">
            <p className="font-bold p-2 text-xs sm:text-xs md:text-xs lg:text-sm xl:text-sm truncate">
              Regions with Most Alerts
            </p>
            <div className="flex-col w-full p-2 font-bold truncate">
              <h1 className="text-sm sm:text-sm md:text-md lg:text-lg xl:text-xl">
                1.{" "}
                {typeof commonRegions[0] === "string"
                  ? commonRegions[0].substring(4)
                  : ""}
              </h1>
              <h1 className="text-sm sm:text-sm md:text-md lg:text-lg xl:text-xl">
                2.{" "}
                {typeof commonRegions[1] === "string"
                  ? commonRegions[1].substring(4)
                  : ""}
              </h1>
              <h1 className="text-sm sm:text-sm md:text-md lg:text-lg xl:text-xl">
                3.{" "}
                {typeof commonRegions[2] === "string"
                  ? commonRegions[2].substring(4)
                  : ""}
              </h1>
            </div>
            <p className="p-2 pb-4 text-xs sm:text-xs md:text-xs lg:text-xs xl:text-xs truncate">
              Yesterday:{" "}
              {typeof commonRegionsPrev[0] === "string"
                ? commonRegionsPrev[0].substring(4)
                : ""}{" "}
              |{" "}
              {typeof commonRegionsPrev[1] === "string"
                ? commonRegionsPrev[1].substring(4)
                : ""}
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
                onChange={(e) => filterByArea(e.target.value)}
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
            ref={mapRef}
            mapboxAccessToken="pk.eyJ1IjoiYmdvcm1hbiIsImEiOiJjbTh5eDZtM2EwM2Q0MmtvOWxtZHUydjY0In0.95ybhEJ2-Z9VcKABogtE5A"
            initialViewState={{
              longitude: coordinates.longitude,
              latitude: coordinates.latitude,
              zoom: 5,
            }}
            style={{ width: "100%", height: "100%", borderRadius: "1rem" }}
            mapStyle={mapStyle}
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
            <Source
              type="raster"
              id="radar_reflectivity"
              tiles={[
                `https://mapservices.weather.noaa.gov/eventdriven/rest/services/radar/radar_base_reflectivity/MapServer/export?F=image&FORMAT=PNG32&TRANSPARENT=true&LAYERS=show:3&SIZE=256,256&BBOX={bbox-epsg-3857}&BBOXSR=3857&IMAGESR=3857&DPI=360`,
              ]}
              zoom={[-1, 0, 1, 2, 3, 4]}
            >
              <Layer id="radar_reflectivity" type="raster" paint={{}} />
            </Source>
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
