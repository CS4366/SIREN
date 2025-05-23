import { useRef, useState, useMemo, useEffect, useId } from "react";
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
import { Divider, Input } from "@heroui/react";
import GeoJSON from "geojson";

interface SelectedSirenAlert {
  longitude: number;
  latitude: number;
  alertData: SirenAlert;
}

const MapSources = ({
  geojson,
  countyJson,
  pushJson,
  fill,
  line,
  polygons,
}) => {
  const { borderOpacity, fillOpacity } = useSettings();

  const combined = useMemo<
    GeoJSON.FeatureCollection<GeoJSON.Geometry, GeoJSON.GeoJsonProperties>
  >(() => {
    return {
      type: "FeatureCollection",
      features: [
        ...geojson.features,
        ...countyJson.features,
        ...pushJson.features,
      ],
    };
  }, [geojson, countyJson, pushJson]);

  const alertFillLayer = useMemo<LayerProps>(
    () => ({
      id: fill,
      type: "fill",
      paint: {
        "fill-color": ["get", "color"],
        "fill-opacity": fillOpacity / 100,
      },
    }),
    [fillOpacity, fill]
  );

  const alertLineLayer = useMemo<LayerProps>(
    () => ({
      id: line,
      type: "line",
      paint: {
        "line-color": ["get", "color"],
        "line-opacity": borderOpacity / 100,
      },
    }),
    [borderOpacity, line]
  );

  return (
    <>
      <Source id={polygons} type="geojson" data={combined}>
        <Layer {...alertLineLayer} />
        <Layer {...alertFillLayer} />
      </Source>
    </>
  );
};

const MapPage = () => {
  const uid = useId();
  const srcId = `alert-polygons-${uid}`; // "alert-polygons-:r12f5"
  const fill = `${srcId}-fill`;
  const line = `${srcId}-outline`;

  // Refs for MapboxGL
  const mapRef = useRef<MapRef | null>(null);

  // Get the coordinates and map style from the context
  const { coordinates, mapStyle } = useSettings();

  // Get the alert data and polygon data from the context
  const {
    alertData,
    polygonGeoJson,
    countyGeoJson,
    pushAlertList,
    pushGeoJson,
  } = useAlertContext();

  const alertList = useMemo(() => {
    return [...pushAlertList, ...alertData];
  }, [alertData, pushAlertList]);

  // State variable for selected alert
  const [selectedAlert, setSelectedAlert] = useState<SelectedSirenAlert[]>();

  const handleMapClick = (event: MapMouseEvent) => {
    event.preventDefault();
    const selected: SelectedSirenAlert[] = [];

    if ((event.features ?? []).length > 0) {
      for (const feature of event.features ?? []) {
        const foundAlert = alertList.find(
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

  const renderPopupBody = (data: SelectedSirenAlert[]) => {
    return data.map((alert) => {
      return (
        <div key={alert.alertData.identifier}>
          <h3>{alert.alertData.capInfo.info.event}</h3>
          <p>
            Updated:{" "}
            {new Date(alert.alertData.lastUpdatedTime).toLocaleString("en-US")}
          </p>
          <Divider />
        </div>
      );
    });
  };

  useEffect(() => {
    // Check if mapRef is defined and current
    if (mapRef.current) {
      // Set the map style using the mapRef
      mapRef.current?.getMap().setStyle(mapStyle); // Force the map to update its style
    }
  }, [mapStyle]);

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
        interactiveLayerIds={[fill, line]}
        id="map"
        reuseMaps
      >
        <MapSources
          geojson={polygonGeoJson}
          countyJson={countyGeoJson}
          pushJson={pushGeoJson}
          polygons={srcId}
          fill={fill}
          line={line}
        />
        <Source
          id={`noaa-radar-source-${uid}`}
          type="raster"
          tiles={[BASE_URL]}
          tileSize={256}
        >
          <Layer
            id={`big-radar-layer-${uid}`}
            type="raster"
            source={`noaa-radar-source-${uid}`}
            paint={{
              "raster-opacity": 0.4,
            }}
          />
        </Source>

        <NavigationControl position="bottom-right" />
        <GeolocateControl position="bottom-right" />

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
      </Map>
    </div>
  );
};

export default MapPage;
