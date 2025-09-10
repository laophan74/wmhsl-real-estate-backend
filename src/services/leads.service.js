// src/services/leads.service.js
import { db } from "../config/firebase.js";
import crypto from "crypto";
import { computeScore } from "./scoring.service.js";

const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

// ===== PUBLIC FORM CREATE =====
export async function createLeadFromPublicForm(form, reqMeta) {
  const now = new Date();

  // 1) scoring + intent
  const scoring = computeScore({ interested: form.interested, timeframe: form.timeframe });
  const motivation_level = form.interested === "yes" ? "high" : "low";

  // 2) tracking
  const ip = (reqMeta.ip || "").split(",")[0].trim();
  const ip_hashed = ip ? "hash:" + sha256(ip) : "";
  const tracking = {
    source: (form.utm_source ? String(form.utm_source).toLowerCase() : "direct"),
    campaign_id: "",
    ad_id: "",
    utm_source: form.utm_source || "",
    utm_medium: form.utm_medium || "",
    utm_campaign: form.utm_campaign || "",
    ip_address: ip_hashed,
    user_agent: reqMeta.userAgent || "",
    referrer: reqMeta.referrer || "",
  };

  // 3) dedupe theo email + 4 số cuối phone + ngày
  const last4 = (form.phone.match(/\d/g) || []).slice(-4).join("");
  const dedupeKey = sha256(`${form.email.toLowerCase()}|${last4}|${now.toISOString().slice(0,10)}`);
  const dedupeRef = db().collection("leads_dedupe").doc(dedupeKey);
  const existed = await dedupeRef.get();
  if (existed.exists) {
    const { lead_id } = existed.data() || {};
    return { reused: true, lead_id };
  }

  // 4) assignment đơn giản (chọn agent đầu tiên). Bạn có thể thay bằng round-robin theo suburb.
  let assignedToRef = null;
  const agentsSnap = await db().collection("agents").limit(1).get();
  if (!agentsSnap.empty) assignedToRef = agentsSnap.docs[0].ref;

  // 5) build doc đúng schema (collections chữ thường)
  const leadDoc = {
    contact: {
      first_name: form.first_name.trim(),
      last_name:  form.last_name.trim(),
      email:      form.email.toLowerCase(),
      phone:      form.phone.trim(),
      preferred_contact: "both",
    },
    property: {
      property_id: null,
      address: "",
      suburb:  form.suburb || "",
      postcode:"",
      state:   "NSW",
      type:    "house",
      features: { bedrooms: 0, bathrooms: 0, car_spaces: 0, land_size: null },
    },
    intent: {
      timeframe: form.timeframe,
      reason:    "other",
      price_expectation: null,
      motivation_level,
      additional_notes: "",
    },
    scoring: {
      ...scoring,
      scored_at: now,
    },
    tracking,
    assignment: {
      assigned_to: assignedToRef,
      assigned_at: assignedToRef ? now : null,
      assignment_method: assignedToRef ? "automatic" : "manual",
      previous_assignments: [],
    },
    status: {
      current: "new",
      substatus: "",
      history: [{ status: "new", changed_at: now, changed_by: "system", notes: "Lead from homepage form" }],
    },
    engagement: {
      last_contacted: null,
      contact_count: 0,
      last_activity: now,
      response_time: null,
      emails_sent: 0,
      emails_opened: 0,
      links_clicked: 0,
    },
    metadata: {
      created_at: now,
      updated_at: now,
      deleted_at: null,
      version: 1,
      tags: [form.suburb || ""].filter(Boolean),
      custom_fields: {},
    },
  };

  // 6) write
  const ref = await db().collection("leads").add(leadDoc);
  await ref.update({ lead_id: ref.id });
  await dedupeRef.set({ lead_id: ref.id, created_at: now });

  // 7) notification nếu HOT
  if (scoring.category === "HOT" && assignedToRef) {
    await db().collection("notifications").add({
      notification_id: null,
      lead_id: ref,
      recipient: { type: "agent", id: assignedToRef.id, email: null },
      notification: { type: "hot_lead", priority: "high", subject: "New HOT lead", body: "", template_used: "hot-lead-v1" },
      delivery: { channel: "in_app", sent_at: now, delivered_at: null, opened_at: null, clicked_at: null, status: "sent" },
      tracking: { attempts: 1, last_attempt: now, error_message: "", bounce_reason: "" },
      metadata: { created_at: now, created_by: "system", expires_at: null },
    });
  }

  return { reused: false, lead_id: ref.id, category: scoring.category, assigned_to: assignedToRef?.id || null };
}

// ===== LIST =====
export async function listLeads({ status, suburb, category, limit = 20, offset = 0, q }) {
  let ref = db().collection("leads");
  if (status)  ref = ref.where("status.current", "==", status);
  if (suburb)  ref = ref.where("property.suburb", "==", suburb);
  if (category)ref = ref.where("scoring.category", "==", category);
  ref = ref.orderBy("metadata.created_at", "desc").limit(limit);
  const snap = await ref.get();
  const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return items.slice(offset);
}

// ===== GET BY ID =====
export async function getLeadById(id) {
  const doc = await db().collection("leads").doc(id).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

// ===== UPDATE STATUS =====
export async function updateLeadStatus(id, { status, notes, changed_by }) {
  const ref = db().collection("leads").doc(id);
  const now = new Date();
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      const e = new Error("Lead not found");
      e.status = 404;
      throw e;
    }
    const data = snap.data();
    const history = Array.isArray(data.status?.history) ? data.status.history : [];
    history.push({ status, changed_at: now, changed_by, notes: notes || "" });
    tx.update(ref, {
      "status.current": status,
      "status.history": history,
      "metadata.updated_at": now,
    });
  });
  const updated = await ref.get();
  return { id: updated.id, ...updated.data() };
}

// ===== SOFT DELETE =====
export async function softDeleteLead(id) {
  const ref = db().collection("leads").doc(id);
  const now = new Date();
  await ref.set({ metadata: { deleted_at: now, updated_at: now } }, { merge: true });
  const snap = await ref.get();
  return { id: snap.id, ...snap.data() };
}
