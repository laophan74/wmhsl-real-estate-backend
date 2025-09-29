import { db } from "../config/firebase.js";
import crypto from "crypto";
import { computeScore } from "./scoring.service.js";
import { sendMail } from "../utils/mailer.js";

const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

// ===== PUBLIC FORM CREATE =====
export async function createLeadFromPublicForm(form, reqMeta) {
  const now = new Date();

  // Normalize selling interest (frontend sends 'interested' as "yes"/"no")
  const sellingRaw = form.interested || "no";
  const sellingInterestBool = String(sellingRaw).toLowerCase() === "yes";

  // Normalize buying interest (accept either 'interested_buying' or 'buying')
  const buyingRaw = form.interested_buying || form.buying || "no";
  const buyingInterestBool = String(buyingRaw).toLowerCase() === "yes";

  // 1) scoring - allow computeScore to take buying/selling boolean if desired
  // Update computeScore signature if you plan to use `buying`/`selling` booleans there.
  const scoring = computeScore({
    // provide both forms (booleans) — adjust computeScore implementation to consume appropriately
    interested: sellingInterestBool,
    timeframe: form.timeframe,
    buying: buyingInterestBool,
  });
  const score = scoring.total_score || 0;

  // 2) dedupe
  const last4 = (form.phone.match(/\d/g) || []).slice(-4).join("");
  const dedupeKey = sha256(`${form.email.toLowerCase()}|${last4}|${now.toISOString().slice(0, 10)}`);
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
      // NEW: store selling and buying interest as booleans for easy querying
      selling_interest: sellingInterestBool,
      buying_interest: buyingInterestBool,
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
      custom_fields: {
        // Mirror custom fields for flexible reporting / UI
        selling_interest: sellingInterestBool,
        buying_interest: buyingInterestBool,
      },
    },
  };

  // write using a generated doc (so id is known)
  const ref = db().collection("leads").doc();
  await ref.set(leadDoc);
  // set lead_id to the doc id and update the doc
  await ref.update({ lead_id: ref.id });
  await dedupeRef.set({ lead_id: ref.id, created_at: now });

  // Send confirmation to submitter and notification to agent (best-effort, non-fatal)
  (async () => {
    try {
  const submitterEmail = leadDoc.contact.email;
  const brand = process.env.BRAND_NAME || 'Stone Real Estate';
  // Admin email can be overridden by ADMIN_EMAIL, fallback to AGENT_EMAIL or default address
  const adminEmail = process.env.ADMIN_EMAIL || process.env.AGENT_EMAIL || "Pcpps2507@gmail.com";
  // Force sender to the admin address unless SENDER_EMAIL env explicitly set
  const defaultSender = process.env.SENDER_EMAIL || adminEmail;

      // 1) Thank-you email to the customer (from admin address -> to submitter)
      if (submitterEmail) {
        console.log('[mailer] about to send thank-you to submitter', { to: submitterEmail });
        await sendMail({
          to: submitterEmail,
          from: defaultSender,
          subject: `Thanks for your enquiry — we received your lead (${ref.id})`,
          text: `Hi ${leadDoc.contact.first_name || ''},\n\nThanks for your enquiry. Our team at ${brand} will contact you shortly. Reference: ${ref.id}\n\nRegards,\n${brand}`,
          html: `<p>Hi ${leadDoc.contact.first_name || ''},</p><p>Thanks for your enquiry. Our team at <strong>${brand}</strong> will contact you shortly.</p><p>Reference: <strong>${ref.id}</strong></p><p>Regards,<br/>${brand}</p>`,
        });
      }

      // 2) Notification to admin (from admin -> to admin)
      if (adminEmail) {
        // ensure admin receives a short summary and the raw form
        const adminFrom = adminEmail; // send as admin
        const adminSubject = `New lead received: ${leadDoc.contact.first_name} ${leadDoc.contact.last_name} (${ref.id})`;
        const adminText = `New lead ${ref.id} created.\n\nName: ${leadDoc.contact.first_name} ${leadDoc.contact.last_name}\nEmail: ${leadDoc.contact.email}\nPhone: ${leadDoc.contact.phone}\nSuburb: ${leadDoc.contact.suburb}\nTimeframe: ${leadDoc.contact.timeframe}\nSelling interest: ${leadDoc.contact.selling_interest}\nBuying interest: ${leadDoc.contact.buying_interest}\n\nView in Firestore with ID: ${ref.id}`;

        console.log('[mailer] about to send admin notification', { to: agentEmail });
        await sendMail({
          to: adminEmail,
          from: adminFrom,
          subject: adminSubject,
          text: adminText,
          html: `<p>New lead <strong>${ref.id}</strong> created.</p><ul><li>Name: ${leadDoc.contact.first_name} ${leadDoc.contact.last_name}</li><li>Email: ${leadDoc.contact.email}</li><li>Phone: ${leadDoc.contact.phone}</li><li>Suburb: ${leadDoc.contact.suburb}</li><li>Timeframe: ${leadDoc.contact.timeframe}</li><li>Selling interest: ${leadDoc.contact.selling_interest}</li><li>Buying interest: ${leadDoc.contact.buying_interest}</li></ul>`,
        });
      }
    } catch (err) {
      console.warn('Error sending notification emails:', err?.message || err);
    }
  })();

  return { reused: false, lead_id: ref.id, score };
}

// ===== LIST =====
export async function listLeads({ status, suburb, limit = 20, offset = 0, q }) {
  let ref = db().collection("leads");
  if (status) ref = ref.where("status.current", "==", status);
  if (suburb) ref = ref.where("contact.suburb", "==", suburb);
  ref = ref.orderBy("metadata.created_at", "desc").limit(limit);
  const snap = await ref.get();
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
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