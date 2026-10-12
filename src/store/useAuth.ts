"use client";

import { create } from "zustand";
import {
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signInWithPopup,
  createUserWithEmailAndPassword,
  linkWithCredential,
  sendPasswordResetEmail,
  EmailAuthProvider,
  GoogleAuthProvider,
  signOut as fbSignOut,
  type User,
} from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, onSnapshot, getDoc } from "firebase/firestore";

export type AuthStatus = "loading" | "anon" | "player" | "admin" | "signed-out";

interface AuthState {
  status: AuthStatus;
  /** true once Firebase has finished restoring the saved session (signed in OR not). */
  authReady: boolean;
  user: User | null;
  uid: string | null;
  idToken: string | null;
  isAdmin: boolean;
  isPlayer: boolean;
  soloMode: boolean;
  error: string | null;

  signIn: () => Promise<void>;
  signInWithGoogle: () => Promise<{ ok: boolean; error?: string }>;
  signInAdmin: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  /** Player login with email + password. */
  signInWithEmail: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  /** Create an email account. A guest session is upgraded in place, so its progress is kept. */
  signUpWithEmail: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  resetPassword: (email: string) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
  refresh: () => Promise<void>;
}

let unsubProfile: (() => void) | null = null;
let unsubAdmin: (() => void) | null = null;

const googleProvider = new GoogleAuthProvider();

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

/** Keep `isPlayer` in sync with players/{uid}. */
function watchProfile(uid: string) {
  if (unsubProfile) unsubProfile();
  unsubProfile = onSnapshot(
    doc(db, "players", uid),
    (snap) => {
      useAuth.setState((st) => ({
        isPlayer: snap.exists(),
        status: snap.exists() && st.status === "anon" ? "player" : st.status,
      }));
    },
    (err) => console.warn("[auth] profile listener:", err?.message)
  );
}

export const useAuth = create<AuthState>((set, get) => ({
  status: "loading",
  authReady: false,
  user: null,
  uid: null,
  idToken: null,
  isAdmin: false,
  isPlayer: false,
  soloMode: false,
  error: null,

  // Guest sign-in. If someone is ALREADY signed in (Google, saved guest...) keep them —
  // never replace a real session with a brand-new anonymous one.
  signIn: async () => {
    try {
      const existing = auth.currentUser;
      const user = existing ?? (await signInAnonymously(auth)).user;
      const token = await user.getIdToken();
      set((st) => ({
        status: st.status === "player" || !user.isAnonymous ? "player" : "anon",
        user,
        uid: user.uid,
        idToken: token,
        soloMode: false,
        error: null,
      }));
      watchProfile(user.uid);
    } catch (e: any) {
      console.warn("[auth] sign-in failed:", e?.message);
      set({ status: "signed-out", error: e?.message || "Sign-in failed" });
    }
  },

  signInWithGoogle: async () => {
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const token = await cred.user.getIdToken();
      set({
        status: "player",
        user: cred.user,
        uid: cred.user.uid,
        idToken: token,
        soloMode: false,
        error: null,
      });
      watchProfile(cred.user.uid);
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e?.message || "Google sign-in failed." };
    }
  },

  signInWithEmail: async (email, password) => {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const token = await cred.user.getIdToken();
      set({
        status: "player",
        user: cred.user,
        uid: cred.user.uid,
        idToken: token,
        soloMode: false,
        error: null,
      });
      watchProfile(cred.user.uid);
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e?.message || "Login failed." };
    }
  },

  signUpWithEmail: async (email, password) => {
    try {
      const current = auth.currentUser;
      let user: User;
      if (current && current.isAnonymous) {
        // Turn the guest into an email account: same uid, so nothing is lost.
        user = (await linkWithCredential(current, EmailAuthProvider.credential(email, password))).user;
      } else if (current) {
        return { ok: false, error: "You are already signed in. Log out first to make a different account." };
      } else {
        user = (await createUserWithEmailAndPassword(auth, email, password)).user;
      }
      const token = await user.getIdToken(true);
      set({
        status: "player",
        user,
        uid: user.uid,
        idToken: token,
        soloMode: false,
        error: null,
      });
      watchProfile(user.uid);
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e?.message || "Could not create the account." };
    }
  },

  resetPassword: async (email) => {
    try {
      await sendPasswordResetEmail(auth, email);
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e?.message || "Could not send the reset email." };
    }
  },

  signInAdmin: async (email, password) => {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const token = await cred.user.getIdToken();
      const adminDoc = await getDoc(doc(db, "admins", cred.user.uid));
      if (!adminDoc.exists()) {
        const badUid = cred.user.uid;
        await fbSignOut(auth);
        return {
          ok: false,
          error: `Not an admin account. The game looked for Firestore document admins/${badUid} and did not find it. Create exactly that document ID (copy it from here), with field admin = true (boolean).`,
        };
      }
      set({
        status: "admin",
        user: cred.user,
        uid: cred.user.uid,
        idToken: token,
        isAdmin: true,
        soloMode: false,
        error: null,
      });
      if (unsubAdmin) unsubAdmin();
      unsubAdmin = onSnapshot(doc(db, "admins", cred.user.uid), (snap) => {
        if (!snap.exists()) set({ isAdmin: false, status: "anon" });
      });
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e?.message || "Login failed." };
    }
  },

  signOut: async () => {
    if (unsubProfile) { unsubProfile(); unsubProfile = null; }
    if (unsubAdmin) { unsubAdmin(); unsubAdmin = null; }
    try { await fbSignOut(auth); } catch {}
    set({
      status: "signed-out",
      user: null,
      uid: null,
      idToken: null,
      isAdmin: false,
      isPlayer: false,
    });
  },

  getIdToken: async () => {
    const u = auth.currentUser;
    if (!u) return get().idToken;
    return await u.getIdToken();
  },

  refresh: async () => {
    const u = auth.currentUser;
    if (!u) return;
    const token = await u.getIdToken(true);
    set({ idToken: token });
  },
}));

