import Joi from "joi";

// Allowed suburbs - extend as needed
export const ALLOWED_SUBURBS = ["Asquith", "Hornsby", "Waitara"];

// Public form schema
export const createPublicBody = Joi.object({
  first_name: Joi.string().min(2).max(50).required(),
  last_name: Joi.string().min(2).max(50).required(),
  email: Joi.string().email().required(),
  // Australian mobile phone pattern: +614xxxxxxxx or 04xxxxxxxx
  phone: Joi.string().pattern(/^(?:\+61|0)4\d{8}$/).required(),
  preferred_contact: Joi.string().valid("email", "phone", "both").default("both"),
  suburb: Joi.string().valid(...ALLOWED_SUBURBS).required(),
  timeframe: Joi.string().valid("1-3 months", "3-6 months", "6+ months", "not sure").required(),
  // selling interest (existing)
  interested: Joi.string().valid("yes", "no").required(),

  // NEW: buying interest: accept either name the frontend might send
  interested_buying: Joi.string().valid("yes", "no").optional(),
  buying: Joi.string().valid("yes", "no").optional(),

  // optional tracking
  utm_source: Joi.string().allow("", null),
  utm_medium: Joi.string().allow("", null),
  utm_campaign: Joi.string().allow("", null),
}).options({ stripUnknown: false });

export const statusBody = Joi.object({
  status: Joi.string().valid("new", "contacted", "in progress", "converted", "lost").required(),
  notes: Joi.string().allow("", null),
  changed_by: Joi.string().required(),
});

export default { ALLOWED_SUBURBS, createPublicBody, statusBody };