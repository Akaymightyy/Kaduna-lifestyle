// src/admin.js — Admin dashboard logic (secure, mobile-friendly)
import { auth, db } from "./firebase.js";
import { ref, onValue, set, update, get, remove, push } from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";

// Real admin credentials provided by the owner
//   Email: admin@kaduna.com
//   UID:   6U87PzWq0dU8qwZeXJo7ySLxOFo1
const ADMIN_UIDS = ["6U87PzWq0dU8qwZeXJo7ySLxOFo1"];
const ADMIN_EMAILS = ["admin@kaduna.com"];

let _isAdmin = false;
let _adminUser = null;

export function initAdmin(onAdmin) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) { _isAdmin = false; _adminUser = null; return; }
    const isHardcodedAdmin =
      ADMIN_UIDS.includes(user.uid) ||
      (user.email && ADMIN_EMAILS.includes(user.email.toLowerCase()));

    // Also check the dynamic /admins/{uid} node
    const adminRef = ref(db, "admins/" + user.uid);
    const snap = await get(adminRef);
    const isDbAdmin = snap.val() === true;

    const wasAdmin = _isAdmin;
    _isAdmin = isHardcodedAdmin || isDbAdmin;
    _adminUser = _isAdmin ? user : null;

    // If we're an admin via hardcoded UID/email, ensure /admins/{uid}=true is seeded
    // so that any client-side check (or future rules) can rely on it.
    if (isHardcodedAdmin && !isDbAdmin) {
      try { await set(adminRef, true); } catch (_) {}
    }
    // Also seed profile so admin shows up in player lists with their proper name
    if (isHardcodedAdmin) {
      try {
        const adminName = user.displayName || (user.email ? user.email.split("@")[0] : "Admin");
        await update(ref(db, "players/" + user.uid), { name: adminName, isAdmin: true });
      } catch (_) {}
    }

    if (_isAdmin && !wasAdmin) onAdmin?.(user);
    // Update UI: show/hide admin HUD button
    const hudBtn = document.getElementById("admin-hud-btn");
    if (hudBtn) hudBtn.style.display = _isAdmin ? "flex" : "none";
  });
}

export function isAdmin() { return _isAdmin; }
export function getAdminUser() { return _adminUser; }

export function showAdminDashboard() {
  const modal = document.getElementById("admin-modal");
  if (!modal) return;
  if (!_isAdmin) { toast("Admin access required"); return; }
  modal.classList.add("show");
  // Reset to overview
  document.querySelectorAll(".admin-tab").forEach(t => t.classList.remove("active"));
  document.querySelector('.admin-tab[data-tab="overview"]')?.classList.add("active");
  document.querySelectorAll(".admin-panel").forEach(p => p.style.display = "none");
  const ov = document.getElementById("admin-overview");
  if (ov) ov.style.display = "block";
  loadAdminOverview();
}

export function hideAdminDashboard() {
  const modal = document.getElementById("admin-modal");
  if (modal) modal.classList.remove("show");
}

// ---- Tab switching ----
export function adminTab(tab) {
  if (!_isAdmin) return;
  document.querySelectorAll(".admin-tab").forEach(t => t.classList.remove("active"));
  document.querySelector(`.admin-tab[data-tab="${tab}"]`)?.classList.add("active");
  document.querySelectorAll(".admin-panel").forEach(p => p.style.display = "none");
  const panel = document.getElementById("admin-" + tab);
  if (panel) panel.style.display = "block";
  if (tab === "overview") loadAdminOverview();
  if (tab === "players") loadAdminPlayers();
  if (tab === "economy") loadAdminEconomy();
  if (tab === "chat") loadAdminChat();
  if (tab === "announce") loadAdminAnnounce();
  if (tab === "live") loadAdminLive();
  if (tab === "events") loadAdminEvents();
  if (tab === "analytics") loadAdminAnalytics();
}