// ---------------------------------------------------------------------------
// Restore the saved session on page load / refresh.
// Firebase calls this once at startup with the saved user (or null), then again
// whenever the user signs in or out. We NEVER auto-create an anonymous user here:
// that is what used to replace real sessions and make refresh look like a logout.
// ---------------------------------------------------------------------------
if (typeof window !== "undefined") {
  onAuthStateChanged(
    auth,
    async (user) => {
      try {
        if (user) {
          const token = await user.getIdToken();
          const cur = useAuth.getState();
          useAuth.setState({
            user,
            uid: user.uid,
            idToken: token,
            soloMode: false,
            status: cur.status === "admin" ? "admin" : user.isAnonymous ? "anon" : "player",
          });
          // Does this account already have a player profile? (don't wait forever)
          let exists = false;
          try {
            const snap = await withTimeout(getDoc(doc(db, "players", user.uid)), 5000);
            exists = snap.exists();
          } catch (e: any) {
            console.warn("[auth] profile check failed:", e?.message);
          }
          useAuth.setState((st) => ({
            isPlayer: exists || st.isPlayer,
            status: exists && st.status === "anon" ? "player" : st.status,
            authReady: true,
          }));
          watchProfile(user.uid);
        } else {
          const s = useAuth.getState();
          useAuth.setState({
            user: null,
            uid: null,
            idToken: null,
            isPlayer: false,
            status: s.status === "admin" ? "admin" : "signed-out",
            authReady: true,
          });
        }
      } catch (e: any) {
        console.warn("[auth] state handler failed:", e?.message);
        useAuth.setState({ status: "signed-out", authReady: true, error: e?.message || "Auth failed" });
      }
    },
    (err) => {
      console.warn("[auth] listener error:", err?.message);
      useAuth.setState({ status: "signed-out", authReady: true, error: err?.message || "Auth failed" });
    }
  );

  // Safety net: never sit on the splash screen forever (bad network etc.)
  window.setTimeout(() => {
    if (!useAuth.getState().authReady) {
      console.warn("[auth] restore timed out — continuing signed out");
      useAuth.setState({ authReady: true, status: "signed-out", error: "Auth timed out" });
    }
  }, 8000);
}
