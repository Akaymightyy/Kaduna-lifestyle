// src/admin.js — Admin dashboard logic (secure, mobile-friendly)
import { auth, db } from "./firebase.js";
import { ref, onValue, set, update, get, remove } from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";

const ADMIN_UIDS = ["Akaymightyy"]; // Add your admin UIDs here
let _isAdmin = false;

export function initAdmin(onAdmin) {
  onAuthStateChanged(auth, (user) => {
    if (!user) { _isAdmin = false; return; }
    // Check if user is admin by UID or by /admins/{uid} = true
    const adminRef = ref(db, "admins/" + user.uid);
    onValue(adminRef, (snap) => {
      _isAdmin = snap.val() === true || ADMIN_UIDS.includes(user.uid);
      if (_isAdmin) onAdmin?.(user);
    });
  });
}

export function isAdmin() { return _isAdmin; }

export function showAdminDashboard() {
  const modal = document.getElementById("admin-modal");
  if (!modal) return;
  modal.classList.add("show");
  loadAdminOverview();
}

export function hideAdminDashboard() {
  const modal = document.getElementById("admin-modal");
  if (modal) modal.classList.remove("show");
}

// ---- Tab switching ----
export function adminTab(tab) {
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
}

// ---- Overview ----
function loadAdminOverview() {
  const panel = document.getElementById("admin-overview");
  if (!panel) return;
  onValue(ref(db, "players"), (snap) => {
    const players = snap.val() || {};
    const count = Object.keys(players).length;
    panel.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:16px;">
        <div style="background:var(--cream);border-radius:12px;padding:14px;text-align:center;">
          <div style="font-size:28px;font-weight:800;color:var(--green);">${count}</div>
          <div style="font-size:12px;color:#666;">Online Players</div>
        </div>
        <div style="background:var(--cream);border-radius:12px;padding:14px;text-align:center;">
          <div id="admin-total-money" style="font-size:28px;font-weight:800;color:var(--green);">...</div>
          <div style="font-size:12px;color:#666;">Total Money</div>
        </div>
      </div>
      <div style="background:var(--cream);border-radius:12px;padding:14px;">
        <div style="font-size:13px;font-weight:600;margin-bottom:8px;">Online Players List</div>
        <div id="admin-player-list" style="font-size:12px;max-height:200px;overflow-y:auto;">
          ${Object.entries(players).map(([uid,p]) => `<div style="padding:4px 0;border-bottom:1px solid #eee;">${p.name||"Unknown"} — (${p.x?.toFixed(0)||0}, ${p.z?.toFixed(0)||0})</div>`).join("") || "No players online"}
        </div>
      </div>`;
  });
  // Get total money
  onValue(ref(db, "economy"), (snap) => {
    const data = snap.val() || {};
    const total = Object.values(data).reduce((sum, d) => sum + (d.balance || 0), 0);
    const el = document.getElementById("admin-total-money");
    if (el) el.textContent = "₦" + total.toLocaleString();
  });
}

// ---- Players ----
function loadAdminPlayers() {
  const panel = document.getElementById("admin-players");
  if (!panel) return;
  panel.innerHTML = `
    <div style="margin-bottom:12px;">
      <input id="admin-search" type="text" placeholder="Search by name or UID..." style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-family:inherit;font-size:13px;" oninput="window.adminSearchPlayers(this.value)" />
    </div>
    <div id="admin-search-results" style="font-size:12px;max-height:300px;overflow-y:auto;">Loading all players...</div>`;
  onValue(ref(db, "players"), (snap) => {
    const players = snap.val() || {};
    window._adminPlayersCache = players;
    renderPlayerList(players);
  });
}

window.adminSearchPlayers = function(query) {
  const players = window._adminPlayersCache || {};
  if (!query) { renderPlayerList(players); return; }
  const filtered = {};
  for (const [uid, p] of Object.entries(players)) {
    if ((p.name||"").toLowerCase().includes(query.toLowerCase()) || uid.includes(query)) {
      filtered[uid] = p;
    }
  }
  renderPlayerList(filtered);
};

function renderPlayerList(players) {
  const el = document.getElementById("admin-search-results");
  if (!el) return;
  const entries = Object.entries(players);
  el.innerHTML = entries.length ? entries.map(([uid, p]) => `
    <div style="display:flex;align-items:center;gap:8px;padding:8px;border-bottom:1px solid #eee;">
      <div style="flex:1;">
        <div style="font-weight:600;">${p.name||"Unknown"}</div>
        <div style="font-size:10px;color:#999;">${uid.slice(0,12)}...</div>
      </div>
      <button onclick="window.adminEditPlayer('${uid}')" style="background:var(--green);color:#fff;border:none;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:11px;">Edit</button>
      <button onclick="window.adminBanPlayer('${uid}')" style="background:#e11d48;color:#fff;border:none;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:11px;">Ban</button>
    </div>`).join("") : "No players found.";
}

window.adminEditPlayer = async function(uid) {
  const balSnap = await get(ref(db, "economy/" + uid + "/balance"));
  const balance = balSnap.val() || 0;
  const newBal = prompt("Set new balance for player:", balance);
  if (newBal !== null) {
    await set(ref(db, "economy/" + uid + "/balance"), parseInt(newBal) || 0);
    alert("Balance updated to ₦" + (parseInt(newBal)||0).toLocaleString());
  }
};

window.adminBanPlayer = async function(uid) {
  if (!confirm("Ban this player?")) return;
  await update(ref(db, "players/" + uid), { banned: true });
  alert("Player banned.");
};

// ---- Economy ----
function loadAdminEconomy() {
  const panel = document.getElementById("admin-economy");
  if (!panel) return;
  panel.innerHTML = '<div style="font-size:12px;color:#666;">Loading economy data...</div>';
  onValue(ref(db, "economy"), (snap) => {
    const data = snap.val() || {};
    const list = Object.entries(data)
      .map(([uid, d]) => ({ uid, balance: d.balance || 0, name: d.name || "Unknown" }))
      .sort((a, b) => b.balance - a.balance);
    const total = list.reduce((s, p) => s + p.balance, 0);
    panel.innerHTML = `
      <div style="background:var(--cream);border-radius:12px;padding:14px;margin-bottom:12px;text-align:center;">
        <div style="font-size:24px;font-weight:800;color:var(--green);">₦${total.toLocaleString()}</div>
        <div style="font-size:12px;color:#666;">Total Money in Economy</div>
      </div>
      <div style="font-size:13px;font-weight:600;margin-bottom:8px;">Richest Players</div>
      <div style="font-size:12px;max-height:250px;overflow-y:auto;">
        ${list.slice(0, 20).map((p, i) => `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee;"><span>${i+1}. ${p.name}</span><span style="font-weight:600;color:var(--green);">₦${p.balance.toLocaleString()}</span></div>`).join("") || "No data"}
      </div>`;
  });
}

// ---- Chat moderation ----
function loadAdminChat() {
  const panel = document.getElementById("admin-chat");
  if (!panel) return;
  panel.innerHTML = '<div style="font-size:12px;color:#666;">Loading recent chat...</div>';
  onValue(ref(db, "chat"), (snap) => {
    const data = snap.val() || {};
    const msgs = Object.entries(data).sort(([,a],[,b]) => (a.ts||0)-(b.ts||0)).slice(-30).reverse();
    panel.innerHTML = `
      <div style="font-size:13px;font-weight:600;margin-bottom:8px;">Recent Messages (newest first)</div>
      <div style="font-size:12px;max-height:300px;overflow-y:auto;">
        ${msgs.map(([key, m]) => `<div style="display:flex;align-items:center;gap:6px;padding:6px;border-bottom:1px solid #eee;">
          <div style="flex:1;"><b>${m.name}:</b> ${m.text}</div>
          <button onclick="window.adminDeleteMsg('${key}')" style="background:#e11d48;color:#fff;border:none;border-radius:4px;padding:2px 8px;cursor:pointer;font-size:10px;">Delete</button>
        </div>`).join("") || "No messages"}
      </div>`;
  });
}

window.adminDeleteMsg = async function(key) {
  await remove(ref(db, "chat/" + key));
};

// ---- Announcements ----
function loadAdminAnnounce() {
  const panel = document.getElementById("admin-announce");
  if (!panel) return;
  panel.innerHTML = `
    <div style="font-size:13px;font-weight:600;margin-bottom:8px;">Send Global Announcement</div>
    <textarea id="admin-announce-text" placeholder="Type announcement..." style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;font-family:inherit;font-size:13px;min-height:60px;margin-bottom:10px;"></textarea>
    <button onclick="window.adminSendAnnounce()" style="background:var(--green);color:#fff;border:none;border-radius:8px;padding:8px 16px;cursor:pointer;font-size:13px;font-weight:600;">Send to All Players</button>
    <div id="admin-announce-log" style="margin-top:14px;font-size:12px;max-height:150px;overflow-y:auto;"></div>`;
  onValue(ref(db, "announcements"), (snap) => {
    const data = snap.val() || {};
    const log = document.getElementById("admin-announce-log");
    if (log) log.innerHTML = Object.entries(data).reverse().map(([k, a]) => `<div style="padding:4px 0;border-bottom:1px solid #eee;">${a.text} <span style="color:#999;font-size:10px;">${new Date(a.ts).toLocaleString()}</span></div>`).join("") || "No announcements sent";
  });
}

window.adminSendAnnounce = async function() {
  const text = document.getElementById("admin-announce-text")?.value?.trim();
  if (!text) return;
  const key = Date.now().toString();
  await set(ref(db, "announcements/" + key), { text, ts: Date.now() });
  document.getElementById("admin-announce-text").value = "";
  alert("Announcement sent to all players!");
};

window.adminTab = adminTab;
window.showAdminDashboard = showAdminDashboard;
window.hideAdminDashboard = hideAdminDashboard;
