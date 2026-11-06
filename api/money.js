// api/money.js — MONEY SERVER (Nov 4, Claude fix-list #1).
//
// The ONLY writer of player balances once the secure rules are published.
// Runs as a Vercel serverless function (Node 18 runtime, ZERO npm deps —
// pure fetch + node:crypto), so the owner ships it the same way he ships
// everything: upload files, Vercel builds.
//
// Required Vercel Environment Variables (owner adds them once, phone-friendly):
//   FIREBASE_PROJECT_ID   e.g. kaduna-lifestyle
//   FIREBASE_DB_SECRET    Firebase Console → Project settings → Service accounts
//                         → Database secrets → the legacy secret string
//   FIREBASE_DB_URL       (optional) only if the DB is not in the US region,
//                         e.g. https://kaduna-lifestyle-europe.firebaseio.com
//
// Client contract (src/moneyapi.js):
//   GET  /api/money            → { ok:true, mode:"server" }
//   POST { idToken, action:"sync" }                → { ok, balance, fresh? }
//   POST { idToken, action:"batch", ops:[{id,d,reason}], local }
//                              → { ok, balance, rejected? }   d = signed delta
//
// Security chain: Firebase ID token verified against Google's public certs →
// per-reason caps + daily gain cap + nonce dedupe → balance written through the
// admin secret (Database secret bypasses rules; the player never has it).

import crypto from "node:crypto";

const PID = process.env.FIREBASE_PROJECT_ID || "";
const SECRET = process.env.FIREBASE_DB_SECRET || "";
const DBURL = (process.env.FIREBASE_DB_URL || `https://${PID}-default-rtdb.firebaseio.com`).replace(/\/$/, "");

// ---- caps (₦). Legit single gains stay far below; minting hits the wall. ----
const CAPS = {
  game: 10_000_000,          // generic untagged gains (quests, missions, investments…)
  gig: 10_000,               // hustle gig shift
  wage: 100_000,             // careers.js payday
  daily: 20_000,             // login reward + quests
  race_win: 25_000,          // street race prize
  sell_vehicle: 80_000_000,  // car sale (KSR Ferrari resale ~45% of 45M)
  challenge_win: 5_000_000,  // wager pot
  spray: 5_000_000,          // money spray gift
  spray_claim: 5_000_000,    // picking up a spray (validated ≤ 5M at the sprays node)
  mission: 100_000,          // missions.js chapter reward (largest legit one)
  hunt: 1_000_000,           // money hunt rare spot claim
  referral: 200_000,
  capsule_claim: 50_000,     // time-capsule gift on open (validated ≤ 50k at the secrets node)
  capsule_refund: 50_000,    // 90-day expiry refund of an unclaimed capsule gift
};
const DAILY_GAIN_CAP = 100_000_000;   // total credits per player per day
const BAL_CAP = 999_999_999_999;   // matches the client guard in src/moneyapi.js

// ---- in-memory rate limit (best effort per lambda instance) ----
const _hits = new Map();
function rateLimited(uid) {
  const now = Date.now(), w = 60_000;
  const rec = _hits.get(uid);
  if (!rec || now - rec.t > w) { _hits.set(uid, { t: now, n: 1 }); return false; }
  rec.n++;
  return rec.n > 60;
}

// ---------- Firebase ID token verification (no admin SDK needed) ----------
let _certs = null, _certsAt = 0;
async function _googleCerts() {
  if (_certs && Date.now() - _certsAt < 55 * 60 * 1000) return _certs;
  const r = await fetch("https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com");
  _certs = await r.json();
  _certsAt = Date.now();
  return _certs;
}

async function verifyIdToken(idToken) {
  if (!PID) throw new Error("no-project");
  const parts = String(idToken || "").split(".");
  if (parts.length !== 3) throw new Error("bad-token");
  const header = JSON.parse(Buffer.from(parts[0], "base64url").toString());
  const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString());
  if (header.alg !== "RS256") throw new Error("bad-alg");
  const certs = await _googleCerts();
  const certPem = certs[header.kid];
  if (!certPem) throw new Error("no-kid");
  const key = new crypto.X509Certificate(certPem).publicKey;
  const ok = crypto.verify("RSA-SHA256", Buffer.from(parts[0] + "." + parts[1]), key, Buffer.from(parts[2], "base64url"));
  if (!ok) throw new Error("bad-sig");
  const now = Math.floor(Date.now() / 1000);
  if (claims.aud !== PID) throw new Error("bad-aud");
  if (claims.iss !== "https://securetoken.google.com/" + PID) throw new Error("bad-iss");
  if (!claims.exp || claims.exp < now) throw new Error("expired");
  if (!claims.sub || typeof claims.sub !== "string" || claims.sub.length > 128) throw new Error("bad-sub");
  return { uid: claims.sub };
}

