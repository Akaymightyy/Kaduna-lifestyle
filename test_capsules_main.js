// test_capsules_main.js — TEST-ONLY harness (served by vite.emulator.config.js).
// Loads the REAL capsules.js + moneyapi.js against the LOCAL RTDB EMULATOR
// (real rules, real SDK transactions) without booting the whole game (the
// full-game boot trips a known firebase-SDK/emulator snapshot-comparison quirk
// with the game's huge players/{uid} save tree — unrelated to this feature).
import { auth } from "/src/firebase.emu.js";
import { signInEmailPassword } from "/test_signin.js";
import { initCapsules, capsulesSetUid, buryCapsule, openCapsule, canOpen, capsulesDbg } from "/src/capsules.js";
import { db } from "/src/firebase.emu.js";
import { ref, get, set, update, push } from "firebase/database";
import { serverSpend, serverCredit, adoptMoney } from "/src/moneyapi.js";

initCapsules({ scene: null, getState: () => null, getName: () => "Tester", toast: (m) => console.log("[toast]", m), updateHUD: () => {}, celebrate: (t, s) => console.log("[celebrate]", t, s) });

let UID = null;

async function login(email, password) {
  const cred = await signInEmailPassword(auth, email, password);
  UID = cred.user.uid;
  capsulesSetUid(UID);
  return UID;
}
async function fund(amount) {
  if (!UID) throw new Error("not signed in");
  await set(ref(db, "economy/" + UID + "/balance"), amount);
  adoptMoney(amount, null, true);
  const s = await get(ref(db, "economy/" + UID + "/balance"));
  return s.val();
}
async function balance() {
  if (!UID) return null;
  const s = await get(ref(db, "economy/" + UID + "/balance"));
  return s.val();
}
async function wipe() {
  if (!UID) throw new Error("not signed in");
  await set(ref(db, "players/" + UID + "/capsules"), null);
  await set(ref(db, "economy/" + UID), null);
}
async function node(path) {
  const s = await get(ref(db, path));
  return s.val();
}
async function writeSecret(id, obj) { return set(ref(db, "capsuleSecrets/" + id), obj); }
async function writeMeta(id, obj) { return updateMeta(id, obj); }
async function updateMeta(id, patch) {
  return update(ref(db, "capsules"), Object.fromEntries(Object.entries(patch).map(([k, v]) => [id + "/" + k, v])));
}
async function token() {
  if (!auth.currentUser) return null;
  return auth.currentUser.getIdToken();
}
const setPos = (x, z) => { /* capsules.js reads its _px/_pz from tickCapsules; harness pokes via debug hook */ };

window.__t = { login, fund, balance, wipe, node, buryCapsule, openCapsule, canOpen, capsulesDbg, writeSecret, writeMeta, serverSpend, serverCredit, setPos, token, db, ref, get, set, update, push };
document.getElementById("st").textContent = "harness ready";
console.log("[harness] ready");
