import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { Button, Switch, Select, SelectItem, Slider,Dropdown, DropdownTrigger, DropdownMenu, DropdownSection, DropdownItem} from "@heroui/react";
import AlertType from "../elements/AlertType";

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

const SettingsPage = () => {
  // State variables for push and API connection status
  const [isPushConnected, setIsPushConnected] = useState(socket.connected);
  const [isAPIConnected, setIsAPIConnected] = useState(false);


  // TODO
  // changeLocation
  // useDefaultLocation
  // enablePushNotifications
  // disablePushNotifications
  // setMapBasemap
  // setAlertBorderOpacity
  // setAlertBackgroundOpacity
  // setFilteredAlerts

  // Map types
  const maps = [
    { id: 1, name: "Navigation - Dark" },
    { id: 2, name: "Dark" },
    { id: 3, name: "Light" },
    { id: 4, name: "Satellite Streets" },
  ]

  // Alert types will change later when we have a full list of alerts
  const alertTypes = [
    { id: 1, name: "Tornado Watch" },
    { id: 2, name: "Tornado Warning" },
    { id: 3, name: "Servere Thunderstorm Watch" },
    { id: 4, name: "Servere Thunderstorm Warning" },
    { id: 5, name: "Winter Storm" },
    { id: 6, name: "High Wind Advisory" },
    { id: 7, name: "Special Weather Event" },
  ]
  
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
  
  return(
    <div className="flex h-screen w-full flex-col overflow-hidden bg-[#283648]">
      {/* Header */}
      <div className="flex w-full flex-row justify-between ">
        {/* Page Info */}
        <div className="flex-col w-full justify-start m-5">
          <div className="flex w-full justify-start text-3xl font-bold italic">SIREN</div>
          <div className="flex w-full justify-start txt-small font-light">Web App Settings</div>
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

      {/* Settings Container */}
      <div className="flex w-full h-full flex-col md:flex-row lg:flex-row xl:flex-row justify-between gap-3 overflow-hidden mb-5 md:ml-5 lg:ml-5 xl:ml-5" >
        
        {/* Left Side Settings */}
        <div className="flex w-full sm:w-full md:w-full h-full border flex-col justify-start border border-[#71717a] rounded-2xl p-3 gap-1 overflow-y-auto">      
              <h1 className="font-bold text-lg">App Settings</h1>
              <p className="font-bold text-md">User Location</p>
              
              {/* Location Input */}
              <div className="flex flex-row h-1/10 items-center gap-3">
                <input type="text" placeholder="Lubbock, TX" className="w-3/4 bg-white text-[#71717a] h-full rounded-xl p-3 border-none outline-none" />
                <Button className="h-full w-1/4 border border-white bg-white text-[#71717a] text-xs sm:text-xs md:text:xs lg:text-md xl:text-md p-2">Use Current Location</Button>
              </div>
              <p className="font-light text-xs text-[#71717a]">Default location for the user</p>
              
              {/* Push Notifications Input */}
              <p className="font-bold text-md mt-2">Push Notifications</p>
              <div className="flex flex-row items-center gap-3">
                <Switch defaultChecked={false} color='success' />
                <label className="text-sm font-bold">Enable Browser Push Notifications</label>
              </div>
              
              {/* Map Input */}
              <h1 className="font-bold text-md mt-2">Map Settings</h1>
              <p className="text-sm">Map Basemap</p>
              <Select label="Select a Map" variant="#bordered" className="w-full h-auto border border-[#71717a] rounded-2xl">
                {maps.map((map) => (
                  <SelectItem key={map.id} value={map.name}>
                    {map.name}
                  </SelectItem>
                ))}
              </Select>
              <div className="flex flex-row items-center gap-3 mt-1">
                <div className='flex flex-col w-1/2 gap-3'>
                  <p className="text-sm">Alert Border Opacity</p>
                  <Slider
                    defaultValue={[100]}
                    color="foreground"
                    max={100}
                    min={0}
                    step={10}
                    showSteps={true}
                    className="w-full"
                    size="lg"
                    />
                </div>
                <div className='flex flex-col w-1/2 gap-3'>
                  <p className="text-sm">Alert Background Opacity</p>
                  <Slider
                    defaultValue={[40]}
                    color="foreground"
                    max={100}
                    min={0}
                    step={10}
                    size="lg"
                    showSteps={true}
                    className="w-full"
                    />
                </div>
              </div>
              
              {/* Filtered Alerts Input */}
              <div className="flex flex-row w-full h-auto justify-between mt-2">
                <h1 className="font-bold text-md">Filtered Alerts</h1>
                <Dropdown>
                  <DropdownTrigger>
                    <Button variant="bordered" className="text-sm border border-[#71717a]">Select Alerts</Button>
                  </DropdownTrigger>
                  <DropdownMenu>
                    <DropdownSection title="Alert Types">
                      {alertTypes.map((alert) => (
                        <DropdownItem
                          key={alert.id}
                          value={alert.name}
                          onClick={() => {
                          // Add the alert to the alert types div
                          const alertTypesDiv = document.getElementById('alert-types');
                          if (alertTypesDiv) {
                            const alertElement = document.createElement('div');
                            alertElement.textContent = alert.name;
                            alertElement.className = 'h-auto w-full border border-[#FFFFFF] rounded-2xl flex flex-col justify-start bg-[#283648] text-white p-4';
                            // Delete the alert when clicked
                            alertElement.addEventListener('click', () => {
                              alertTypesDiv.removeChild(alertElement);
                            });
                            alertTypesDiv.appendChild(alertElement);
                          }
                          }}
                        >
                          {alert.name}
                        </DropdownItem>
                      ))}
                    </DropdownSection>
                  </DropdownMenu>
                </Dropdown>
              </div>

              {/* Alert Tyoes */}
              <div className="flex flex-col w-full h-auto gap-3 overflow-y-auto mt-2" id='alert-types' />  
        </div>

        {/* Right Side Info */}
        <div className="flex w-9/10 sm:w-9/10 md:w-9/10 lg:w-2/5 xl:w-2/5 h-full border flex-col justify-start border border-[#71717a] rounded-2xl md:mr-10 lg:mr-10 xl:mr-10 overflow-y-auto">      
            <h1 className="font-bold text-lg m-3">Open Source Acknowledgements</h1>
            <p className="font-light text-md m-3">Random</p>
            <h1 className="font-bold text-lg m-3">About SIREN</h1>
            <p className="font-light text-md m-3">Random</p>
        </div>
      </div>
      



    </div>
  );
};

export default SettingsPage;
