// src/auth.js — Firebase Auth (Guest, Google, Email/Password) + Admin quick-login
import { auth, authPersistReady, db } from "./firebase.js";
import { getGameUid, setGameUid } from "./needs.js";
import {
  signInAnonymously,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  updateProfile,
} from "firebase/auth";
import { ref, set, update, get } from "firebase/database";

let _onAuth = null;

export let isAuthed = false;
let _started = false;
let _freshBusy = false, _needReload = null;   // sign-up writes several records AFTER the account exists: reload only when it is done
function _reloadForAccount(uid) {
  try { sessionStorage.setItem("kaduna-uid-reload", uid); sessionStorage.setItem("kaduna-skip-welcome", "1"); } catch (e) {}
  location.reload();
}
function _endFresh() { _freshBusy = false; if (_needReload) _reloadForAccount(_needReload); }
let _freshLogin = false;      // true when the player just typed their details this visit -> skip the welcome screen
export function initAuth(onAuth) {
  _onAuth = onAuth;
  authPersistReady.then(() => {
    onAuthStateChanged(auth, async (user) => {
      // Guests are no longer allowed: drop any old anonymous session.
      if (user && user.isAnonymous) { try { await signOut(auth); } catch (_) {} return; }
      if (user) {
        isAuthed = true;
        hideAuthModal();
        if (!_started) {
          _started = true;
          // The saved game is keyed by account and the 3D body is built at page start, so after a fresh login on
          // this page we reload once so everything (body, outfit, save) belongs to THIS account.
          if (getGameUid() !== user.uid) {
            let again = false; try { again = sessionStorage.getItem("kaduna-uid-reload") === user.uid; } catch (e) {}
            if (!again) { if (_freshBusy) _needReload = user.uid; else _reloadForAccount(user.uid); return; }
            setGameUid(user.uid);   // safety net so a stuck reload can never loop
          } else { try { sessionStorage.removeItem("kaduna-uid-reload"); } catch (e) {} }
          const wasNewLife = await _applyPendingNewLife(user);
          if (_onAuth) _onAuth(user);                       // the game loads behind the welcome screen
          if (!_freshLogin && !wasNewLife) showWelcome(user); // returning player: Continue / New life / Log out
        }
      } else {
        isAuthed = false;
        hideWelcome();
        showAuthModal();
      }
    });
  });
}

// ---------- Welcome back screen (like Lagos Life) ----------
function _savedState(uid) { try { return JSON.parse(localStorage.getItem("kaduna-state-" + uid)) || null; } catch (e) { return null; } }
function _fmtNaira(n) {
  n = Number(n) || 0;
  if (n >= 1e12) return "₦" + (n / 1e12).toFixed(1) + "tn";
  if (n >= 1e9) return "₦" + (n / 1e9).toFixed(1) + "bn";
  if (n >= 1e6) return "₦" + (n / 1e6).toFixed(1) + "m";
  return "₦" + Math.round(n).toLocaleString();
}
function _avatarSvg(look) {
  const l = look || {};
  const skin = l.skin || "#8a5a3c", top = l.top || "#1f7a5a", hair = l.hair || "#111111";
  return '<svg viewBox="0 0 58 58" width="58" height="58" xmlns="http://www.w3.org/2000/svg">' +
    '<rect width="58" height="58" fill="#dfe8d8"/>' +
    '<path d="M6 58c0-14 10-21 23-21s23 7 23 21z" fill="' + top + '"/>' +
    '<circle cx="29" cy="24" r="12" fill="' + skin + '"/>' +
    '<path d="M17 23c0-9 6-13 12-13s12 4 12 13c-3-4-7-6-12-6s-9 2-12 6z" fill="' + hair + '"/></svg>';
}
function _esc(t) { return String(t == null ? "" : t).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])); }
async function showWelcome(user) {
  const el = document.getElementById("welcome-modal");
  if (!el) return;
  try { if (sessionStorage.getItem("kaduna-skip-welcome")) { sessionStorage.removeItem("kaduna-skip-welcome"); return; } } catch (e) {}
  const st = _savedState(user.uid);
  const fallbackName = user.displayName || (user.email ? user.email.split("@")[0] : "Player");
  const set$ = (id, html, asText) => { const n = document.getElementById(id); if (n) { if (asText) n.textContent = html; else n.innerHTML = html; } };
  set$("wl-name", fallbackName, true);
  set$("wl-handle", "@" + fallbackName, true);
  set$("wl-av", _avatarSvg(st && st.look));
  const day = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });
  set$("wl-meta", day + " · " + _fmtNaira(st && st.money != null ? st.money : 5000), true);
  el.classList.add("show");
  document.getElementById("wl-continue").onclick = hideWelcome;
  document.getElementById("wl-logout").onclick = () => { if (confirm("Log out of Kaduna Life?")) logout(); };
  document.getElementById("wl-newlife").onclick = () => {
    if (!confirm("Start a NEW life? Your character, money and progress will be reset.")) return;
    startNewLife(user.uid);
  };
  // Fill in the real @username and the latest balance (both optional - the screen already works without them)
  try { const p = (await get(ref(db, "userProfiles/" + user.uid))).val(); if (p) { set$("wl-handle", "@" + (p.username || p.name || fallbackName), true); set$("wl-name", p.username || p.name || fallbackName, true); } } catch (e) {}
  try {
    const b = (await get(ref(db, "economy/" + user.uid + "/balance"))).val();
    if (typeof b === "number") set$("wl-meta", day + " · " + _fmtNaira(b), true);
  } catch (e) {}
  try { const lk = (await get(ref(db, "players/" + user.uid + "/look"))).val(); if (lk) set$("wl-av", _avatarSvg(lk)); } catch (e) {}
}
function hideWelcome() { document.getElementById("welcome-modal")?.classList.remove("show"); }