// ---- Overview ----
function loadAdminOverview() {
  const panel = document.getElementById("admin-overview");
  if (!panel) return;
  panel.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:14px;">
      <div style="background:#16213e;border-radius:12px;padding:14px;text-align:center;">
        <div id="admin-online-count" style="font-size:28px;font-weight:800;color:#4ade80;">…</div>
        <div style="font-size:11px;color:#9ca3af;">Online Now</div>
      </div>
      <div style="background:#16213e;border-radius:12px;padding:14px;text-align:center;">
        <div id="admin-total-money" style="font-size:28px;font-weight:800;color:#fbbf24;">…</div>
        <div style="font-size:11px;color:#9ca3af;">Money in Economy</div>
      </div>
      <div style="background:#16213e;border-radius:12px;padding:14px;text-align:center;">
        <div id="admin-total-players" style="font-size:28px;font-weight:800;color:#60a5fa;">…</div>
        <div style="font-size:11px;color:#9ca3af;">Total Players</div>
      </div>
      <div style="background:#16213e;border-radius:12px;padding:14px;text-align:center;">
        <div id="admin-msgs-today" style="font-size:28px;font-weight:800;color:#f472b6;">…</div>
        <div style="font-size:11px;color:#9ca3af;">Messages Today</div>
      </div>
    </div>
    <div style="background:#16213e;border-radius:12px;padding:14px;margin-bottom:14px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <span style="font-size:13px;font-weight:600;">Online Players</span>
        <span id="admin-online-list-count" style="font-size:11px;color:#9ca3af;"></span>
      </div>
      <div id="admin-player-list" style="font-size:12px;max-height:240px;overflow-y:auto;"></div>
    </div>
    <div style="background:#16213e;border-radius:12px;padding:14px;">
      <div style="font-size:13px;font-weight:600;margin-bottom:8px;">Latest Announcements</div>
      <div id="admin-recent-announcements" style="font-size:12px;max-height:160px;overflow-y:auto;color:#9ca3af;"></div>
    </div>`;

  // Online players + total players
  onValue(ref(db, "players"), (snap) => {
    const players = snap.val() || {};
    const online = Object.entries(players).filter(([uid,p]) => {
      const age = Date.now() - (p.ts || 0);
      return age < 60000 && !p.banned; // active in last 60s
    });
    const totalEl = document.getElementById("admin-total-players");
    if (totalEl) totalEl.textContent = Object.keys(players).length;
    const onlineEl = document.getElementById("admin-online-count");
    if (onlineEl) onlineEl.textContent = online.length;
    const cntEl = document.getElementById("admin-online-list-count");
    if (cntEl) cntEl.textContent = `${online.length} active`;
    const listEl = document.getElementById("admin-player-list");
    if (listEl) {
      listEl.innerHTML = online.length
        ? online.map(([uid,p]) => `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #1f2937;"><span>${p.name||"Unknown"}${p.isAdmin?' 🔐':''}</span><span style="color:#9ca3af;">(${(p.x||0).toFixed(0)}, ${(p.z||0).toFixed(0)})${p.suspended?' · 🔇':''}</span></div>`).join("")
        : '<div style="color:#6b7280;padding:8px;">No players online right now.</div>';
    }
  });

  // Total money
  onValue(ref(db, "economy"), (snap) => {
    const data = snap.val() || {};
    const total = Object.values(data).reduce((sum, d) => sum + (d.balance || 0), 0);
    const el = document.getElementById("admin-total-money");
    if (el) el.textContent = "₦" + total.toLocaleString();
  });

  // Messages today
  onValue(ref(db, "chat"), (snap) => {
    const data = snap.val() || {};
    const today = new Date().toISOString().slice(0, 10);
    const todayCount = Object.values(data).filter(m => new Date(m.ts || 0).toISOString().slice(0, 10) === today).length;
    const el = document.getElementById("admin-msgs-today");
    if (el) el.textContent = todayCount;
  });

  // Recent announcements
  onValue(ref(db, "announcements"), (snap) => {
    const data = snap.val() || {};
    const list = Object.entries(data).sort(([,a],[,b]) => (b.ts||0)-(a.ts||0)).slice(0, 5);
    const el = document.getElementById("admin-recent-announcements");
    if (el) {
      el.innerHTML = list.length
        ? list.map(([k,a]) => `<div style="padding:4px 0;border-bottom:1px solid #1f2937;">${a.text}<div style="font-size:10px;color:#6b7280;">${new Date(a.ts).toLocaleString()}</div></div>`).join("")
        : "No announcements yet.";
    }
  });
}

