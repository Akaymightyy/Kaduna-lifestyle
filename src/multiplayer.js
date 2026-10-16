// src/multiplayer.js — real-time presence + chat with real GLB character avatars
import * as THREE from "three";
import { auth, db } from "./firebase.js";
import { ref, onValue, set, update, onDisconnect, push, serverTimestamp } from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";
import { createCharacter } from "./characters.js";


let _uid=null, _name="Guest", _players={}, _meshes={}, _scene=null, _sendT=null, _onCount=null, _onChat=null;
let _blocked = new Set();
let _myPlace="", _myLook=null, _liveOk=true, _unsubPlayers=null;

function makeNameTag(name, color) {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 64;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "rgba(15,77,58,0.85)";
  ctx.fillRect(0, 0, 256, 64);
  // color stripe on the left
  ctx.fillStyle = color || "#f2b134";
  ctx.fillRect(0, 0, 8, 64);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 24px Poppins,Arial,sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(name || "Player", 132, 34, 230);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

export function initMultiplayer(scene, onCount, onChat) {
  _scene=scene; _onCount=onCount; _onChat=onChat;
  onAuthStateChanged(auth, (user) => {
    if (!user) return;
    _uid=user.uid;
    _name=user.displayName||user.email?.split("@")[0]||("Guest"+Math.floor(Math.random()*9999));
    const pRef=ref(db,"players/"+_uid);
    // IMPORTANT: use update() not set() — set() wipes the entire player node, deleting
    // the saved look / origin / homeTier that other modules wrote. update() only patches
    // the presence / position fields we actually own here.
    update(pRef,{name:_name,x:-9,z:11,heading:Math.PI,ts:serverTimestamp(),online:true});
    // Only clear the "online" flag on disconnect — do NOT remove the whole player node,
    // otherwise look/origin/homeTier are lost between sessions.
    onDisconnect(pRef).update({online:false,ts:serverTimestamp()});
    // Who is around: read the PUBLIC "live" node (every signed-in player may read it). If the rules for it are not
    // published yet, fall back to the old "players" node (works for the admin only).
    const liveRef = ref(db, "live/" + _uid);
    update(liveRef, { name: _name, x: -9, z: 11, heading: Math.PI, place: "", online: true, ts: Date.now(), ...(_myLook ? { look: _myLook } : {}) }).catch(() => { _liveOk = false; });
    onDisconnect(liveRef).update({ online: false, ts: Date.now() }).catch(() => {});
    const apply = (val) => {
      const now = Date.now(), all = val || {};
      _players = {};
      for (const [k, d] of Object.entries(all)) {
        if (k === _uid || !d) continue;
        if (_blocked.has(k)) continue;                         // blocked by me: not drawn
        if (d.online === false) continue;
        const t = typeof d.ts === "number" ? d.ts : now;
        if (now - t > 180000) continue;                       // not seen for 3 minutes: gone
        _players[k] = d;
      }
      updateAvatars(); _onCount?.(Object.keys(_players).length + 1);
    };
    const subscribePlayers = () => { _unsubPlayers = onValue(ref(db, "players"), (s) => apply(s.val())); };
    onValue(ref(db, "live"), (s) => apply(s.val()), () => { if (_unsubPlayers == null) subscribePlayers(); });
    // keep "online" fresh so a quiet player is still listed
    setInterval(() => { if (_uid && _liveOk) update(ref(db, "live/" + _uid), { ts: Date.now(), online: true }).catch(() => {}); }, 60000);
    onValue(ref(db,"chat"),(s)=>{ const m=s.val()||{}; const a=Object.values(m).sort((x,y)=>(x.ts||0)-(y.ts||0)); if(a.length&&_onChat) _onChat(a[a.length-1],a.length); });
  });
}

export function sendPosition(x,z,heading) {
  if(!_uid) return;
  if(_sendT) return; _sendT=setTimeout(()=>{_sendT=null;},200);
  update(ref(db,"players/"+_uid),{x,z,heading,ts:serverTimestamp()});
  if (_liveOk) update(ref(db,"live/"+_uid),{x,z,heading,place:_myPlace,online:true,ts:Date.now()}).catch(()=>{ _liveOk=false; });
}
// Which room am I in? "" = outside in the city, "home:<ownerUid>" = inside that player's house, otherwise the place id.
// Other players only show up for me when we are in the SAME room (before, someone inside a house stood in the road
// for people outside, and nobody inside a house could be seen).
export function setMyPlace(key) {
  key = key || "";
  if (key === _myPlace) return;
  _myPlace = key;
  if (_uid && _liveOk) update(ref(db,"live/"+_uid),{place:_myPlace}).catch(()=>{});
  updateAvatars();
}
export function setMyLook(look) {
  _myLook = look || null;
  if (_uid && _liveOk && _myLook) update(ref(db,"live/"+_uid),{look:_myLook}).catch(()=>{});
}

export function sendChat(text) {
  if(!_uid||!text.trim()) return;
  push(ref(db,"chat"),{uid:_uid,name:_name,text:text.trim().slice(0,200),ts:Date.now()});
}

// BUGFIX: updateAvatars() runs on every Firebase update (~5/s) but building a character is async, so the same player was
// built several times at once: extra copies were added to the scene and never moved or removed (ghosts / stuck figures).
const _creating = new Set();
function createAvatarFor(uid, d) {
  if (_creating.has(uid)) return;
  _creating.add(uid);
  _buildAvatar(uid, d).finally(() => _creating.delete(uid));
}
// keep only plain colour / style strings so one odd saved field can never stop a character from being built
function _cleanLook(l) {
  const o = {}; l = l || {};
  for (const k of ["top", "bottom", "skin", "hair", "shoes", "topStyle", "bottomStyle", "gender", "build"]) if (typeof l[k] === "string") o[k] = l[k];
  return o;
}
function _disposeMesh(uid) {
  const m = _meshes[uid]; if (!m) return;
  _scene.remove(m.group);
  m.group.traverse((o) => {
    o.geometry?.dispose();
    if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); }
  });
  delete _meshes[uid];
}
async function _buildAvatar(uid, d) {
  try {
    // Use the player's saved look from Firebase (d.look), or fall back to seed
    const seed = Math.abs(hashStr(uid)) % 100000;
    let ch = null;
    for (const lk of [d.look || {}, _cleanLook(d.look), {}]) {
      try { ch = await createCharacter({ seed, height: 1.75, look: lk }); break; }
      catch (e) { console.warn("[multiplayer] avatar build failed, trying a simpler look", e); }
    }
    if (!ch) throw new Error("avatar build failed");
    if (!_players[uid] || _meshes[uid]) return;          // they left (or were built) while we were loading
    const model = ch.model;
    const group = ch.group;
    // PERFORMANCE: remote players don't cast shadows (only the local player does)
    group.traverse((o) => {
      if (o.isMesh) { o.castShadow = false; o.frustumCulled = true; }
    });
    // Name tag sprite above head
    const tex = makeNameTag(d.name || "Player", d.color || "#f2b134");
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
    sp.position.y = 2.0; sp.scale.set(1.6, 0.4, 1);
    // FEATURE: tag the sprite with userData so the main.js tap-raycaster can
    // detect when the player taps another user's name → open a DM with them.
    sp.userData = { isRemotePlayer: true, playerUid: uid, playerName: d.name || "Player" };
    group.userData = { isRemotePlayer: true, playerUid: uid, playerName: d.name || "Player" };
    group.add(sp);
    _scene.add(group);
    _meshes[uid] = { group, model, ch, builtGender: (ch.look && ch.look.gender) || "male", walker: { animate: (dt, speed, moving) => ch.animate(dt, moving ? speed : 0) }, lastX: d.x||0, lastZ: d.z||0, phase: 0, look: d.look };
    // Apply current position immediately
    group.position.set(d.x||0, 0, d.z||0);
    group.rotation.y = d.heading||0;
  } catch (e) {
    // Fall back to a simple capsule if model fails to load
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.3, 0.8, 4, 8),
      new THREE.MeshLambertMaterial({ color: d.color || "#e11d48" })
    );
    body.position.y = 0.7; body.castShadow = false; g.add(body);
    const tex = makeNameTag(d.name || "Player", d.color);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
    sp.position.y = 1.8; sp.scale.set(1.5, 0.4, 1); g.add(sp);
    // FEATURE: tag for tap-raycaster (same as the model-loaded branch above)
    sp.userData = { isRemotePlayer: true, playerUid: uid, playerName: d.name || "Player" };
    g.userData = { isRemotePlayer: true, playerUid: uid, playerName: d.name || "Player" };
    _scene.add(g);
    if (_meshes[uid]) return;
    _meshes[uid] = { group: g, model: null, walker: null, lastX: d.x||0, lastZ: d.z||0, phase: 0, fallback: true, retryAt: Date.now() + 6000 };
    g.position.set(d.x||0, 0, d.z||0);
    g.rotation.y = d.heading||0;
  }
}

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return h;
}