// "New life": clear this device's saved game, flag it, and reload. The Firebase part is done on the next
// load (before the game starts) so the old balance can't be pushed back over the reset while the tab closes.
function startNewLife(uid) {
  try {
    Object.keys(localStorage).filter((k) => k.startsWith("kaduna-state") || k.startsWith("kaduna-pos")).forEach((k) => localStorage.removeItem(k));
    localStorage.setItem("kaduna-newlife", uid);
  } catch (e) {}
  location.reload();
}
async function _applyPendingNewLife(user) {
  let pending = null;
  try { pending = localStorage.getItem("kaduna-newlife"); } catch (e) {}
  if (pending !== user.uid) return false;
  try {
    await update(ref(db, "players/" + user.uid), { look: null, origin: null, homeArea: null, homePlot: null, homeTier: null });
    await update(ref(db, "economy/" + user.uid), { balance: 5000 });
  } catch (e) { console.warn("[new life] reset failed", e); }
  try { localStorage.removeItem("kaduna-newlife"); } catch (e) {}
  return true;
}

export function showAuthModal() {
  document.getElementById("auth-modal")?.classList.add("show");
}
export function hideAuthModal() {
  document.getElementById("auth-modal")?.classList.remove("show");
}

// ---- Error display inside the auth modal ----
// Shows a red error banner that stays visible until the user retypes.
function showAuthError(msg) {
  const el = document.getElementById("auth-error");
  if (!el) { toast(msg); return; }
  el.textContent = msg;
  el.style.display = "block";
}
function clearAuthError() {
  const el = document.getElementById("auth-error");
  if (el) el.style.display = "none";
}

export async function loginGuest() {
  try {
    await signInAnonymously(auth);
  } catch (e) {
    showAuthError(e.message);
  }
}

