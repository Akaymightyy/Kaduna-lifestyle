// test_signin.js — tiny helper re-exporting signInWithEmailAndPassword so the
// harness does not need to pull the full auth.js UI module.
import { signInWithEmailAndPassword } from "firebase/auth";
export { signInWithEmailAndPassword as signInEmailPassword };
