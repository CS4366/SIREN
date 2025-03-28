import { useEffect, useState } from "react";
import { io } from "socket.io-client";

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
  const [isPushConnected, setIsPushConnected] = useState(socket.connected);
  const [isAPIConnected, setIsAPIConnected] = useState(false);

  useEffect(() => {
    socket.connect();

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    fetch(API_URL).then((res) => {
      if (res.ok) {
        setIsAPIConnected(true);
      } else {
        setIsAPIConnected(false);
      }
    });
  }, []);

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

  return (
    <div className="flex h-screen w-full flex-col">
      <div>
        <div className="flex w-full justify-center">HomePage</div>
        <div className="flex items-center">
          SIREN Live Status:{" "}
          {isPushConnected ? (
            <div className="mx-1 w-4 h-4 rounded-full bg-green-500 animate-pulse"></div>
          ) : (
            <div className="mx-1 w-4 h-4 rounded-full bg-red-500 animate-pulse"></div>
          )}
        </div>
        <div className="flex items-center">
          SIREN API Status:{" "}
          {isAPIConnected ? (
            <div className="mx-1 w-4 h-4 rounded-full bg-green-500 animate-pulse"></div>
          ) : (
            <div className="mx-1 w-4 h-4 rounded-full bg-red-500 animate-pulse"></div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HomePage;
