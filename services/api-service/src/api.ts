import express, { Application, Request, Response } from "express";

// Init express application
const app: Application = express();
const PORT = process.env.PORT || 3030;

// Use middleware JSON
app.use(express.json());

// Routes
app.get("/", (req: Request, res: Response) => {
  res.send("SIREN API");
});

// Listen for requests
app.listen(PORT, () => {
  console.log(`SIREN api-service is running on port ${PORT}`);
});