// ---- Players ----
function loadAdminPlayers() {
  const panel = document.getElementById("admin-players");
  if (!panel) return;
  panel.innerHTML = `
    <div style="margin-bottom:12px;">
      <input id="admin-search" type="text" placeholder="Search by name or UID..." style="width:100%;padding:10px 12px;background:#16213e;border:1px solid #1f2937;color:#fff;border-radius:8px;font-family:inherit;font-size:13px;" oninput="window.adminSearchPlayers(this.value)" />
    </div>
    <div style="display:flex;gap:8px;margin-bottom:12px;font-size:11px;">
      <button onclick="window.adminSortBy('name')" style="background:#16213e;color:#9ca3af;border:1px solid #1f2937;border-radius:6px;padding:4px 10px;cursor:pointer;">Sort: Name</button>
      <button onclick="window.adminSortBy('money')" style="background:#16213e;color:#9ca3af;border:1px solid #1f2937;border-radius:6px;padding:4px 10px;cursor:pointer;">Sort: Money</button>
      <button onclick="window.adminSortBy('recent')" style="background:#16213e;color:#9ca3af;border:1px solid #1f2937;border-radius:6px;padding:4px 10px;cursor:pointer;">Sort: Recent</button>
    </div>
    <div id="admin-search-results" style="font-size:12px;max-height:400px;overflow-y:auto;color:#9ca3af;">Loading players…</div>`;

  // Subscribe to both players and economy in one go for richer rendering
  let _playersCache = {}, _economyCache = {};
  const tryRender = () => {
    window._adminPlayersCache = _playersCache;
    window._adminEconomyCache = _economyCache;
    renderPlayerList(_playersCache);
  };
  onValue(ref(db, "players"), (snap) => { _playersCache = snap.val() || {}; tryRender(); });
  onValue(ref(db, "economy"), (snap) => { _economyCache = snap.val() || {}; tryRender(); });
}

window.adminSearchPlayers = function(query) {
  const players = window._adminPlayersCache || {};
  if (!query) { renderPlayerList(players); return; }
  const q = query.toLowerCase();
  const filtered = {};
  for (const [uid, p] of Object.entries(players)) {
    if ((p.name || "").toLowerCase().includes(q) || uid.toLowerCase().includes(q)) {
      filtered[uid] = p;
    }
  }
  renderPlayerList(filtered);
};

window.adminSortBy = function(field) {
  const players = window._adminPlayersCache || {};
  const eco = window._adminEconomyCache || {};
  const sorted = Object.entries(players).sort(([ua,pa],[ub,pb]) => {
    if (field === "name") return (pa.name||"").localeCompare(pb.name||"");
    if (field === "money") return (eco[ub]?.balance||0) - (eco[ua]?.balance||0);
    if (field === "recent") return (pb.ts||0) - (pa.ts||0);
    return 0;
  });
  const obj = Object.fromEntries(sorted);
  renderPlayerList(obj);
};

function renderPlayerList(players) {
  const el = document.getElementById("admin-search-results");
  if (!el) return;
  const eco = window._adminEconomyCache || {};
  const entries = Object.entries(players);
  el.innerHTML = entries.length ? entries.map(([uid, p]) => {
    const bal = eco[uid]?.balance || 0;
    const isMe = _adminUser && uid === _adminUser.uid;
    return `
    <div style="display:flex;align-items:center;gap:8px;padding:8px;background:#16213e;border-radius:8px;margin-bottom:6px;">
      <div style="flex:1;">
        <div style="font-weight:600;color:#fff;">${p.name||"Unknown"}${p.isAdmin?' 🔐':''}${isMe?' (you)':''}</div>
        <div style="font-size:10px;color:#6b7280;">UID: ${uid.slice(0,16)}… · ₦${bal.toLocaleString()}${p.suspended?' · 🔇 SUSPENDED':''}${p.banned?' · ⛔ BANNED':''}</div>
      </div>
      <button onclick="window.adminEditPlayer('${uid}')" style="background:#374151;color:#fff;border:none;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:11px;">Edit</button>
      ${p.banned
        ? `<button onclick="window.adminUnbanPlayer('${uid}')" style="background:#16a34a;color:#fff;border:none;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:11px;">Unban</button>`
        : `<button onclick="window.adminBanPlayer('${uid}')" style="background:#e11d48;color:#fff;border:none;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:11px;">Ban</button>`}
    </div>`;
  }).join("") : '<div style="color:#6b7280;padding:12px;">No players found.</div>';
}

