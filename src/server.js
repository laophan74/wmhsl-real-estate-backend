import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import v1Router from "./routes/index.js";
import { notFoundHandler } from "./middleware/not-found.js";
import { errorHandler } from "./middleware/error-handler.js";

export function createServer() {
  const app = express();

  // security & basics
  app.use(helmet());
  app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
  app.use(express.json({ limit: "1mb" }));
  app.use(morgan("dev"));

  // health
  app.get("/healthz", (_req, res) => res.json({ ok: true }));

  // api v1
  app.use("/api/v1", v1Router);

  // 404 & error
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
