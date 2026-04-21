import express from "express";
import cors from "cors";
import { registerProcessRoutes } from "./routes/processRoutes";

export function createApp(): express.Application {
  const app = express();
  app.use(cors({ origin: true }));
  app.use(express.json({ limit: "512kb" }));
  registerProcessRoutes(app);
  return app;
}
