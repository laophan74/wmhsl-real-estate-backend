import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { initFirebase, db } from "./config/firebase.js";

initFirebase(); // phải gọi trước khi dùng db()

const app = express();
const PORT = process.env.PORT || 8080;

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

app.get("/healthz", async (_req, res, next) => {
  try {
    await db().collection("_meta").doc("health").set({ ts: new Date() }, { merge: true });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal Server Error", message: err.message });
});

app.listen(PORT, () => console.log(`[api] running on :${PORT}`));
