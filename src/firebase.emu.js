// src/firebase.emu.js — TEST-ONLY firebase init: REAL production Auth + the
// LOCAL RTDB EMULATOR (:9000) so every game module transparently enforces the
// REAL FIREBASE_RULES.json locally (via scripts/emulator/database.rules.json).
// The Auth emulator is skipped (it needs `firebase login` in this sandbox);
// real Google-signed ID tokens are accepted by the RTDB emulator.
// This file is NOT imported by the production build.
import { initializeApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getDatabase, connectDatabaseEmulator } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyCjtRjbuATFkhVi7Kt76abxoiutSe2UnWo",
  authDomain: "kaduna-lifestyle.firebaseapp.com",
  projectId: "kaduna-lifestyle",
  storageBucket: "kaduna-lifestyle.firebasestorage.app",
  messagingSenderId: "209613220141",
  appId: "1:209613220141:web:9533109f032e47fb4d4ba4",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const authPersistReady = setPersistence(auth, browserLocalPersistence).catch(() => {});
// The emulator (demo mode) binds the RULES to the demo namespace only — target
// it explicitly, otherwise a second OPEN-rules namespace is created.
export const db = getDatabase(app, "https://demo-kaduna-default-rtdb.firebaseio.com");
connectDatabaseEmulator(db, "localhost", 9000);