window.adminEditPlayer = async function(uid) {
  const balSnap = await get(ref(db, "economy/" + uid + "/balance"));
  const balance = balSnap.val() || 0;
  const nameSnap = await get(ref(db, "players/" + uid + "/name"));
  const name = nameSnap.val() || "Unknown";
  const choice = prompt(`Edit player: ${name}\nUID: ${uid}\nCurrent balance: ₦${balance.toLocaleString()}\n\nType new balance (just the number), or type "name:NEWNAME" to rename, or "kick" to disconnect:`, balance);
  if (choice === null) return;
  if (choice.startsWith("name:")) {
    const newName = choice.slice(5).trim();
    if (newName) {
      await update(ref(db, "players/" + uid), { name: newName });
      await update(ref(db, "economy/" + uid), { name: newName });
      alert("Player renamed to: " + newName);
    }
  } else if (choice === "kick") {
    await remove(ref(db, "players/" + uid));
    alert("Player disconnected.");
  } else {
    const newBal = parseInt(choice, 10);
    if (isNaN(newBal)) { alert("Invalid number"); return; }
    await set(ref(db, "economy/" + uid + "/balance"), newBal);
    alert("Balance updated to ₦" + newBal.toLocaleString());
  }
};

window.adminBanPlayer = async function(uid) {
  if (!confirm("Ban this player? They will be blocked from playing.")) return;
  await update(ref(db, "players/" + uid), { banned: true });
  alert("Player banned.");
};
window.adminUnbanPlayer = async function(uid) {
  if (!confirm("Unban this player?")) return;
  await update(ref(db, "players/" + uid), { banned: false });
  alert("Player unbanned.");
};

// ---- Economy ----
function loadAdminEconomy() {
  const panel = document.getElementById("admin-economy");
  if (!panel) return;
  panel.innerHTML = '<div style="color:#9ca3af;font-size:12px;">Loading economy data…</div>';
  onValue(ref(db, "economy"), (snap) => {
    const data = snap.val() || {};
    const list = Object.entries(data)
      .map(([uid, d]) => ({ uid, balance: d.balance || 0, name: d.name || "Unknown" }))
      .sort((a, b) => b.balance - a.balance);
    const total = list.reduce((s, p) => s + p.balance, 0);
    const avg = list.length ? Math.round(total / list.length) : 0;
    panel.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px;">
        <div style="background:#16213e;border-radius:12px;padding:12px;text-align:center;">
          <div style="font-size:20px;font-weight:800;color:#4ade80;">₦${total.toLocaleString()}</div>
          <div style="font-size:10px;color:#9ca3af;">Total</div>
        </div>
        <div style="background:#16213e;border-radius:12px;padding:12px;text-align:center;">
          <div style="font-size:20px;font-weight:800;color:#fbbf24;">${list.length}</div>
          <div style="font-size:10px;color:#9ca3af;">Wallets</div>
        </div>
        <div style="background:#16213e;border-radius:12px;padding:12px;text-align:center;">
          <div style="font-size:20px;font-weight:800;color:#60a5fa;">₦${avg.toLocaleString()}</div>
          <div style="font-size:10px;color:#9ca3af;">Average</div>
        </div>
      </div>
      <div style="font-size:13px;font-weight:600;margin-bottom:8px;color:#fff;">🏆 Richest Players (Top 20)</div>
      <div style="font-size:12px;max-height:300px;overflow-y:auto;">
        ${list.slice(0, 20).map((p, i) => `<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #1f2937;"><span style="color:#fff;"><b style="color:#9ca3af;">${i+1}.</b> ${p.name}</span><span style="font-weight:600;color:#4ade80;">₦${p.balance.toLocaleString()}</span></div>`).join("") || '<div style="color:#6b7280;">No data</div>'}
      </div>
      <div style="margin-top:14px;background:#16213e;border-radius:12px;padding:14px;">
        <div style="font-size:13px;font-weight:600;margin-bottom:8px;color:#fff;">💰 Money Operations</div>
        <input id="admin-mint-uid" type="text" placeholder="Player UID" style="width:100%;padding:8px;background:#0f172a;color:#fff;border:1px solid #1f2937;border-radius:6px;margin-bottom:6px;font-family:inherit;font-size:12px;" />
        <input id="admin-mint-amt" type="number" placeholder="Amount (negative to deduct)" style="width:100%;padding:8px;background:#0f172a;color:#fff;border:1px solid #1f2937;border-radius:6px;margin-bottom:8px;font-family:inherit;font-size:12px;" />
        <button onclick="window.adminMintMoney()" style="width:100%;background:#16a34a;color:#fff;border:none;border-radius:8px;padding:10px;cursor:pointer;font-size:13px;font-weight:600;">Mint / Deduct Money</button>
      </div>`;
  });
}

window.adminMintMoney = async function() {
  const uid = document.getElementById("admin-mint-uid")?.value?.trim();
  const amt = parseInt(document.getElementById("admin-mint-amt")?.value, 10);
  if (!uid || isNaN(amt)) { alert("Enter UID and amount"); return; }
  const balRef = ref(db, "economy/" + uid + "/balance");
  const snap = await get(balRef);
  const cur = snap.val() || 0;
  const next = cur + amt;
  if (next < 0) { alert("Result would be negative. Aborting."); return; }
  await set(balRef, next);
  // Log
  await push(ref(db, "economy/" + uid + "/log"), { amount: amt, reason: "admin-mint", ts: Date.now(), bal: next });
  alert(`Done. New balance for ${uid}: ₦${next.toLocaleString()}`);
  document.getElementById("admin-mint-uid").value = "";
  document.getElementById("admin-mint-amt").value = "";
};

// ---- Chat moderation ----
function loadAdminChat() {
  const panel = document.getElementById("admin-chat");
  if (!panel) return;
  panel.innerHTML = '<div style="color:#9ca3af;font-size:12px;">Loading recent chat…</div>';
  onValue(ref(db, "chat"), (snap) => {
    const data = snap.val() || {};
    const msgs = Object.entries(data).sort(([,a],[,b]) => (b.ts||0)-(a.ts||0)).slice(0, 50);
    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <span style="font-size:13px;font-weight:600;color:#fff;">Recent Messages</span>
        <button onclick="window.adminClearAllChat()" style="background:#e11d48;color:#fff;border:none;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:11px;">Clear All</button>
      </div>
      <div style="font-size:12px;max-height:420px;overflow-y:auto;">
        ${msgs.map(([key, m]) => `<div style="display:flex;align-items:flex-start;gap:6px;padding:7px;background:#16213e;border-radius:6px;margin-bottom:4px;">
          <div style="flex:1;color:#fff;"><b style="color:#fbbf24;">${m.name}:</b> ${escapeHtml(m.text)}<div style="font-size:10px;color:#6b7280;margin-top:2px;">${new Date(m.ts||0).toLocaleString()} · ${m.uid?.slice(0,10)}…</div></div>
          <button onclick="window.adminDeleteMsg('${key}')" style="background:#e11d48;color:#fff;border:none;border-radius:4px;padding:2px 8px;cursor:pointer;font-size:10px;">Delete</button>
        </div>`).join("") || '<div style="color:#6b7280;">No messages yet.</div>'}
      </div>`;
  });
}

