import { Server } from "socket.io";
import { closeMQ, connectToMQ } from "./mq/mq";

const PORT = process.env.PORT || 4000;

const io = new Server(Number(PORT), {
  cors: {
    origin: "*", // Allow all origins for now; customize in production
    methods: ["GET", "POST"],
  },
});

const startService = async () => {
  await connectToMQ("push", (msg) => {
    console.log("Received message from queue. Pushing to clients...");
    io.emit("live", msg);
  });

  console.log(`Push service is running on port ${PORT}`);
};

// Handle graceful shutdown
process.on("SIGINT", async () => {
  console.log("Shutting down...");
  await closeMQ();
  process.exit(0);
});

startService();