// Local player position (set from main.js each frame) so we can skip animating
// remote players who are too far away to be seen.
let _myX = 0, _myZ = 0;
export function setBlockedUids(list) { _blocked = new Set(list || []); updateAvatars(); }
export function setMyPosition(x, z) { _myX = x; _myZ = z; }

function updateAvatars() {
  if(!_scene) return;
  const seen=new Set();
  const _dt = 0.016; // approx
  const FAR = 80 * 80; // hide + skip animation beyond 80m
  for(const [uid,d] of Object.entries(_players)) {
    seen.add(uid);
    if(!_meshes[uid]) {
      createAvatarFor(uid, d);
      continue;
    }
    const m = _meshes[uid];
    const px = d.x||0, pz = d.z||0;
    // A red capsule is only the "could not build the character" stand-in: try the real character again
    if (m.fallback && Date.now() > m.retryAt) { _disposeMesh(uid); createAvatarFor(uid, d); continue; }
    if (d.look && !m.fallback) {
      // Different body (male <-> female)? A recolour cannot change that: build the right one
      if ((d.look.gender || "male") !== (m.builtGender || "male")) { _disposeMesh(uid); createAvatarFor(uid, d); continue; }
      // Outfit changed, or the look only arrived after the player was first drawn -> apply it
      if (!m.look || JSON.stringify(d.look) !== JSON.stringify(m.look)) {
        m.look = d.look;
        if (m.ch) import("./characters.js").then(({ recolorCharacter }) => recolorCharacter(m.ch, d.look));
      }
    }
    // Only show people who are in the same room as me (city / the same house / the same shop)
    if ((d.place || "") !== _myPlace) { m.group.visible = false; continue; }
    // Distance from local player
    const ddx = px - _myX, ddz = pz - _myZ;
    const distSq = ddx * ddx + ddz * ddz;
    if (distSq > FAR) {
      // Hide far players entirely — saves draw calls
      m.group.visible = false;
      continue;
    }
    m.group.visible = true;
    m.group.position.set(px, 0, pz);
    m.group.rotation.y = d.heading||0;
    // Determine if moving (compare to last pos)
    const dx = px - m.lastX, dz = pz - m.lastZ;
    const dist = Math.sqrt(dx*dx + dz*dz);
    const moving = dist > 0.05;
    const speed = Math.min(3, dist / _dt);
    m.lastX = px; m.lastZ = pz;
    if (m.walker && moving) m.walker.animate(_dt, speed, true);
    else if (m.walker) m.walker.animate(_dt, 0, false);
  }
  for(const [uid,m] of Object.entries(_meshes)) {
    if(!seen.has(uid)) _disposeMesh(uid);
  }
}

export function getMyUid(){return _uid;}
export function getMyName(){return _name;}
// FEATURE: expose the remote-player meshes map so main.js can raycast against
// them on tap (for the "click another user's name to DM them" flow).
export function getRemotePlayers() { return _meshes; }
