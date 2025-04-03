import { useRef, useEffect, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css';
import { map } from 'framer-motion/client';

const MapPage = () => {
  // Refs for MapboxGL
  const mapRef = useRef();
  const mapContainerRef = useRef<HTMLDivElement | null>(null);

  //TODO:
  // getAlertPolygons(all active alerts)
  // filterByLocation(zoom in on area specified by user)

  // Get alert polygons from API
  // This is just a placeholder function for testing purposes
  const getAlertPolygons = () => {

    // Get polygons from API, this is just for testing

    return [
      {
      color: '#FF0000',
      coordinates: [
        [
        [-101.88457, 33.57462],
        [-101.88457, 33.67462],
        [-101.77457, 33.67462],
        [-101.77457, 33.57462],
        [-101.88457, 33.57462], // Closing the loop
        ],
      ],
      },
      {
      color: '#00FF00',
      coordinates: [
        [
        [-101.86457, 33.59462],
        [-101.86457, 33.69462],
        [-101.75457, 33.69462],
        [-101.75457, 33.59462],
        [-101.86457, 33.59462], // Closing the loop
        ],
      ],
      },
    ];
  };

  // Map Handling and Setup
  useEffect(() => {
    // MapboxGL setup
    mapboxgl.accessToken = 'pk.eyJ1IjoiYmdvcm1hbiIsImEiOiJjbTh5eDZtM2EwM2Q0MmtvOWxtZHUydjY0In0.95ybhEJ2-Z9VcKABogtE5A'
    
    // Add map to the mapContainerRef
    mapRef.current = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/navigation-night-v1',
      center: [-101.87457, 33.58462],
      zoom: 5,
      attributionControl: false,
    });

    // Add zoom and rotation controls to the map.
    mapRef.current.addControl(new mapboxgl.NavigationControl(), 'bottom-right');

    // Grab alert polygons from API
    const polygons = getAlertPolygons()

    mapRef.current?.on('load', () => {
      // Add each polygon to the map
      polygons.forEach((polygon) => {
        // Get polygon color and coordinates
        const color = polygon.color;
        const coordinates = polygon.coordinates;

        // Add polygon to the map
        mapRef.current?.addSource(`polygon-${color}`, {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: coordinates,
            },
          },
        });

        // Fill the polygon with the specified color
        mapRef.current?.addLayer({
          id: `polygon-${color}`,
          type: 'fill',
          source: `polygon-${color}`,
          layout: {},
          paint: {
            'fill-color': color,
            'fill-opacity': 0.5,
          },
        });

        // Add border to polygon darker than fill color
        mapRef.current?.addLayer({
          id: `outline-${color}`,
          type: 'line',
          source: `polygon-${color}`,
          layout: {},
          paint: {
            'line-color': color,
            'line-width': 2,
          },
        });
      });
    });

    // Clean up on unmount
    return () => {
      mapRef.current.remove()
    }
  }, [])

  // Page Layout
  return (
    <>
      {/* MapboxGL Container */}
      <div ref={mapContainerRef} className="flex flex-col h-full w-full">
        {/* Header */}
        <div className="flex flex-row h-2/10 w-9/10 m-5 p-5 justify-between items-center bg-[#283648] z-10 rounded-xl">
          <div className="flex flex-col gap-0 h-full w-1/4">
            <h1 className="text-lg sm:text-lg md:text-lg lg:text-xl xl:text-4xl font-bold italic leading-none">Siren</h1>
            <p className="text-sm sm:text-sm md:text-sm lg:text-md xl:text-lg font-light leading-none">Alert Map</p>
          </div>
          <input type="text" placeholder="Search SIREN Map" className="w-2/3 bg-white rounded-lg p-2 text-black h-2/3 text-lg text-sm sm:text-sm md:text-sm lg:text-md xl:text-lg font-light" />
        </div>
      </div>
    </>
  );
};

export default MapPage;
