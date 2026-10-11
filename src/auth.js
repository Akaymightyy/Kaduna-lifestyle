// src/auth.js — Firebase Auth (Guest, Google, Email/Password) + Admin quick-login
import { auth } from "./firebase.js";
import {
  signInAnonymously,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
} from "firebase/auth";

let _onAuth = null;

export function initAuth(onAuth) {
  _onAuth = onAuth;
  onAuthStateChanged(auth, (user) => {
    if (user) {
      hideAuthModal();
      if (_onAuth) _onAuth(user);
    }
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
    toast(e.message);
  }
}

export async function loginEmail(email, pass) {
  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (e) {
    toast(e.message || "Invalid credentials");
  }
}

export async function signupEmail(email, pass) {
  try {
    await createUserWithEmailAndPassword(auth, email, pass);
  } catch (e) {
    toast(e.message || "Could not create account");
  }
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
  document.getElementById("auth-guest")?.addEventListener("click", loginGuest);
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
  document.getElementById("auth-close")?.addEventListener("click", hideAuthModal);
  // Enter key on password field triggers login
  document.getElementById("auth-pass")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const em = document.getElementById("auth-email")?.value;
      const pw = document.getElementById("auth-pass")?.value;
      if (em && pw) loginEmail(em, pw);
    }
  });
}