function escapeHtml(s) {
  return String(s||"").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
}

window.adminDeleteMsg = async function(key) {
  await remove(ref(db, "chat/" + key));
};
window.adminClearAllChat = async function() {
  if (!confirm("Clear ALL chat messages? This cannot be undone.")) return;
  await remove(ref(db, "chat"));
  alert("Chat cleared.");
};

// ---- Announcements ----
function loadAdminAnnounce() {
  const panel = document.getElementById("admin-announce");
  if (!panel) return;
  panel.innerHTML = `
    <div style="font-size:13px;font-weight:600;margin-bottom:8px;color:#fff;">📢 Send Global Announcement</div>
    <textarea id="admin-announce-text" placeholder="Type announcement... e.g. 'Sallah event tonight at Central Mosque!'" style="width:100%;padding:10px;background:#16213e;color:#fff;border:1px solid #1f2937;border-radius:8px;font-family:inherit;font-size:13px;min-height:80px;margin-bottom:10px;"></textarea>
    <div style="display:flex;gap:8px;margin-bottom:14px;">
      <button onclick="window.adminSendAnnounce()" style="flex:1;background:#16a34a;color:#fff;border:none;border-radius:8px;padding:10px;cursor:pointer;font-size:13px;font-weight:600;">📢 Send to All Players</button>
      <button onclick="window.adminSendAnnounce(true)" style="flex:1;background:#f59e0b;color:#000;border:none;border-radius:8px;padding:10px;cursor:pointer;font-size:13px;font-weight:600;">⚠️ Send as Alert</button>
    </div>
    <div style="font-size:13px;font-weight:600;margin-bottom:8px;color:#fff;">📜 Announcement Log</div>
    <div id="admin-announce-log" style="font-size:12px;max-height:300px;overflow-y:auto;"></div>`;
  onValue(ref(db, "announcements"), (snap) => {
    const data = snap.val() || {};
    const log = document.getElementById("admin-announce-log");
    if (log) {
      const list = Object.entries(data).sort(([,a],[,b]) => (b.ts||0)-(a.ts||0));
      log.innerHTML = list.length ? list.map(([k, a]) => `
        <div style="display:flex;align-items:flex-start;gap:6px;padding:8px;background:#16213e;border-radius:6px;margin-bottom:4px;">
          <div style="flex:1;color:#fff;">${a.alert?'<span style="color:#f59e0b;">⚠️</span> ':''}${escapeHtml(a.text)}<div style="font-size:10px;color:#6b7280;margin-top:2px;">${new Date(a.ts).toLocaleString()}</div></div>
          <button onclick="window.adminDeleteAnnounce('${k}')" style="background:#e11d48;color:#fff;border:none;border-radius:4px;padding:2px 8px;cursor:pointer;font-size:10px;">Delete</button>
        </div>`).join("") : '<div style="color:#6b7280;">No announcements sent yet.</div>';
    }
  });
}

