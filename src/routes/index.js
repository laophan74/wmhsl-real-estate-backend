import { Router } from "express";
import leadsRouter from "./leads.routes.js";
import adminsRouter from "./admins.routes.js";
import messagesRouter from "./messages.routes.js";
// sau này có thể thêm: agentsRouter, reportsRouter, ...

const r = Router();

r.get("/", (_req, res) => {
  res.json({ name: "wmhsl-real-estate-backend", version: "v1" });
});

r.use("/leads", leadsRouter);
r.use("/admins", adminsRouter);
r.use("/messages", messagesRouter);

export default r;