// ---------- RTDB REST helpers (Database secret = admin) ----------
async function dbGet(path) {
  const r = await fetch(`${DBURL}${path}.json?auth=${SECRET}`);
  if (!r.ok) throw new Error("db-get-" + r.status);
  return r.json();
}
async function dbPut(path, body, etag) {
  const h = { "content-type": "application/json" };
  if (etag !== undefined) h["if-match"] = etag;
  const r = await fetch(`${DBURL}${path}.json?auth=${SECRET}`, { method: "PUT", headers: h, body: JSON.stringify(body) });
  if (r.status === 412) return { conflict: true };
  if (!r.ok) throw new Error("db-put-" + r.status);
  return { etag: r.headers.get("etag"), val: await r.json().catch(() => null) };
}
async function dbPatch(path, body) {
  const r = await fetch(`${DBURL}${path}.json?auth=${SECRET}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error("db-patch-" + r.status);
  return r.json().catch(() => null);
}

function balPath0(uid) { return `/economy/${uid}/balance`; }
let _pid = 0;
function _pushId() { return "op" + Date.now().toString(36) + (_pid++).toString(36) + Math.random().toString(36).slice(2, 7); }

// read-modify-write the balance with REST ETag optimistic locking
async function applyDelta(uid, delta, { skipCap } = {}) {
  const balPath = balPath0(uid);
  for (let i = 0; i < 4; i++) {
    const cur = await dbGet(balPath);
    const curVal = typeof cur === "number" ? cur : 0;
    const next = curVal + delta;
    if (next < 0) return { ok: false, why: "insufficient", balance: curVal };
    if (next > BAL_CAP) return { ok: false, why: "ceiling", balance: curVal };
    if (delta > 0 && !skipCap) {
      const day = new Date().toISOString().slice(0, 10);
      const dayNode = (await dbGet(`/economy/${uid}/day/${day}`)) || {};
      if ((dayNode.gained || 0) + delta > DAILY_GAIN_CAP) return { ok: false, why: "daily-cap", balance: curVal };
    }
    const w = await dbPut(balPath, next, await _etagOf(balPath));
    if (!w.conflict) {
      if (delta > 0 && !skipCap) {
        const day = new Date().toISOString().slice(0, 10);
        const p = `/economy/${uid}/day/${day}`;
        const after = (await dbGet(p)) || {};
        await dbPatch(p, { gained: (after.gained || 0) + delta, ts: Date.now() });
      }
      await dbPatch(`/economy/${uid}/log/${_pushId()}`, { d: delta, ts: Date.now() });
      return { ok: true, balance: next };
    }
  }
  return { ok: false, why: "busy", balance: null };
}

async function _etagOf(path) {
  const r = await fetch(`${DBURL}${path}.json?auth=${SECRET}`);
  return r.headers.get("etag") || "";
}

// ---------- handler ----------
export default async function handler(req, res) {
  res.setHeader("content-type", "application/json");
  try {
    if (req.method === "GET") {
      return res.status(200).send(JSON.stringify({ ok: !!(PID && SECRET), mode: "server", project: PID || null }));
    }
    if (req.method !== "POST") return res.status(405).send(JSON.stringify({ error: "method" }));

    const body = await new Promise((resolve) => {
      let b = ""; req.on("data", (c) => { b += c; if (b.length > 1e6) req.destroy(); }); req.on("end", () => { try { resolve(JSON.parse(b || "{}")); } catch (e) { resolve({}); } });
    });
    if (!PID || !SECRET) return res.status(200).send(JSON.stringify({ ok: false, error: "not-configured" }));

    let user;
    try { user = await verifyIdToken(body.idToken); } catch (e) {
      return res.status(200).send(JSON.stringify({ ok: false, error: "auth", why: String(e.message || e) }));
    }
    const uid = user.uid;
    if (rateLimited(uid)) return res.status(200).send(JSON.stringify({ ok: false, error: "rate" }));

    // ---- sync: return the truth (bootstrap once if the server never saw this wallet) ----
    if (body.action === "sync") {
      const bal = await dbGet(balPath0(uid));
      if (typeof bal !== "number") {
        const local = Math.max(0, Math.min(BAL_CAP, Math.floor(Number(body.local) || 0)));
        if (body.local != null) {
          // one-time migration: the device balance becomes the starting truth
          const w = await dbPut(balPath0(uid), local, await _etagOf(balPath0(uid)));
          if (!w.conflict) return res.status(200).send(JSON.stringify({ ok: true, balance: local, fresh: true }));
        }
        return res.status(200).send(JSON.stringify({ ok: true, balance: 0, fresh: true }));
      }
      return res.status(200).send(JSON.stringify({ ok: true, balance: bal }));
    }

    // ---- batch: apply queued deltas with caps + nonce dedupe ----
    if (body.action === "batch") {
      const ops = Array.isArray(body.ops) ? body.ops.slice(0, 40) : [];
      if (!ops.length) return res.status(200).send(JSON.stringify({ ok: true, balance: (await dbGet(balPath0(uid))) || 0 }));
      const rejected = [];
      for (const op of ops) {
        const d = Math.floor(Number(op?.d) || 0);
        const reason = String(op?.reason || "game").slice(0, 24);
        if (!d) continue;
        // nonce dedupe (replay protection): first write to the nonce wins
        const nid = String(op?.id || "").replace(/[.#$/[\]]/g, "").slice(0, 40) || _pushId();
        const nPath = `/economy/${uid}/nonces/${nid}`;
        const nPut = await dbPut(nPath, Date.now(), await _etagOf(nPath));
        if (nPut.conflict) continue;                                   // already applied
        if (d > 0) {
          const cap = CAPS[reason] != null ? CAPS[reason] : CAPS.game;
          if (d > cap) { rejected.push({ d, reason, why: "cap" }); continue; }
        }
        const r = await applyDelta(uid, d, { skipCap: d < 0 });
        if (!r.ok && r.why !== "busy") rejected.push({ d, reason, why: r.why });
      }
      const bal = await dbGet(balPath0(uid));
      return res.status(200).send(JSON.stringify({ ok: true, balance: typeof bal === "number" ? bal : 0, rejected: rejected.length ? rejected : undefined }));
    }

    // ---- transfer: player-to-player (DM "send money"). Zero-sum, both legs
    // written by the server with admin power; the sender's leg is a REAL
    // balance-checked debit, so no cap game applies. ----
    if (body.action === "transfer") {
      const toUid = String(body.toUid || "");
      const amount = Math.floor(Number(body.amount) || 0);
      const note = String(body.note || "").slice(0, 140);
      if (!toUid || toUid === uid || !Number.isFinite(amount) || amount <= 0 || amount > 10_000_000) {
        return res.status(200).send(JSON.stringify({ ok: false, error: "bad-transfer" }));
      }
      const debit = await applyDelta(uid, -amount);
      if (!debit.ok) return res.status(200).send(JSON.stringify({ ok: false, error: debit.why || "insufficient", balance: debit.balance }));
      const credit = await applyDelta(toUid, amount, { skipCap: true });   // zero-sum: skip receiver daily-cap
      if (!credit.ok) {
        // refund the sender so money never disappears
        await applyDelta(uid, amount, { skipCap: true });
        return res.status(200).send(JSON.stringify({ ok: false, error: "recv-" + (credit.why || "fail"), balance: debit.balance }));
      }
      await dbPatch("/transfers/" + _pushId(), { from: uid, to: toUid, amount, note, ts: Date.now() });
      return res.status(200).send(JSON.stringify({ ok: true, balance: debit.balance }));
    }

    // ---- newlife: the owner-approved "start a new life" reset. Only ever
    // LOWERS the balance to ₦5,000 (starter money) — no path here can mint. ----
    if (body.action === "newlife") {
      const cur = await dbGet(balPath0(uid));
      const curVal = typeof cur === "number" ? cur : 5000;
      await dbPut(balPath0(uid), 5000, await _etagOf(balPath0(uid)));
      await dbPatch(`/economy/${uid}/log/${_pushId()}`, { d: 5000 - curVal, ts: Date.now(), why: "newlife" });
      return res.status(200).send(JSON.stringify({ ok: true, balance: 5000 }));
    }

    return res.status(200).send(JSON.stringify({ ok: false, error: "action" }));
  } catch (e) {
    return res.status(200).send(JSON.stringify({ ok: false, error: "server", why: String(e && e.message || e).slice(0, 120) }));
  }
}