window.adminSendAnnounce = async function(isAlert) {
  const text = document.getElementById("admin-announce-text")?.value?.trim();
  if (!text) return;
  const key = Date.now().toString();
  await set(ref(db, "announcements/" + key), { text, ts: Date.now(), alert: !!isAlert, by: _adminUser?.email || "admin" });
  document.getElementById("admin-announce-text").value = "";
  alert("Announcement sent to all players!");
};
window.adminDeleteAnnounce = async function(key) {
  await remove(ref(db, "announcements/" + key));
};

// ---- Live Monitor ----
function loadAdminLive() {
  const panel = document.getElementById("admin-live");
  if (!panel) return;
  panel.innerHTML = `
    <div style="font-size:13px;font-weight:600;margin-bottom:10px;color:#fff;">📡 Live Player Tracking</div>
    <div id="admin-live-list" style="font-size:12px;max-height:500px;overflow-y:auto;">Loading…</div>`;
  onValue(ref(db, "players"), (snap) => {
    const players = snap.val() || {};
    const list = Object.entries(players)
      .map(([uid,p]) => ({ uid, ...p, age: Date.now() - (p.ts||0) }))
      .sort((a,b) => a.age - b.age);
    const el = document.getElementById("admin-live-list");
    if (el) {
      el.innerHTML = list.length ? list.map(p => {
        const status = p.age < 30000 ? '<span style="color:#4ade80;">● active</span>'
                     : p.age < 120000 ? '<span style="color:#fbbf24;">● idle</span>'
                     : '<span style="color:#6b7280;">● offline</span>';
        return `<div style="display:flex;justify-content:space-between;padding:7px;background:#16213e;border-radius:6px;margin-bottom:4px;">
          <div style="color:#fff;">${p.name||"Unknown"}${p.isAdmin?' 🔐':''}</div>
          <div style="font-size:11px;color:#9ca3af;">(${(p.x||0).toFixed(0)}, ${(p.z||0).toFixed(0)}) · ${status}</div>
        </div>`;
      }).join("") : '<div style="color:#6b7280;">No players tracked.</div>';
    }
  });
}

