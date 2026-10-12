// src/auth.js — Firebase Auth (Guest, Google, Email/Password) + Admin quick-login
import { auth, authPersistReady, db } from "./firebase.js";
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
export function initAuth(onAuth) {
  _onAuth = onAuth;
  authPersistReady.then(() => {
    onAuthStateChanged(auth, async (user) => {
      // Guests are no longer allowed: drop any old anonymous session.
      if (user && user.isAnonymous) { try { await signOut(auth); } catch (_) {} return; }
      if (user) {
        isAuthed = true;
        hideAuthModal();
        if (!_started) { _started = true; if (_onAuth) _onAuth(user); }
      } else {
        isAuthed = false;
        showAuthModal();
      }
    });
  });
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
    clearAuthError();
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (e) {
    showAuthError(friendly(e, "Google sign-in failed"));
  }
}

export async function loginEmail(email, pass) {
  try {
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
  }
}

export async function signupEmail(email, pass, name, username) {
  try {
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
      // ---- Claim the username so nobody else can use it ----
      try {
        const unameKey = username.toLowerCase().replace(/\./g, "_");
        await set(ref(db, "usernames/" + unameKey), uid);
      } catch (e) { console.warn("username claim failed", e); }
    }
    clearAuthError();
  } catch (e) {
    showAuthError(friendly(e, "Could not create account. Try again."));
  }
}

export async function logout() {
  try {
    await signOut(auth);
    toast("Signed out");
    // Clear ALL game state from localStorage so the next account starts fresh
    try {
      const keys = Object.keys(localStorage).filter(k => k.startsWith("kaduna-state"));
      keys.forEach(k => localStorage.removeItem(k));
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
