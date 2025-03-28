import { Route, Routes, useHref, useLocation, useNavigate } from "react-router";
import "./App.css";
import { HeroUIProvider, Tab, Tabs } from "@heroui/react";
import HomePage from "./components/pages/HomePage";
import DataPage from "./components/pages/DataPage";
import MapPage from "./components/pages/MapPage";
import SettingsPage from "./components/pages/SettingsPage";
import { useTheme } from "@heroui/use-theme";
import { useWindowSize } from "@uidotdev/usehooks";

function App() {
  const navigate = useNavigate();
  const size = useWindowSize();
  const { pathname } = useLocation();
  const { theme } = useTheme();

  return (
    <HeroUIProvider navigate={navigate} useHref={useHref}>
      <main className={theme + " text-foreground bg-background"}>
        <div className="flex h-screen md:flex-row flex-col w-full">
          <div className="px-4 py-2 flex md:justify-start justify-center md:items-start items-center">
            <Tabs
              isVertical={(size.width ?? 1000) > 768}
              selectedKey={pathname}
              className="justify-center items-center"
            >
              <Tab key="/" href="/" title="Home" />
              <Tab key="/data" href="/data" title="Data" />
              <Tab key="/map" href="/map" title="Map" />
              <Tab key="/settings" href="/settings" title="Settings" />
            </Tabs>
          </div>
          <div className="flex w-full justify-center items-center h-screen">
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
