import { Router } from "express";
import leadsRouter from "./leads.routes.js";
import adminsRouter from "./admins.routes.js";
import messagesRouter from "./messages.routes.js";
import requireAuth from "../middleware/require-auth.js";
// sau này có thể thêm: agentsRouter, reportsRouter, ...

const r = Router();

r.get("/", (_req, res) => {
  res.json({ name: "wmhsl-real-estate-backend", version: "v1" });
});

// Keep public form open under /leads/public; protect other operations
r.use("/leads", leadsRouter);
r.use("/admins", requireAuth, adminsRouter);
r.use("/messages", requireAuth, messagesRouter);

export default r;