// ---- Events ----
function loadAdminEvents() {
  const panel = document.getElementById("admin-events");
  if (!panel) return;
  panel.innerHTML = `
    <div style="font-size:13px;font-weight:600;margin-bottom:8px;color:#fff;">🎉 Trigger Live Event</div>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:14px;">
      <button onclick="window.adminTriggerEvent('sallah')" style="background:#7c3aed;color:#fff;border:none;border-radius:8px;padding:14px;cursor:pointer;font-size:13px;font-weight:600;">🐏 Sallah Festival</button>
      <button onclick="window.adminTriggerEvent('christmas')" style="background:#dc2626;color:#fff;border:none;border-radius:8px;padding:14px;cursor:pointer;font-size:13px;font-weight:600;">🎄 Christmas</button>
      <button onclick="window.adminTriggerEvent('football')" style="background:#16a34a;color:#fff;border:none;border-radius:8px;padding:14px;cursor:pointer;font-size:13px;font-weight:600;">⚽ Football Match</button>
      <button onclick="window.adminTriggerEvent('market')" style="background:#f59e0b;color:#000;border:none;border-radius:8px;padding:14px;cursor:pointer;font-size:13px;font-weight:600;">🥬 Market Day</button>
      <button onclick="window.adminTriggerEvent('rain')" style="background:#0ea5e9;color:#fff;border:none;border-radius:8px;padding:14px;cursor:pointer;font-size:13px;font-weight:600;">🌧️ Rain Season</button>
      <button onclick="window.adminTriggerEvent('double')" style="background:#fbbf24;color:#000;border:none;border-radius:8px;padding:14px;cursor:pointer;font-size:13px;font-weight:600;">💸 2× Money Hour</button>
    </div>
    <div style="font-size:13px;font-weight:600;margin-bottom:8px;color:#fff;">📜 Active Events</div>
    <div id="admin-active-events" style="font-size:12px;max-height:300px;overflow-y:auto;">Loading…</div>`;
  onValue(ref(db, "events"), (snap) => {
    const data = snap.val() || {};
    const el = document.getElementById("admin-active-events");
    if (el) {
      const list = Object.entries(data).filter(([,e]) => !e.endsAt || e.endsAt > Date.now());
      el.innerHTML = list.length ? list.map(([k, e]) => `
        <div style="display:flex;justify-content:space-between;padding:8px;background:#16213e;border-radius:6px;margin-bottom:4px;">
          <span style="color:#fff;">${e.icon||'🎉'} ${e.name}</span>
          <button onclick="window.adminEndEvent('${k}')" style="background:#e11d48;color:#fff;border:none;border-radius:4px;padding:2px 8px;cursor:pointer;font-size:10px;">End</button>
        </div>`).join("") : '<div style="color:#6b7280;">No active events.</div>';
    }
  });
}

window.adminTriggerEvent = async function(type) {
  const EVENTS = {
    sallah:    { id: "sallah",    name: "Sallah Festival",      icon: "🐏", bonus: "Free food for everyone!", duration: 3600000 },
    christmas: { id: "christmas", name: "Christmas Celebration", icon: "🎄", bonus: "Gift for every player!",  duration: 3600000 },
    football:  { id: "football",  name: "Football Match",        icon: "⚽", bonus: "Stadium bonus +₦500",     duration: 1800000 },
    market:    { id: "market",    name: "Market Day Sale",       icon: "🥬", bonus: "50% off all food",          duration: 1800000 },
    rain:      { id: "rain",      name: "Rain Season",           icon: "🌧️", bonus: "Stay dry — energy drains slower", duration: 3600000 },
    double:    { id: "double",    name: "2× Money Hour",         icon: "💸", bonus: "All jobs pay double!",      duration: 3600000 },
  };
  const e = EVENTS[type];
  if (!e) return;
  const key = type;
  await set(ref(db, "events/" + key), {
    ...e,
    startedAt: Date.now(),
    endsAt: Date.now() + e.duration,
    by: _adminUser?.email || "admin"
  });
  // Also broadcast as announcement
  await set(ref(db, "announcements/" + Date.now()), {
    text: `${e.icon} ${e.name} started! ${e.bonus}`,
    ts: Date.now(),
    alert: true,
    by: _adminUser?.email || "admin"
  });
  alert(`Event "${e.name}" started!`);
};
window.adminEndEvent = async function(key) {
  await remove(ref(db, "events/" + key));
};

