import { useEffect, useState, useRef, useMemo } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import Alert from "../elements/Alert";
import UpArrow from "../../assets/up-arrow.png";
import DownArrow from "../../assets/down-arrow.png";
import { useWindowSize } from "@uidotdev/usehooks";
import { AlertColorMap, SirenAlert } from "../../model/Alert";
import { useSettings } from "../context/SettingsContext";
import { useAlertContext } from "../context/AlertContext";
import { Button } from "@heroui/button";
import Map, {
  Layer,
  LayerProps,
  MapMouseEvent,
  Popup,
  Source,
  MapRef,
} from "react-map-gl/mapbox";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  DrawerFooter,
  useDisclosure,
} from "@heroui/react";
import { Alert as HeroAlert } from "@heroui/react";
import { AnimatePresence, motion } from "framer-motion";

interface SelectedSirenAlert {
  longitude: number;
  latitude: number;
  alertData: SirenAlert;
}

const dateOptions: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
};

// API URL
const API_URL =
  import.meta.env.MODE === "production"
    ? "https://siren-api.jaxcksn.dev"
    : "https://siren-api.jaxcksn.dev";

// Home Page Component
const HomePage = () => {
  // Map ref
  const mapRef = useRef<MapRef | null>(null);

  const { isOpen, onOpen, onOpenChange } = useDisclosure();

  // Get the coordinates and map style from the context
  const { coordinates, mapStyle, borderOpacity, fillOpacity } = useSettings();

  const {
    alertsLoading,
    isPushConnected,
    alertData,
    setAlertData,
    polygonGeoJson,
    countyGeoJson,
    activeAlerts,
    notificationVisible,
    currentNotification,
    setCurrentNotification,
  } = useAlertContext();

  // State variable for selected alert
  const [selectedAlert, setSelectedAlert] = useState<SelectedSirenAlert[]>();

  const [openedAlert, setOpenedAlert] = useState<SirenAlert | null>(null);

  const [totalAlerts, setTotalAlerts] = useState(0); // Total Alerts Today
  const [totalAlertsDiff, setTotalAlertsDiff] = useState(0); // Total Alerts Difference
  const [totalAlertsBool, setTotalAlertsBool] = useState(false); // Total Alerts Increase Bool T->Increase F->Decrease
  // State variables for common alert type
  const [commonAlertType, setCommonAlertType] = useState("");
  const [commonAlertTypePrev, setCommonAlertTypePrev] = useState("");
  // State variables for common regions
  const [commonRegions, setCommonRegions] = useState<string[]>([]);
  const [commonRegionsPrev, setCommonRegionsPrev] = useState<string[]>([]);
  // State variables for resize
  const { width } = useWindowSize();
  // State variables for polygons and styles

  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current.getMap();
    // triggerRepaint is the internal Mapbox method that asks for a fresh draw
    map.triggerRepaint();
  }, [countyGeoJson, polygonGeoJson]);

  const alertFillLayer = useMemo<LayerProps>(
    () => ({
      id: "alert-polygons-fill",
      type: "fill",
      paint: {
        "fill-color": ["get", "color"],
        "fill-opacity": fillOpacity / 100,
      },
    }),
    [fillOpacity]
  );

  const alertLineLayer = useMemo<LayerProps>(
    () => ({
      id: "alert-polygons-outline",
      type: "line",
      paint: {
        "line-color": ["get", "color"],
        "line-opacity": borderOpacity / 100,
      },
    }),
    [borderOpacity]
  );

  const combinedFeatures = useMemo<
    GeoJSON.FeatureCollection<GeoJSON.Geometry, GeoJSON.GeoJsonProperties>
  >(() => {
    return {
      type: "FeatureCollection",
      features: [...polygonGeoJson.features, ...countyGeoJson.features],
    };
  }, [polygonGeoJson, countyGeoJson]);

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

  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.getMap().resize();
  }, [width]);

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
          setCommonAlertTypePrev("Unknown");
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

  useEffect(() => {
    // Check if mapRef is defined and current
    if (mapRef.current) {
      // Set the map style using the mapRef
      mapRef.current?.getMap().setStyle(mapStyle); // Force the map to update its style
    }
  }, [mapStyle]);

  // Function to render the alert list
  const getAlertList = () => {
    // If loading
    if (alertsLoading) {
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
            alertAreas={alert.capInfo.info.area.description}
            alertEndTime={alert.capInfo.info.expires}
            color={
              AlertColorMap.get(alert.capInfo.info.eventcode.nws) || "#efefef"
            }
            onShowOnMap={() => flyToAlert(alert)}
            onShowDetails={() => {
              setOpenedAlert(alert);
              onOpen();
              setSelectedAlert(undefined);
            }}
          />
        );
      });
    }
  };

  // Handle map click event
  const handleMapClick = (event: MapMouseEvent) => {
    event.preventDefault();
    const selected: SelectedSirenAlert[] = [];

    if ((event.features ?? []).length > 0) {
      for (const feature of event.features ?? []) {
        const foundAlert = alertData.find(
          (alert: SirenAlert) => alert.identifier === feature.properties?.id
        );

        if (foundAlert) {
          //Add to selected alert
          selected.push({
            longitude: event.lngLat.lng,
            latitude: event.lngLat.lat,
            alertData: foundAlert,
          });
        }
      }
    } else {
      // If no features are found, reset the selected alert
      setSelectedAlert(undefined);
      return;
    }
    if (selected.length > 0) {
      setSelectedAlert(selected);
    } else {
      setSelectedAlert(undefined);
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
          setSelectedAlert([
            {
              longitude: coordinates[0],
              latitude: coordinates[1],
              alertData: alert,
            },
          ]);

          mapRef.current.flyTo({
            center: [coordinates[0], coordinates[1]],
            zoom: 7,
          });
        }
      } else {
        //Get it from the alert data
        const coordinates = alert.capInfo.info.area.polygon.coordinates[0][0];
        // Set the selected alert
        setSelectedAlert([
          {
            longitude: coordinates[0],
            latitude: coordinates[1],
            alertData: alert,
          },
        ]);

        if (coordinates[0] !== 0 && coordinates[1] !== 0) {
          mapRef.current.flyTo({
            center: [coordinates[0], coordinates[1]],
            zoom: 7,
          });
        }
      }
    }
  };

  const handleExitComplete = () => {
    if (!notificationVisible) {
      // Reset the selected alert when the drawer is closed
      setCurrentNotification(null);
    }
  };

  const renderPopupBody = (data: SelectedSirenAlert[]) => {
    return data.map((alert) => {
      return (
        <div key={alert.alertData.identifier}>
          <h3>{alert.alertData.capInfo.info.event}</h3>
          <p>
            Updated:{" "}
            {new Date(alert.alertData.lastUpdatedTime).toLocaleString("en-US")}
          </p>
          <Button
            color="primary"
            size="sm"
            onPress={() => {
              setOpenedAlert(alert.alertData);
              setSelectedAlert(undefined);
            }}
          >
            View Details
          </Button>
        </div>
      );
    });
  };

  const BASE_URL =
    `https://nowcoast.noaa.gov/geoserver/observations/weather_radar/ows` +
    `?service=WMS&version=1.3.0&request=GetMap` +
    `&layers=base_reflectivity_mosaic` +
    `&styles=` +
    `&bbox={bbox-epsg-3857}` +
    `&width=256&height=256` +
    `&crs=EPSG:3857` +
    "&transparent=true" +
    `&format=image/png`;

  const tiles = [`${BASE_URL}`];

  const rasterLayer: LayerProps = {
    id: "weather-radar",
    type: "raster",
    paint: {
      "raster-opacity": 0.4,
    },
  };

  // Render the HomePage component
  return (
    <div className="flex h-full w-full flex-col bg-[#283648] text-white items-start md:m-5 lg:m-5 xl:m-5 overflow-y-auto">
      <Drawer
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        placement="left"
        size="xl"
      >
        <DrawerContent className="bg-[#283648] text-white">
          {(onClose) => (
            <>
              {/* Drawer Header */}
              <DrawerHeader className="flex flex-col gap-1 font-bold text-3xl">
                {/* Header Info */}
                <div className="flex flex-row items-center">
                  {openedAlert?.capInfo.info.event || "Unknown Alert"}
                  <div
                    className="mx-1 w-7 h-7 ml-3 rounded-full"
                    style={{
                      backgroundColor:
                        AlertColorMap.get(
                          openedAlert?.capInfo?.info.eventcode.nws
                        ) || "#efefef",
                    }}
                  />
                </div>
              </DrawerHeader>
              {/* Drawer Body */}
              <DrawerBody>
                {/* Drawer Body Info (Needs to be modularized once API is finished) */}
                <p>
                  Issued by:{" "}
                  {openedAlert?.capInfo?.info.sendername || "Unknown"}
                </p>
                <p>
                  Issued at{" "}
                  {new Date(openedAlert?.capInfo?.sent).toLocaleString("en-US")}{" "}
                  | Expires at{" "}
                  {openedAlert?.expires
                    ? new Date(openedAlert.expires).toLocaleString("en-US")
                    : "Unknown"}
                </p>
                <h4 className="font-bold text-xl">Alert Description:</h4>
                <p>
                  {openedAlert?.capInfo?.info.description.replace("/n", " ")}
                </p>
                <h4 className="font-bold text-xl">Safety Instructions:</h4>
                <p>{openedAlert?.capInfo.info.instruction}</p>
                <h4 className="font-bold text-xl">Alert History:</h4>
                {(openedAlert?.history ?? [])
                  .sort((a, b) => {
                    return (
                      new Date(a.recievedAt).getTime() -
                      new Date(b.recievedAt).getTime()
                    );
                  })
                  .map((history, index) => (
                    <div key={index} className="flex flex-col">
                      <p className="font-bold">
                        {history.vtecActionDescription}
                      </p>
                      <p>{history.appliesTo.join(", ")}</p>
                      <p>
                        {new Date(history.recievedAt).toLocaleString(
                          "en-US",
                          dateOptions
                        )}
                      </p>
                    </div>
                  ))}
              </DrawerBody>
              {/* Drawer Footer */}
              <DrawerFooter>
                <Button
                  color="danger"
                  variant="light"
                  onPress={() => {
                    onClose();
                  }}
                >
                  Close
                </Button>
              </DrawerFooter>
            </>
          )}
        </DrawerContent>
      </Drawer>
      {/* Header */}
      <div className="flex w-full flex-row justify-between ">
        {/* Page Info */}
        <div className="flex flex-col justify-start mt-2 ml-5 md:ml-0 lg:ml-0 xl:ml-0">
          <div className="flex w-full justify-start text-3xl font-bold italic">
            SIREN
          </div>
          <div className="flex w-full justify-start txt-small font-light">
            Web Dashboard
          </div>
        </div>
        <div className="flex w-auto justify-center items-center mt-2 mr-5">
          {!isPushConnected ? (
            <span className="text-red-500 text-xs">
              Push Notifications: Disconnected
            </span>
          ) : (
            <AnimatePresence onExitComplete={handleExitComplete}>
              {currentNotification && notificationVisible && (
                <motion.div
                  key={currentNotification.Identifier}
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.5 }}
                >
                  <HeroAlert
                    title={currentNotification.Event || "Unknown Alert"}
                    description={`Issued by ${
                      currentNotification.Sender || "Unknown"
                    }`}
                    color={
                      currentNotification.EventCode.charAt(2) === "W"
                        ? "danger"
                        : currentNotification.EventCode.charAt(2) === "A"
                        ? "warning"
                        : "primary"
                    }
                  />
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      </div>
      {/* Info */}
      {/* Dashboard Cards */}
      {width !== null && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-3 w-full">
          {/* Card Component */}
          {[
            {
              title: "Total Active Alerts",
              value: activeAlerts,
              foot: "Across all Regions",
              icon: null,
            },
            {
              title: "Issued Today",
              value: totalAlerts,
              foot: (
                <div className="flex items-center space-x-1">
                  <img
                    src={totalAlertsBool ? UpArrow : DownArrow}
                    alt=""
                    className="w-4 h-4"
                  />
                  <span className="text-xs">
                    {totalAlertsBool ? "Up" : "Down"} {totalAlertsDiff} from
                    yesterday
                  </span>
                </div>
              ),
              icon: null,
            },
            {
              title: "Most Issued Alert Type Today",
              value: (
                <h1 className="font-bold text-lg sm:text-xl lg:text-2xl">
                  {commonAlertType}
                </h1>
              ),
              foot: `Yesterday: ${commonAlertTypePrev}`,
              icon: null,
            },
            {
              title: "Most Alerts Active by Office",
              value: (
                <ol className="list-decimal list-inside space-y-1 text-sm font-bold">
                  {commonRegions.slice(0, 3).map((r, i) => (
                    <li key={i}>
                      {typeof r === "string" ? r.substring(4) : r}
                    </li>
                  ))}
                </ol>
              ),
              foot: `Yesterday: ${commonRegionsPrev
                .slice(0, 2)
                .map((r) => (typeof r === "string" ? r.substring(4) : r))
                .join(" | ")}`,
              icon: null,
            },
          ].map(({ title, value, foot }, idx) => (
            <div
              key={idx}
              className="bg-transparent border border-gray-400 rounded-2xl p-4 flex flex-col justify-between"
            >
              <p className="font-bold text-xs sm:text-sm truncate">{title}</p>
              <div className="my-2">
                {typeof value === "number" || typeof value === "string" ? (
                  <h1 className="font-bold text-2xl sm:text-3xl lg:text-5xl truncate">
                    {value}
                  </h1>
                ) : (
                  value
                )}
              </div>
              <div className="text-xs text-white">{foot}</div>
            </div>
          ))}
        </div>
      )}
      {/* Alerts/Map */}
      <div className="flex flex-col md:flex-row w-full flex-1 mt-5 mb-5 gap-3 overflow-hidden bg-[#283648]">
        {/* Active Alert Contatiner */}
        <div className="flex w-full md:w-1/2 h-64 sm:h-80 md:h-full border border-[#71717a] rounded-2xl">
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
        <div className="relative w-full md:w-1/2 h-64 sm:h-80 md:h-full border border-[#71717a] rounded-2xl">
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
            {selectedAlert && selectedAlert.length > 0 && (
              <Popup
                longitude={selectedAlert[0].longitude}
                latitude={selectedAlert[0].latitude}
                anchor="top"
                onClose={() => setSelectedAlert(undefined)}
                closeOnClick={false}
              >
                <div className="flex flex-col">
                  {renderPopupBody(selectedAlert)}
                </div>
              </Popup>
            )}
            <Source
              id="noaa-radar-source"
              type="raster"
              tiles={tiles}
              tileSize={256}
            >
              <Layer {...rasterLayer} />
            </Source>
            <Source id="alert-polygons" type="geojson" data={combinedFeatures}>
              <Layer {...alertFillLayer}></Layer>
              <Layer {...alertLineLayer}></Layer>
            </Source>
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
