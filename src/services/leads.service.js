import { db } from "../config/firebase.js";
import crypto from "crypto";
import { computeScore } from "./scoring.service.js";
import { sendEmail } from "../utils/email.js";

const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

// ===== PUBLIC FORM CREATE =====
export async function createLeadFromPublicForm(form, reqMeta) {
  const now = new Date();

  // 1) scoring - computeScore returns total_score and category
  const scoring = computeScore({ interested: form.interested, timeframe: form.timeframe });
  const score = scoring.total_score || 0;

  // 2) dedupe
  const last4 = (form.phone.match(/\d/g) || []).slice(-4).join("");
  const dedupeKey = sha256(`${form.email.toLowerCase()}|${last4}|${now.toISOString().slice(0,10)}`);
  const dedupeRef = db().collection("leads_dedupe").doc(dedupeKey);
  const existed = await dedupeRef.get();
  if (existed.exists) {
    const { lead_id } = existed.data() || {};
    return { reused: true, lead_id };
  }

  // 3) build canonical lead doc that matches requested schema
  const leadDoc = {
    // lead_id will be set to doc id after write
    lead_id: null,
    contact: {
      first_name: (form.first_name || "").trim(),
      last_name: (form.last_name || "").trim(),
      email: (form.email || "").toLowerCase(),
      phone: (form.phone || "").trim(),
      preferred_contact: form.preferred_contact || "both",
      suburb: form.suburb,
      timeframe: form.timeframe || "not sure",
      score: Number.isFinite(score) ? score : 0,
    },
    status: {
      current: "new",
      history: [
        {
          status: "new",
          changed_at: now,
          changed_by: reqMeta?.userId || "system",
          notes: "Lead from homepage form",
        },
      ],
    },
    metadata: {
      created_at: now,
      updated_at: now,
      deleted_at: null,
      version: 1,
      tags: [form.suburb].filter(Boolean),
      custom_fields: {},
    },
  };

  // write using a generated doc (so id is known)
  const ref = db().collection("leads").doc();
  await ref.set(leadDoc);
  // set lead_id to the doc id and update the doc
  await ref.update({ lead_id: ref.id });
  await dedupeRef.set({ lead_id: ref.id, created_at: now });

  // attempt to send emails (non-blocking for lead creation)
  const submitterEmail = leadDoc.contact.email;
  const agentEmail = process.env.AGENT_EMAIL || "Pcpps2507@gmail.com";

  (async () => {
    try {
      // confirmation to submitter
      await sendEmail({
        to: submitterEmail,
        subject: "We received your request",
        text: `Thanks ${leadDoc.contact.first_name}, we received your request and an agent will contact you soon. Lead ID: ${ref.id}`,
        html: `<p>Hi ${leadDoc.contact.first_name},</p><p>Thanks — we've received your request. An agent will contact you soon.</p><p>Lead ID: ${ref.id}</p>`,
      });

      // notification to agent
      await sendEmail({
        to: agentEmail,
        subject: `New lead submitted: ${leadDoc.contact.first_name} ${leadDoc.contact.last_name}`,
        text: `A new lead was submitted. Lead ID: ${ref.id} Email: ${submitterEmail} Phone: ${leadDoc.contact.phone}`,
        html: `<p>A new lead was submitted.</p><p><strong>Lead ID:</strong> ${ref.id}</p><p><strong>Name:</strong> ${leadDoc.contact.first_name} ${leadDoc.contact.last_name}</p><p><strong>Email:</strong> ${submitterEmail}</p><p><strong>Phone:</strong> ${leadDoc.contact.phone}</p>`,
      });
    } catch (err) {
      // log but don't throw
      console.error("Error sending lead emails", err?.message || err);
    }
  })();

  return { reused: false, lead_id: ref.id, score };
}

// ===== LIST =====
export async function listLeads({ status, suburb, limit = 20, offset = 0, q }) {
  let ref = db().collection("leads");
  if (status)  ref = ref.where("status.current", "==", status);
  if (suburb)  ref = ref.where("contact.suburb", "==", suburb);
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