// ---- Analytics ----
function loadAdminAnalytics() {
  const panel = document.getElementById("admin-analytics");
  if (!panel) return;
  panel.innerHTML = '<div style="color:#9ca3af;font-size:12px;">Crunching numbers…</div>';
  // Gather analytics from RTDB
  let playersData = {}, economyData = {}, chatData = {}, announceData = {};
  const tryRender = () => {
    const playerCount = Object.keys(playersData).length;
    const totalMoney = Object.values(economyData).reduce((s,d) => s + (d.balance||0), 0);
    const avgMoney = playerCount ? Math.round(totalMoney / playerCount) : 0;
    const chatMsgs = Object.keys(chatData).length;
    const today = new Date().toISOString().slice(0,10);
    const todayMsgs = Object.values(chatData).filter(m => new Date(m.ts||0).toISOString().slice(0,10) === today).length;
    const announcements = Object.keys(announceData).length;
    // Distribution
    const dist = { newcomer:0, hustler:0, oga:0, bigoga:0 };
    for (const [uid,d] of Object.entries(economyData)) {
      const b = d.balance || 0;
      if (b >= 200000) dist.bigoga++;
      else if (b >= 50000) dist.oga++;
      else if (b >= 10000) dist.hustler++;
      else dist.newcomer++;
    }
    const max = Math.max(1, ...Object.values(dist));
    panel.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:14px;">
        <div style="background:#16213e;border-radius:12px;padding:14px;text-align:center;">
          <div style="font-size:24px;font-weight:800;color:#4ade80;">${playerCount}</div>
          <div style="font-size:10px;color:#9ca3af;">Total Players</div>
        </div>
        <div style="background:#16213e;border-radius:12px;padding:14px;text-align:center;">
          <div style="font-size:24px;font-weight:800;color:#fbbf24;">${chatMsgs}</div>
          <div style="font-size:10px;color:#9ca3af;">Total Messages</div>
        </div>
        <div style="background:#16213e;border-radius:12px;padding:14px;text-align:center;">
          <div style="font-size:24px;font-weight:800;color:#60a5fa;">${todayMsgs}</div>
          <div style="font-size:10px;color:#9ca3af;">Messages Today</div>
        </div>
        <div style="background:#16213e;border-radius:12px;padding:14px;text-align:center;">
          <div style="font-size:24px;font-weight:800;color:#f472b6;">${announcements}</div>
          <div style="font-size:10px;color:#9ca3af;">Announcements</div>
        </div>
      </div>
      <div style="background:#16213e;border-radius:12px;padding:14px;margin-bottom:14px;">
        <div style="font-size:13px;font-weight:600;margin-bottom:10px;color:#fff;">📊 Rank Distribution</div>
        ${[
          { k:"newcomer", label:"Newcomer", color:"#8a8f96" },
          { k:"hustler",  label:"Hustler",  color:"#f2b134" },
          { k:"oga",      label:"Oga",      color:"#e11d48" },
          { k:"bigoga",   label:"Big Oga",  color:"#6b21a8" }
        ].map(r => `
          <div style="margin-bottom:8px;">
            <div style="display:flex;justify-content:space-between;font-size:11px;color:#fff;margin-bottom:3px;">
              <span>${r.label}</span><span>${dist[r.k]}</span>
            </div>
            <div style="height:8px;background:#0f172a;border-radius:4px;overflow:hidden;">
              <div style="height:100%;width:${(dist[r.k]/max*100)}%;background:${r.color};transition:width .3s;"></div>
            </div>
          </div>
        `).join("")}
      </div>
      <div style="background:#16213e;border-radius:12px;padding:14px;">
        <div style="font-size:13px;font-weight:600;margin-bottom:8px;color:#fff;">📈 Economy Snapshot</div>
        <div style="font-size:12px;color:#9ca3af;">
          <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #1f2937;"><span>Total money</span><span style="color:#4ade80;font-weight:600;">₦${totalMoney.toLocaleString()}</span></div>
          <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #1f2937;"><span>Avg per player</span><span style="color:#fbbf24;font-weight:600;">₦${avgMoney.toLocaleString()}</span></div>
          <div style="display:flex;justify-content:space-between;padding:5px 0;"><span>Active wallets</span><span style="color:#60a5fa;font-weight:600;">${Object.keys(economyData).length}</span></div>
        </div>
      </div>`;
  };
  onValue(ref(db, "players"), (s) => { playersData = s.val()||{}; tryRender(); });
  onValue(ref(db, "economy"), (s) => { economyData = s.val()||{}; tryRender(); });
  onValue(ref(db, "chat"), (s) => { chatData = s.val()||{}; tryRender(); });
  onValue(ref(db, "announcements"), (s) => { announceData = s.val()||{}; tryRender(); });
}

function toast(msg) { const t=document.getElementById("toast"); if(t){t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2500);} }

// Public wrappers — all gate on isAdmin() so non-admins can't trigger anything
// even by calling these from the devtools console.
window.adminTab = (tab) => { if (_isAdmin) adminTab(tab); else toast("Access denied"); };
window.showAdminDashboard = () => { if (_isAdmin) showAdminDashboard(); else toast("Admin access required"); };
window.hideAdminDashboard = () => { if (_isAdmin) hideAdminDashboard(); };
