// src/auth.js — Firebase Auth (Guest, Google, Email/Password) + Admin quick-login
import { auth, authPersistReady } from "./firebase.js";
import {
  signInAnonymously,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";

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

export async function signupEmail(email, pass) {
  try {
    await createUserWithEmailAndPassword(auth, email, pass);
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
  document.getElementById("auth-login-btn")?.addEventListener("click", () => {
    const e = document.getElementById("auth-email")?.value;
    const p = document.getElementById("auth-pass")?.value;
    if (e && p) loginEmail(e, p);
  });
  document.getElementById("auth-signup-btn")?.addEventListener("click", () => {
    const e = document.getElementById("auth-email")?.value;
    const p = document.getElementById("auth-pass")?.value;
    if (e && p) signupEmail(e, p);
  });
  // Enter key on password field triggers login
  document.getElementById("auth-pass")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const em = document.getElementById("auth-email")?.value;
      const pw = document.getElementById("auth-pass")?.value;
      if (em && pw) loginEmail(em, pw);
    }
  });
}
