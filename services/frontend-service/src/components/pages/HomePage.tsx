import { useRef, useEffect, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css';
import { io } from "socket.io-client";
import Alert from "../elements/Alert";
import UpArrow from "../../assets/up-arrow.png";
import DownArrow from "../../assets/down-arrow.png";
import { useWindowSize } from "@uidotdev/usehooks";

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
  // State variables for push and API connection status
  const [isPushConnected, setIsPushConnected] = useState(socket.connected);
  const [isAPIConnected, setIsAPIConnected] = useState(false);
  // State variables for alert data this will be fetched from API later on
  // Sets will need to be added back in later they were taken out so there wouldnt be any hosting errors
  const [activeAlerts] = useState(8);
  const [activeIncrease] = useState(1);
  const [totalAlerts] = useState(148);
  const [totalAlertsIncrease] = useState(1);
  const [commonAlertType] = useState("Servere Thunderstorm Warning");
  const [commonAlertTypeYesterday] = useState("Special Weather Statement");
  const [mostAlertAreas] = useState(["West Texas", "East Texas", "Great Plains"]);
  const [yesterdayMostAlertAreas] = useState(["West Texas", "East Texas"]);
  

  // Refs for MapboxGL
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // TODO: Add functionality to fetch data for components from API
  // getTotalAlertsToday
  // getCurrentAlerts
  // getMostPrevelentAlert
  // getMostAffected Areas (Today/Right Now)
  // getAlertsForArea (City/State/Zip, etc)
  // displayAlertOnMap (Logic done, but data still needs to be fetched from API)



  // This is just for testing purpoeses
  // Once API is implemented, Alerts will be
  // fetched from the API and displayed on the map
  // and made to an Alert Object
  const getAlertPolygons = () => {

    // Get polygons from API, this is just for testing

    // Testing Data
    return [
      {
      color: '#FF0000',
      coordinates: [
        [
        [-101.88457, 33.57462],
        [-101.88457, 33.67462],
        [-101.77457, 33.67462],
        [-101.77457, 33.57462],
        [-101.88457, 33.57462], 
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
        [-101.86457, 33.59462], 
        ],
      ],
      },
    ];
  };

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

//   // Map Handling and Setup
  useEffect(() => {
    // MapboxGL setup
    mapboxgl.accessToken = 'pk.eyJ1IjoiYmdvcm1hbiIsImEiOiJjbTh5eDZtM2EwM2Q0MmtvOWxtZHUydjY0In0.95ybhEJ2-Z9VcKABogtE5A'
    
    // Add map to the mapContainerRef
    mapRef.current = new mapboxgl.Map({
      container: mapContainerRef.current as HTMLElement,
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
            properties: {}, // Add this field to satisfy the required 'properties'
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
      if (mapRef.current) {
        mapRef.current.remove();
      }
    }
  }, [])


  return (
    <div className="flex h-full w-full flex-col bg-[#283648] text-white items-start md:m-5 lg:m-5 xl:m-5 overflow-y-auto">
        {/* Header */}
      <div className="flex w-full flex-row justify-between ">
        {/* Page Info */}
        <div className="flex-col w-full justify-start mt-5 ml-5 md:ml-0 lg:ml-0 xl:ml-0">
          <div className="flex w-full justify-start text-3xl font-bold italic">SIREN</div>
          <div className="flex w-full justify-start txt-small font-light">Web Dashboard</div>
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
        {(() => {
          const { width } = useWindowSize();
          return width !== null && width >= 768;
        })() && (
        <div className="flex flex-col md:flex-row lg:flex-row xl:flex-row w-full h-1/3 md:h-1/5 gap-3 mt-3">
            <div className="flex flex-col h-auto w-full md:w-1/5 lg:w-1/5 xl:1/5 border border-[#71717a] rounded-2xl justify-between overflow-y-auto">
                <p className="font-bold p-2 text-xs sm:text-xs md:text-sm lg:text-sm xl:text-sm truncate">Total Active Alerts</p>
                <h1 className="font-bold p-2 text-xl sm:text-2xl md:text-3xl lg:text-5xl xl:text-7xl truncate">{activeAlerts}</h1>
                <div className="flex justify-start items-center p-2">
                    <img src={activeIncrease > 0 ? UpArrow : DownArrow} alt="arrow" className="w-4 h-4"/>
                    <p className="p-2 text-xs sm:text-xs md:text-xs lg:text-xs xl:text-xs truncate">{activeIncrease > 0 ? "Up" : "Down"} {activeIncrease}% from yesterday</p>
                </div>
            </div>
            <div className="flex flex-col h-full w-full md:w-1/5 lg:w-1/5 xl:1/5 border border-[#71717a] rounded-2xl justify-between overflow-y-auto">
                <p className="font-bold p-2 text-xs sm:text-xs md:text-sm lg:text-sm xl:text-sm truncate">Total Alerts</p>
                <h1 className="font-bold p-2 text-xl sm:text-2xl md:text-3xl lg:text-5xl xl:text-7xl truncate">{totalAlerts}</h1>
                <div className="flex justify-start items-center p-2">
                    <img src={totalAlertsIncrease > 0 ? UpArrow : DownArrow} alt="arrow" className="w-4 h-4"/>
                    <p className="p-2 text-xs sm:text-xs md:text-xs lg:text-xs xl:text-xs truncate">{totalAlertsIncrease > 0 ? "Up" : "Down"} {totalAlertsIncrease}% from yesterday</p>
                </div>
            </div>
            <div className="flex flex-col h-full w-full md:w-1/3 lg:w-1/3 xl:1/3 border border-[#71717a] rounded-2xl justify-between overflow-y-auto">
                <p className="font-bold p-2 text-xs sm:text-xs md:text-sm lg:text-sm xl:text-sm truncate">Most Issued Alert Type Today</p>
                <p className="font-bold p-2 text-xs sm:text-sm md:text-sm lg:text-xl xl:text-xl truncate">{commonAlertType}</p>
                <p className="p-2 text-xs sm:text-xs md:text-xs lg:text-xs xl:text-xs truncate">Yesterday: {commonAlertTypeYesterday}</p>
            </div>
            <div className="flex flex-col h-full w-full md:w-1/2 lg:w-1/2 xl:1/2 border border-[#71717a] rounded-2xl justify-between overflow-y-auto">
                <p className="font-bold p-2 text-xs sm:text-xs md:text-xs lg:text-sm xl:text-sm truncate">Regions with Most Alerts</p>
                <div className="flex-col w-full p-2 font-bold truncate">
                    <h1 className="text-sm sm:text-sm md:text-md lg:text-lg xl:text-xl">1. {mostAlertAreas[0]}</h1>
                    <h1 className="text-sm sm:text-sm md:text-md lg:text-lg xl:text-xl">2. {mostAlertAreas[1]}</h1>
                    <h1 className="text-sm sm:text-sm md:text-md lg:text-lg xl:text-xl">3. {mostAlertAreas[2]}</h1>
                </div>
                <p className="p-2 text-xs sm:text-xs md:text-xs lg:text-xs xl:text-xs truncate">Yesterday: {yesterdayMostAlertAreas[0]} | {yesterdayMostAlertAreas[1]}</p>
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
                        <input type="text" placeholder="Filter by Location" className="p-2 border w-2/5 border-white rounded-md focus:outline-none bg-transparent text-xs sm:text-xs md:text-sm lg:text-md xl:text-lg font-light" />
                    </div>
                    <div className="flex-1 min-h-0 overflow-y-auto">
                        {/* Active Alerts (Will be populated from APO) */}
                        <Alert 
                            alertType="Tornado Watch"
                            alertIssue="NWS Lubbock"
                            alertAreas={["Lubbock TX", "Wolfforth TX", "Snyder TX"]}
                            alertStartTime="10:00 AM"
                            alertEndTime="12:00 PM"
                            alertDescription={['At 821 PM EDT, a severe thunderstorm capable of producing a tornado was located near Wolfforth, moving northeast at 40 mph.', 'HAZARD...Tornado and quarter size hail.','SOURCE...Radar indicated rotation.','IMPACT...Flying debris will be dangerous to those caught without shelter. Mobile homes will be damaged or destroyed. Damage to roofs, windows, and vehicles will occur. Tree damage is likely.']}
                            alertInstructions="TAKE COVER NOW! Move to a basement or an interior room on the lowestfloor of a sturdy building. Avoid windows. If you are outdoors, in amobile home, or in a vehicle, move to the closest substantial shelterand protect yourself from flying debris."
                            alertHistory={['Alert Issued', 'Alert Updated - Time Extended']}
                            color="#FF0000"
                        />
                        <Alert 
                            alertType="Tornado Watch"
                            alertIssue="NWS Lubbock"
                            alertAreas={["Lubbock TX", "Wolfforth TX", "Snyder TX"]}
                            alertStartTime="10:00 AM"
                            alertEndTime="12:00 PM"
                            alertDescription={['At 821 PM EDT, a severe thunderstorm capable of producing a tornado was located near Wolfforth, moving northeast at 40 mph.', 'HAZARD...Tornado and quarter size hail.','SOURCE...Radar indicated rotation.','IMPACT...Flying debris will be dangerous to those caught without shelter. Mobile homes will be damaged or destroyed. Damage to roofs, windows, and vehicles will occur. Tree damage is likely.']}
                            alertInstructions="TAKE COVER NOW! Move to a basement or an interior room on the lowestfloor of a sturdy building. Avoid windows. If you are outdoors, in amobile home, or in a vehicle, move to the closest substantial shelterand protect yourself from flying debris."
                            alertHistory={['Alert Issued', 'Alert Updated - Time Extended']}
                            color="#FF0000"
                        />
                        <Alert 
                            alertType="Tornado Watch"
                            alertIssue="NWS Lubbock"
                            alertAreas={["Lubbock TX", "Wolfforth TX", "Snyder TX"]}
                            alertStartTime="10:00 AM"
                            alertEndTime="12:00 PM"
                            alertDescription={['At 821 PM EDT, a severe thunderstorm capable of producing a tornado was located near Wolfforth, moving northeast at 40 mph.', 'HAZARD...Tornado and quarter size hail.','SOURCE...Radar indicated rotation.','IMPACT...Flying debris will be dangerous to those caught without shelter. Mobile homes will be damaged or destroyed. Damage to roofs, windows, and vehicles will occur. Tree damage is likely.']}
                            alertInstructions="TAKE COVER NOW! Move to a basement or an interior room on the lowestfloor of a sturdy building. Avoid windows. If you are outdoors, in amobile home, or in a vehicle, move to the closest substantial shelterand protect yourself from flying debris."
                            alertHistory={['Alert Issued', 'Alert Updated - Time Extended']}
                            color="#FF0000"
                        />
                    </div>
                </div>
            </div>
            {/* Alert-Map Containter */}
            <div id="map-container" className="flex w-full md:w-1/2 h-full border border-[#71717a] rounded-2xl mt-0" ref={mapContainerRef}>
            {/* Alert-Map Header */}
                <div className="absolute top-2 left-2 z-10">
                    <h2 className="text-lg font-bold">Active Mini-Map</h2>
                </div>
            </div>
        </div>
    </div>
  );
};


export default HomePage;
