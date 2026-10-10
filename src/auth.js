// src/auth.js — login/signup UI + Firebase Auth
import { auth, signInAnonymously, signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged } from "./firebase.js";

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
  const modal = document.getElementById("auth-modal");
  if (modal) modal.classList.add("show");
}

export function hideAuthModal() {
  const modal = document.getElementById("auth-modal");
  if (modal) modal.classList.remove("show");
}

// Guest login
export async function loginGuest() {
  try {
    await signInAnonymously(auth);
  } catch (e) {
    showToast("Login failed: " + e.message);
  }
}

// Google login
export async function loginGoogle() {
  try {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  } catch (e) {
    showToast("Google login failed: " + e.message);
  }
}

// Email/password login
export async function loginEmail(email, password) {
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (e) {
    showToast("Login failed: " + (e.message || "Invalid credentials"));
  }
}

// Email/password signup
export async function signupEmail(email, password) {
  try {
    await createUserWithEmailAndPassword(auth, email, password);
  } catch (e) {
    showToast("Signup failed: " + (e.message || "Could not create account"));
  }
}

function showToast(msg) {
  const t = document.getElementById("toast");
  if (t) { t.textContent = msg; t.classList.add("show"); setTimeout(() => t.classList.remove("show"), 2500); }
}

// Wire up the auth modal buttons
export function wireAuthUI() {
  const modal = document.getElementById("auth-modal");
  if (!modal) return;

  // Guest button
  const guestBtn = document.getElementById("auth-guest");
  if (guestBtn) guestBtn.onclick = loginGuest;

  // Google button
  const googleBtn = document.getElementById("auth-google");
  if (googleBtn) googleBtn.onclick = loginGoogle;

  // Email login form
  const loginBtn = document.getElementById("auth-login-btn");
  if (loginBtn) loginBtn.onclick = () => {
    const email = document.getElementById("auth-email").value;
    const pass = document.getElementById("auth-pass").value;
    if (email && pass) loginEmail(email, pass);
  };

  // Email signup
  const signupBtn = document.getElementById("auth-signup-btn");
  if (signupBtn) signupBtn.onclick = () => {
    const email = document.getElementById("auth-email").value;
    const pass = document.getElementById("auth-pass").value;
    if (email && pass) signupEmail(email, pass);
  };

  // Close button
  const closeBtn = document.getElementById("auth-close");
  if (closeBtn) closeBtn.onclick = hideAuthModal;
}
