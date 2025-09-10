import { Router } from "express";
import leadsRouter from "./leads.routes.js";
// sau này có thể thêm: agentsRouter, reportsRouter, ...

const r = Router();

r.get("/", (_req, res) => {
  res.json({ name: "wmhsl-real-estate-backend", version: "v1" });
});

r.use("/leads", leadsRouter);

export default r;
