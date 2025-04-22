import { Route, Routes, useHref, useLocation, useNavigate } from "react-router";
import "./App.css";
import { HeroUIProvider, Tab, Tabs, ToastProvider } from "@heroui/react";
import HomePage from "./components/pages/HomePage";
import DataPage from "./components/pages/DataPage";
import MapPage from "./components/pages/MapPage";
import SettingsPage from "./components/pages/SettingsPage";
//import { useTheme } from "@heroui/use-theme";
import { useWindowSize } from "@uidotdev/usehooks";
import { SettingsProvider } from "./components/context/SettingsContext";
import { AlertProvider } from "./components/context/AlertContext";

function App() {
  // Needed hooks and variables
  const navigate = useNavigate();
  const size = useWindowSize();
  const { pathname } = useLocation();
  //const { theme } = useTheme();

  return (
    <HeroUIProvider navigate={navigate} useHref={useHref}>
      <ToastProvider placement="bottom-left" />
      <main className="dark text-foreground bg-background">
        <div className="flex h-screen flex-col md:flex-row w-full bg-[#283648] text-white">
          <div className="px-4 py-2 w-full md:w-auto md:justify-start justify-center md:items-start items-center z-10">
            {/* Nav Bar */}
            <Tabs
              fullWidth={(size.width ?? 1000) < 768}
              isVertical={(size.width ?? 1000) >= 768}
              selectedKey={pathname}
              variant="bordered"
              className={`light z-10 rounded-2xl ${
                pathname === "/map" ? "bg-[#283648]" : ""
              }`}
            >
              <Tab key="/" href="/" title="Home" />
              <Tab key="/data" href="/data" title="Data" />
              <Tab key="/map" href="/map" title="Map" />
              <Tab key="/settings" href="/settings" title="Settings" />
            </Tabs>
          </div>
          <div className="flex w-full justify-center items-center">
            {/* Router */}
            <SettingsProvider>
              <AlertProvider>
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/data" element={<DataPage />} />
                  <Route path="/map" element={<MapPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Routes>
              </AlertProvider>
            </SettingsProvider>
          </div>
        </div>
      </main>
    </HeroUIProvider>
  );
}

export default App;
