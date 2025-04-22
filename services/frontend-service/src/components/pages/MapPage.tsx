import { useRef, useState, useMemo } from "react";
import { SirenAlert } from "../../model/Alert";
import "mapbox-gl/dist/mapbox-gl.css";
import Map, {
  Layer,
  LayerProps,
  MapMouseEvent,
  Popup,
  Source,
  MapRef,
  GeolocateControl,
  NavigationControl,
} from "react-map-gl/mapbox";
import { useSettings } from "../context/SettingsContext";
import { useAlertContext } from "../context/AlertContext";
import { Input } from "@heroui/react";

interface SelectedSirenAlert {
  longitude: number;
  latitude: number;
  alertData: SirenAlert;
}

const MapPage = () => {
  // Refs for MapboxGL
  const mapRef = useRef<MapRef | null>(null);

  // Get the coordinates and map style from the context
  const { coordinates, mapStyle, borderOpacity, fillOpacity } = useSettings();

  // Get the alert data and polygon data from the context
  const { alertData, polygonGeoJson, countyGeoJson } = useAlertContext();

  // State variable for selected alert
  const [selectedAlert, setSelectedAlert] = useState<SelectedSirenAlert>();

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

  // Handle map click event
  const handleMapClick = (event: MapMouseEvent) => {
    event.preventDefault();

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

  // Handle location change using zip code
  const handleLocationChange = (zipCode: string) => {
    // Gather zip code from input
    fetch(`https://api.zippopotam.us/us/${zipCode}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to fetch location data");
        }
        return response.json();
      })
      .then((data) => {
        // Extract latitude and longitude from the response
        const { longitude, latitude } = data.places[0];
        // Set the coordinates in the context
        const newCoordinates = {
          longitude: parseFloat(longitude),
          latitude: parseFloat(latitude),
        };
        // Update the map view
        if (mapRef.current) {
          // Do it with flyTo
          mapRef.current.flyTo({
            center: [newCoordinates.longitude, newCoordinates.latitude],
            zoom: 7,
          });
        }
      })
      .catch((error) => {
        console.error("Error fetching location data:", error);
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

  return (
    <div className="relative h-full w-full">
      <div className="absolute flex flex-row mt-2 ml-3 h-2/10 w-[98%] p-5 justify-between items-center bg-[#283648] rounded-2xl z-10">
        <div className="flex-none flex-col justify-center items-start">
          <h1 className="flex text-lg sm:text-lg md:text-lg lg:text-xl xl:text-4xl font-bold italic leading-none w-full">
            SIREN
          </h1>
          <p className="flex text-xs sm:text-xs md:text-sm lg:text-md xl:text-lg">
            Alert Map
          </p>
        </div>
        <div className="ml-5 w-full">
          <Input
            type="text"
            label="Search SIREN Map (Enter Zip Code)"
            size="sm"
            className="light w-full rounded-2xl"
            onChange={(e) => {
              const zipCode = e.target.value;
              handleLocationChange(zipCode);
            }}
          />
        </div>
      </div>

      <Map
        ref={mapRef}
        mapboxAccessToken="pk.eyJ1IjoiYmdvcm1hbiIsImEiOiJjbTh5eDZtM2EwM2Q0MmtvOWxtZHUydjY0In0.95ybhEJ2-Z9VcKABogtE5A"
        initialViewState={{ ...coordinates, zoom: 5 }}
        style={{
          width: "100vw",
          height: "100vh",
          position: "fixed",
          left: 0,
          top: 0,
        }}
        mapStyle={mapStyle}
        onClick={handleMapClick}
        interactiveLayerIds={["alert-polygons-fill", "county-polygons-fill"]}
        onLoad={(e) => {
          e.target.resize();
          e.target.triggerRepaint();
        }}
      >
        <Source
          id="noaa-radar-source"
          type="raster"
          tiles={tiles}
          tileSize={256}
        >
          <Layer {...rasterLayer} />
        </Source>
        <Source id="alert-polygons" type="geojson" data={combinedFeatures}>
          <Layer {...alertFillLayer} />
          <Layer {...alertLineLayer} />
        </Source>

        <NavigationControl position="bottom-right" />
        <GeolocateControl position="bottom-right" />

        {selectedAlert && (
          <Popup
            longitude={selectedAlert.longitude}
            latitude={selectedAlert.latitude}
            anchor="top"
            onClose={() => setSelectedAlert(undefined)}
            closeOnClick={false}
          >
            <h3>{selectedAlert.alertData.capInfo.info.event}</h3>
            <p>
              Updated:{" "}
              {new Date(selectedAlert.alertData.lastUpdatedTime).toLocaleString(
                "en-US"
              )}
            </p>
          </Popup>
        )}
      </Map>
    </div>
  );
};

export default MapPage;