export async function loginGoogle() {
  try {
    _freshLogin = true; _freshBusy = true;
    clearAuthError();
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (e) {
    showAuthError(friendly(e, "Google sign-in failed"));
  } finally { _endFresh(); }
}

export async function loginEmail(email, pass) {
  try {
    _freshLogin = true; _freshBusy = true;
    clearAuthError();
    // Basic field validation BEFORE hitting Firebase — gives instant feedback.
    if (!email || !email.trim()) { showAuthError("Enter your email address."); return; }
    if (!pass) { showAuthError("Enter your password."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showAuthError("Enter a valid email address."); return; }
    await signInWithEmailAndPassword(auth, email, pass);
    // Success — clear any stale error
    clearAuthError();
  } catch (e) {
    showAuthError(friendly(e, "Could not log in. Check your details."));
  } finally { _endFresh(); }
}

export async function signupEmail(email, pass, name, username) {
  try {
    _freshLogin = true; _freshBusy = true;
    clearAuthError();
    // ---- Field validation ----
    if (!name || !name.trim()) { showAuthError("Enter your full name."); return; }
    if (!username || !username.trim()) { showAuthError("Enter a username."); return; }
    if (!email || !email.trim()) { showAuthError("Enter your email address."); return; }
    if (!pass) { showAuthError("Enter a password."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showAuthError("Enter a valid email address."); return; }
    if (pass.length < 6) { showAuthError("Password must be at least 6 characters."); return; }
    if (username.length < 3) { showAuthError("Username must be at least 3 characters."); return; }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) { showAuthError("Username can only have letters, numbers, and underscores."); return; }

    // ---- Username availability check ----
    // Check the `usernames` index node (not the full players node, which is
    // admin-only for reads). Each signup writes to usernames/{lowercase} = uid.
    try {
      const unameKey = username.toLowerCase().replace(/\./g, "_");
      const unameSnap = await get(ref(db, "usernames/" + unameKey));
      if (unameSnap.exists()) {
        showAuthError("💔 Username \"" + username + "\" is already taken. Try another one.");
        return;
      }
    } catch (e) {
      console.warn("username check failed (continuing):", e);
    }

    // ---- Create the account ----
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    // Update the user's display name with their chosen name
    if (name && cred.user) {
      try {
        await updateProfile(cred.user, { displayName: name });
      } catch (e) {}
      // Save username + name to Firebase.
      // IMPORTANT: use update() not set() — set() would wipe any existing fields
      // on the player node (look, origin, homeTier, etc.) and would also race with
      // the multiplayer module's own update() call. update() only patches the fields
      // we actually want to set here.
      const uid = cred.user.uid;
      const dbRef = ref(db, "players/" + uid);
      await update(dbRef, { name: name, username: username || name, x: -9, z: 11, heading: Math.PI, ts: Date.now() });
      // Also save to economy
      await update(ref(db, "economy/" + uid), { name: name, balance: 5000 });
      // ---- FEATURE: write a world-readable public profile so other users can
      // search and find this account by name (the players/{uid} node is admin/
      // owner-only per Firebase rules, so search couldn't read other players'
      // names). userProfiles/{uid} = { name, username, createdAt } is world-
      // readable per the new FIREBASE_RULES.json.
      try {
        await set(ref(db, "userProfiles/" + uid), {
          name: name,
          username: username || name,
          createdAt: Date.now(),
        });
      } catch (e) { console.warn("userProfiles write failed", e); }
      // ---- Claim the username so nobody else can use it ----
      try {
        const unameKey = username.toLowerCase().replace(/\./g, "_");
        await set(ref(db, "usernames/" + unameKey), uid);
      } catch (e) { console.warn("username claim failed", e); }
    }
    clearAuthError();
  } catch (e) {
    showAuthError(friendly(e, "Could not create account. Try again."));
  } finally { _endFresh(); }
}

export async function logout() {
  try {
    await signOut(auth);
    toast("Signed out");
    // Clear ALL game state from localStorage so the next account starts fresh
    try {
      const keys = Object.keys(localStorage).filter(k => k.startsWith("kaduna-state") || k.startsWith("kaduna-pos"));
      keys.forEach(k => localStorage.removeItem(k));
      sessionStorage.removeItem("kaduna-uid-reload"); sessionStorage.removeItem("kaduna-gender-reload");
    } catch (e) {}
    setTimeout(() => location.reload(), 500);
  } catch (e) {
    toast(e.message || "Could not sign out");
  }
}

function friendly(e, fallback) {
  const c = (e && e.code) || "";
  if (c.includes("email-already-in-use")) return "💔 This email already has an account. Tap Log In instead.";
  if (c.includes("weak-password")) return "Password must be at least 6 characters.";
  if (c.includes("invalid-email")) return "Enter a valid email address.";
  if (c.includes("invalid-credential") || c.includes("wrong-password") || c.includes("user-not-found")) return "❌ Wrong email or password. New here? Tap Sign Up.";
  if (c.includes("too-many-requests")) return "⏳ Too many attempts. Wait a minute and try again.";
  if (c.includes("popup-closed") || c.includes("cancelled")) return "Sign-in cancelled.";
  if (c.includes("network")) return "📡 No network. Check your data and try again.";
  if (c.includes("operation-not-allowed")) return "Email sign-up is not enabled. Contact support.";
  return fallback;
}
function toast(msg) {
  const t = document.getElementById("toast");
  if (t) {
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 2500);
  }
}

export function wireAuthUI() {
  document.getElementById("auth-google")?.addEventListener("click", loginGoogle);

  // Mode toggle: "login" or "signup"
  let _mode = "login";
  const nameField = document.getElementById("auth-name");
  const usernameField = document.getElementById("auth-username");
  const loginBtn = document.getElementById("auth-login-btn");
  const signupBtn = document.getElementById("auth-signup-btn");

  function setMode(m) {
    _mode = m;
    clearAuthError();
    if (m === "signup") {
      if (nameField) nameField.style.display = "block";
      if (usernameField) usernameField.style.display = "block";
      if (signupBtn) { signupBtn.classList.add("on"); loginBtn.classList.remove("on"); }
    } else {
      if (nameField) nameField.style.display = "none";
      if (usernameField) usernameField.style.display = "none";
      if (signupBtn) { signupBtn.classList.remove("on"); loginBtn.classList.add("on"); }
    }
  }

  loginBtn?.addEventListener("click", () => {
    if (_mode !== "login") { setMode("login"); return; }
    const e = document.getElementById("auth-email")?.value;
    const p = document.getElementById("auth-pass")?.value;
    if (e && p) loginEmail(e, p);
    else showAuthError("Enter your email and password.");
  });
  signupBtn?.addEventListener("click", () => {
    if (_mode !== "signup") { setMode("signup"); return; }
    const e = document.getElementById("auth-email")?.value;
    const p = document.getElementById("auth-pass")?.value;
    const n = document.getElementById("auth-name")?.value;
    const u = document.getElementById("auth-username")?.value;
    if (!n || !n.trim()) { showAuthError("Enter your name"); return; }
    if (!u || !u.trim()) { showAuthError("Enter a username"); return; }
    if (e && p && n) signupEmail(e, p, n.trim(), u.trim());
    else showAuthError("Fill in all fields to sign up.");
  });
  document.getElementById("auth-pass")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const em = document.getElementById("auth-email")?.value;
      const pw = document.getElementById("auth-pass")?.value;
      if (_mode === "login" && em && pw) loginEmail(em, pw);
      else if (_mode === "signup") { signupBtn?.click(); }
    }
  });
  // Clear error when user starts typing in any field
  ["auth-email", "auth-pass", "auth-name", "auth-username"].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", clearAuthError);
  });
}
