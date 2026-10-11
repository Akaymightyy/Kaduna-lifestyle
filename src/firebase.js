// src/firebase.js — Firebase init (Auth + Realtime DB)
import { initializeApp } from "firebase/app";
import { getAuth, setPersistence, browserSessionPersistence } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyCjtRjbuATFkhVi7Kt76abxoiutSe2UnWo",
  authDomain: "kaduna-lifestyle.firebaseapp.com",
  projectId: "kaduna-lifestyle",
  storageBucket: "kaduna-lifestyle.firebasestorage.app",
  messagingSenderId: "209613220141",
  appId: "1:209613220141:web:9533109f032e47fb4d4ba4"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// Login lasts only for this browser session: opening the game again asks for login / sign up.
export const authPersistReady = setPersistence(auth, browserSessionPersistence).catch(() => {});
export const db = getDatabase(app);
