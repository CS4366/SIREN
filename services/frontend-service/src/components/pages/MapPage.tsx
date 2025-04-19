import { useRef, useEffect, useState } from 'react';
import { SirenAlert } from "../../model/Alert";
import 'mapbox-gl/dist/mapbox-gl.css';
import Map, {
  Layer,
  LayerProps,
  MapMouseEvent,
  Popup,
  Source,
  MapRef,
} from "react-map-gl/mapbox";
import { useSettings } from "../context/SettingsContext";
import { useAlertContext } from "../context/AlertContext";

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
  const {
    alertData,
    polygonGeoJson,
    countyGeoJson,
  } = useAlertContext();

  // State variable for selected alert
  const [selectedAlert, setSelectedAlert] = useState<SelectedSirenAlert>();
  
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
  }, [fillOpacity, borderOpacity]);

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


  // Page Layout
  return (
    <>
      <div className="flex flex-col h-full w-full">
        <Map
          ref={mapRef}
          mapboxAccessToken="pk.eyJ1IjoiYmdvcm1hbiIsImEiOiJjbTh5eDZtM2EwM2Q0MmtvOWxtZHUydjY0In0.95ybhEJ2-Z9VcKABogtE5A"
          initialViewState={{
            longitude: coordinates.longitude,
            latitude: coordinates.latitude,
            zoom: 5,
          }}
          style={{ width: "100%", height: "100%" }}
          mapStyle={mapStyle}
          onClick={handleMapClick}
          interactiveLayerIds={[
          "alert-polygons-fill",
          "county-polygons-fill",
          ]}
        >
        <div className="absolute flex flex-row mt-5 ml-3 h-2/10 w-[98%] p-5 justify-between items-center bg-[#283648] rounded-2xl">
          <div className="flex flex-col gap-0 h-full w-1/4">
            <h1 className="text-lg sm:text-lg md:text-lg lg:text-xl xl:text-4xl font-bold italic leading-none">Siren</h1>
            <p className="text-sm sm:text-sm md:text-sm lg:text-md xl:text-lg font-light leading-none">Alert Map</p>
          </div>
          <input 
            type="text" 
            placeholder="Search SIREN Map(Enter Zip Code)" 
            className="w-2/3 bg-white focus:outline-none rounded-lg p-2 text-black h-2/3 text-lg text-sm sm:text-sm md:text-sm lg:text-md xl:text-lg font-light" 
            onChange={(e) => {
              const zipCode = e.target.value;
              handleLocationChange(zipCode);
            }}
          />
        </div>            
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
          </Popup>)}
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
          {polygonGeoJson.features.length > 0 && (
            <Source id="alert-polygons" type="geojson" data={polygonGeoJson}>
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
      </div>
    </>
  );
};

export default MapPage;
