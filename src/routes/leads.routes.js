import { Router } from "express";
import { celebrate, Segments, Joi } from "celebrate";
import * as LeadsCtrl from "../controllers/leads.controller.js";
import { asyncHandler } from "../middleware/async-handler.js";

const r = Router();

/**
 * POST /api/v1/leads/public
 * Nhận form homepage (public), tạo lead theo schema report
 */
r.post(
  "/public",
  celebrate({
    [Segments.BODY]: Joi.object({
      first_name: Joi.string().min(2).max(50).required(),
      last_name: Joi.string().min(2).max(50).required(),
      email: Joi.string().email().required(),
      phone: Joi.string().required(), // pattern AU mobile có thể áp trong controller/validator riêng
      suburb: Joi.string().allow("", null),
      interested: Joi.string().valid("yes", "no").required(),
      timeframe: Joi.string().valid("1-3 months","3-6 months","6+ months","not sure").required(),

      // optional tracking
      utm_source: Joi.string().allow("", null),
      utm_medium: Joi.string().allow("", null),
      utm_campaign: Joi.string().allow("", null),
    }),
  }),
  asyncHandler(LeadsCtrl.createPublicLead)
);

/**
 * GET /api/v1/leads
 * List/filter leads (basic)
 */
r.get(
  "/",
  celebrate({
    [Segments.QUERY]: Joi.object({
      status: Joi.string().valid("new","contacted","qualified","viewing","offer","converted","lost"),
      suburb: Joi.string(),
      category: Joi.string().valid("HOT","WARM","COLD"),
      limit: Joi.number().integer().min(1).max(100).default(20),
      offset: Joi.number().integer().min(0).default(0),
      q: Joi.string().allow(""), // search basic
    }),
  }),
  asyncHandler(LeadsCtrl.listLeads)
);

/**
 * GET /api/v1/leads/:id
 */
r.get(
  "/:id",
  celebrate({ [Segments.PARAMS]: Joi.object({ id: Joi.string().required() }) }),
  asyncHandler(LeadsCtrl.getLeadById)
);

/**
 * PATCH /api/v1/leads/:id/status
 * Update status (và push history)
 */
r.patch(
  "/:id/status",
  celebrate({
    [Segments.PARAMS]: Joi.object({ id: Joi.string().required() }),
    [Segments.BODY]: Joi.object({
      status: Joi.string().valid("new","contacted","qualified","viewing","offer","converted","lost").required(),
      notes: Joi.string().allow(""),
      changed_by: Joi.string().required(),
    }),
  }),
  asyncHandler(LeadsCtrl.updateLeadStatus)
);

/**
 * DELETE /api/v1/leads/:id
 * Soft delete -> metadata.deleted_at
 */
r.delete(
  "/:id",
  celebrate({ [Segments.PARAMS]: Joi.object({ id: Joi.string().required() }) }),
  asyncHandler(LeadsCtrl.softDeleteLead)
);

export default r;
