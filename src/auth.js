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
import { ref, set, update } from "firebase/database";

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

export async function loginGuest() {
  try {
    await signInAnonymously(auth);
  } catch (e) {
    toast(e.message);
  }
}

export async function loginGoogle() {
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (e) {
    toast(friendly(e, "Google sign-in failed"));
  }
}

export async function loginEmail(email, pass) {
  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (e) {
    toast(friendly(e, "Could not log in"));
  }
}

export async function signupEmail(email, pass, name, username) {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    // Update the user's display name with their chosen name
    if (name && cred.user) {
      try {
        await updateProfile(cred.user, { displayName: name });
      } catch (e) {}
      // Save username + name to Firebase
      const uid = cred.user.uid;
      const dbRef = ref(db, "players/" + uid);
      await set(dbRef, { name: name, username: username || name, x: -9, z: 11, heading: Math.PI, ts: Date.now() });
      // Also save to economy
      await update(ref(db, "economy/" + uid), { name: name, balance: 5000 });
    }
  } catch (e) {
    toast(friendly(e, "Could not create account"));
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
  if (c.includes("email-already-in-use")) return "That email already has an account. Tap Log In.";
  if (c.includes("weak-password")) return "Password must be at least 6 characters.";
  if (c.includes("invalid-email")) return "Enter a valid email address.";
  if (c.includes("invalid-credential") || c.includes("wrong-password") || c.includes("user-not-found")) return "Wrong email or password. New here? Tap Sign Up.";
  if (c.includes("popup-closed") || c.includes("cancelled")) return "Sign-in cancelled.";
  if (c.includes("network")) return "No network. Check your data and try again.";
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
  });
  signupBtn?.addEventListener("click", () => {
    if (_mode !== "signup") { setMode("signup"); return; }
    const e = document.getElementById("auth-email")?.value;
    const p = document.getElementById("auth-pass")?.value;
    const n = document.getElementById("auth-name")?.value;
    const u = document.getElementById("auth-username")?.value;
    if (!n || !n.trim()) { toast("Enter your name"); return; }
    if (!u || !u.trim()) { toast("Enter a username"); return; }
    if (e && p && n) signupEmail(e, p, n.trim(), u.trim());
  });
  document.getElementById("auth-pass")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const em = document.getElementById("auth-email")?.value;
      const pw = document.getElementById("auth-pass")?.value;
      if (_mode === "login" && em && pw) loginEmail(em, pw);
      else if (_mode === "signup") { signupBtn?.click(); }
    }
  });
}
