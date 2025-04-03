import { Route, Routes, useHref, useLocation, useNavigate } from "react-router";
import "./App.css";
import { HeroUIProvider, Tab, Tabs } from "@heroui/react";
import HomePage from "./components/pages/HomePage";
import DataPage from "./components/pages/DataPage";
import MapPage from "./components/pages/MapPage";
import SettingsPage from "./components/pages/SettingsPage";
//import { useTheme } from "@heroui/use-theme";
import { useWindowSize } from "@uidotdev/usehooks";
import HomeIconDark from "./assets/HomeIconDark.png";
import SettingsIconDark from "./assets/SettingsIconDark.png";
import DataIconDark from "./assets/DataIconDark.png";
import MapIconDark from "./assets/MapIconDark.png";
import HomeIcon from "./assets/home-icon.png";
import DataIcon from "./assets/data-icon.png";
import MapIcon from "./assets/map-icon.png";
import SettingsIcon from "./assets/settings-icon.png";


function App() {
  // Needed hooks and variables
  const navigate = useNavigate();
  const size = useWindowSize();
  const { pathname } = useLocation();
  //const { theme } = useTheme();

  return (
    <HeroUIProvider navigate={navigate} useHref={useHref}>
      <main className={"text-foreground"}>
        <div className="flex h-screen md:flex-row flex-col w-full bg-[#283648] text-white">
          <div className="px-4 py-2 flex md:justify-start justify-center md:items-start items-center">
            {/* Nav Bar */}
            <Tabs
              isVertical={(size.width ?? 1000) > 768}
              selectedKey={pathname}
              color="default"
              variant="light"
              className="justify-center items-center"
            >
              <Tab key="/" href="/" title={
                <div className="flex items-center text-[#666666]-500">
                <img src={HomeIconDark} alt="Home" className="w-4 h-4 mr-2" />
                Home
                </div>
              } />
              <Tab key="/data" href="/data" title={
              <div className="flex items-center text-[#666666]-500">
                <img src={DataIconDark} alt="Data" className="w-4 h-4 mr-2" />
                Data
              </div>
              } />
              <Tab key="/map" href="/map" title={
              <div className="flex items-center text-[#666666]-500">
                <img src={MapIconDark} alt="Map" className="w-4 h-4 mr-2" />
                Map
              </div>
              } />
              <Tab key="/settings" href="/settings" title={
              <div className="flex items-center text-[#666666]-500">
                <img src={SettingsIconDark} alt="Settings" className="w-4 h-4 mr-2" />
                Settings
              </div>
              } />
            </Tabs>
          </div>
          <div className="flex w-full justify-center items-center h-screen">
            {/* Router */}
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/data" element={<DataPage />} />
              <Route path="/map" element={<MapPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </div>
        </div>
      </main>
    </HeroUIProvider>
  );
}

export default App;
