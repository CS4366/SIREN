import { useState } from "react";
import {
  Button,
  Switch,
  Select,
  SelectItem,
  Slider,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownSection,
  DropdownItem,
  Input,
} from "@heroui/react";
import { useSettings } from "../context/SettingsContext";
import { useAlertContext } from "../context/AlertContext";

// SettingsPage component
const SettingsPage = () => {
  const { isPushConnected, isAPIConnected } = useAlertContext();

  const { setCoordinates } = useSettings();
  const { setMapStyle } = useSettings();
  const { setBorderOpacity } = useSettings();
  const { setFillOpacity } = useSettings();
  const { borderOpacity, fillOpacity } = useSettings();

  // User Zip Code
  const [zipCode, setZipCode] = useState("");

  // Map style change
  const handleMapStyleChange = (style: string) => {
    // Gather style from input
    const selectedStyle = mapStyles.find(
      (map) => map.id.toString() === style
    )?.value;
    // Set the style in the context
    if (selectedStyle) {
      setMapStyle(selectedStyle);
    }
  };

  // Handle location change using zip code
  const handleLocationChange = () => {
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
        setCoordinates(newCoordinates);
      })
      .catch((error) => {
        console.error("Error fetching location data:", error);
      });
  };

  // TODO
  // enablePushNotifications
  // disablePushNotifications
  // setFilteredAlerts

  // Map types
  const mapStyles = [
    {
      id: 1,
      name: "Navigation Night",
      value: "mapbox://styles/mapbox/navigation-night-v1",
    },
    {
      id: 2,
      name: "Satellite",
      value: "mapbox://styles/mapbox/satellite-streets-v12",
    },
    { id: 3, name: "Dark", value: "mapbox://styles/mapbox/dark-v11" },
    { id: 4, name: "Light", value: "mapbox://styles/mapbox/light-v11" },
  ];

  // Alert types will change later when we have a full list of alerts
  const alertTypes = [
    { id: 1, name: "Tornado Watch" },
    { id: 2, name: "Tornado Warning" },
    { id: 3, name: "Servere Thunderstorm Watch" },
    { id: 4, name: "Servere Thunderstorm Warning" },
    { id: 5, name: "Winter Storm" },
    { id: 6, name: "High Wind Advisory" },
    { id: 7, name: "Special Weather Event" },
  ];

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-[#283648]">
      {/* Header */}
      <div className="flex w-full flex-row justify-between ">
        {/* Page Info */}
        <div className="flex-col w-full justify-start m-5">
          <div className="flex w-full justify-start text-3xl font-bold italic">
            SIREN
          </div>
          <div className="flex w-full justify-start txt-small font-light">
            Web App Settings
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

      {/* Settings Container */}
      <div className="flex w-full h-full flex-col md:flex-row lg:flex-row xl:flex-row justify-between gap-3 overflow-hidden mb-5 md:ml-5 lg:ml-5 xl:ml-5">
        {/* Left Side Settings */}
        <div className="flex w-full sm:w-full md:w-full h-full border flex-col justify-start border border-[#71717a] rounded-2xl p-3 gap-1 overflow-y-auto">
          <h1 className="font-bold text-lg">App Settings</h1>
          <p className="font-bold text-md">User Location</p>

          {/* Location Input */}
          <div className="flex flex-row items-center gap-3">
            <Input
              type="text"
              label="Zip Code"
              size="sm"
              placeholder="Enter Zip Code"
              className="w-full h-full rounded-xl light"
              onChange={(e) => setZipCode(e.target.value)}
            />
            <Button onPress={handleLocationChange} className="light">
              Use Location
            </Button>
          </div>

          {/* Push Notifications Input */}
          <p className="font-bold text-md mt-2">Push Notifications</p>
          <div className="flex flex-row items-center gap-3">
            <Switch defaultChecked={false} color="success" className="light" />
            <label className="text-sm font-bold">
              Enable Browser Push Notifications
            </label>
          </div>

          {/* Map Input */}
          <h1 className="font-bold text-md mt-2">Map Settings</h1>

          <Select
            label="Basemap Style"
            variant="bordered"
            size="sm"
            className="w-full rounded-2xl"
            onChange={(e) => handleMapStyleChange(e.target.value)}
          >
            {mapStyles.map((map) => (
              <SelectItem key={map.id}>{map.name}</SelectItem>
            ))}
          </Select>
          <div className="flex flex-row items-center gap-3 mt-1">
            <div className="flex flex-col w-1/2 gap-3">
              <p className="text-sm">Alert Border Opacity</p>
              <Slider
                defaultValue={[borderOpacity]}
                color="foreground"
                maxValue={100}
                minValue={0}
                step={10}
                showSteps={true}
                className="w-full"
                size="lg"
                onChange={(value) => setBorderOpacity(value[0])}
              />
            </div>
            <div className="flex flex-col w-1/2 gap-3">
              <p className="text-sm">Alert Background Opacity</p>
              <Slider
                defaultValue={[fillOpacity]}
                color="foreground"
                maxValue={100}
                minValue={0}
                step={10}
                size="lg"
                showSteps={true}
                className="w-full"
                onChange={(value) => setFillOpacity(value[0])}
              />
            </div>
          </div>

          {/* Filtered Alerts Input */}
          <div className="flex flex-row w-full h-auto justify-between mt-2">
            <h1 className="font-bold text-md">Filtered Alerts</h1>
            <Dropdown>
              <DropdownTrigger>
                <Button
                  variant="bordered"
                  className="text-sm border border-[#71717a] text-white"
                >
                  Select Alerts
                </Button>
              </DropdownTrigger>
              <DropdownMenu>
                <DropdownSection title="Alert Types">
                  {alertTypes.map((alert) => (
                    <DropdownItem
                      key={alert.id}
                      value={alert.name}
                      onClick={() => {
                        // Add the alert to the alert types div
                        const alertTypesDiv =
                          document.getElementById("alert-types");
                        if (alertTypesDiv) {
                          const alertElement = document.createElement("div");
                          alertElement.textContent = alert.name;
                          alertElement.className =
                            "h-auto w-full border border-[#FFFFFF] rounded-2xl flex flex-col justify-start bg-[#283648] text-white p-4";
                          // Delete the alert when clicked
                          alertElement.addEventListener("click", () => {
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
          <div
            className="flex flex-col w-full h-auto gap-3 overflow-y-auto mt-2"
            id="alert-types"
          />
        </div>

        {/* Right Side Info */}
        <div className="flex w-9/10 sm:w-9/10 md:w-9/10 lg:w-2/5 xl:w-2/5 h-full border flex-col justify-start border border-[#71717a] rounded-2xl md:mr-10 lg:mr-10 xl:mr-10 overflow-y-auto">
          <h1 className="font-bold text-lg m-3">
            Open Source Acknowledgements
          </h1>
          <p className="font-light text-md m-3">
            SIREN was built with all weather data coming from the National
            Weather Service (NWS) and the National Oceanic and Atmospheric
            Administration (NOAA) via the NWWS OI. The maps were built using
            Mapbox. Zip code data was gathered using the Zippopotam.us API. We
            also ask that if you use our public API or Push Service for your own
            projects to give us credit.
          </p>
          <h1 className="font-bold text-lg m-3">About SIREN</h1>
          <p className="font-light text-md m-3">
            SIREN was developed by Texas Tech University students to ingest and
            disseminate weather alerts from the NWWS OI. The frontend was built
            using React, TypeScript and Tailwind CSS. The backend, which is
            composed of microservices and helper services, was built using with
            a mixture of GoLang, and TypeScript. All data is stored in a NoSQL
            database (MongoDB). If you wish to learn more about the architecture
            of SIREN or wish to use our services, please visit our &nbsp;
            <a
              href="https://github.com/CS4366/SIREN"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 underline"
            >
              GitHub
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
