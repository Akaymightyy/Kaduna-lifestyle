// src/multiplayer.js — real-time presence + chat with real GLB character avatars
import * as THREE from "three";
import { auth, db } from "./firebase.js";
import { ref, onValue, set, update, onDisconnect, push, serverTimestamp } from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";
import { buildRemoteVehicleMesh, getSeat } from "./vehicles.js";
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
        // FIX v2 (Oct 19): was 180000 (3 min). Users were disappearing too
        // fast — heartbeat runs every 60s but if a player's heartbeat
        // silently failed (network blip, brief rules denial), they'd vanish
        // in 3 min. Extended to 600000 (10 min) as safety margin — even
        // if heartbeats fail briefly, players stay visible long enough for
        // the heartbeat to recover. Real offline status is set by
        // onDisconnect → online:false which is filtered above.
        if (now - t > 600000) continue;                       // not seen for 10 min: gone
        _players[k] = d;
      }
      updateAvatars(); _onCount?.(Object.keys(_players).length + 1);
    };
    const subscribePlayers = () => { _unsubPlayers = onValue(ref(db, "players"), (s) => apply(s.val())); };
    onValue(ref(db, "live"), (s) => apply(s.val()), () => { if (_unsubPlayers == null) subscribePlayers(); });
    // Keep "online" fresh so a quiet player is still listed.
    // FIX v2 (Oct 19): always run the heartbeat, even if _liveOk went false.
    // Previously a single transient failure (network blip, brief rules denial)
    // would flip _liveOk=false forever and the heartbeat would silently stop,
    // so a stopped player's timestamp aged out in 3 minutes and they
    // disappeared from other players' views. Now the heartbeat ALWAYS runs,
    // and on success it resets _liveOk=true so future sendPosition() calls
    // also try the live node again.
    setInterval(() => {
      if (!_uid) return;
      const liveRef2 = ref(db, "live/" + _uid);
      update(liveRef2, { ts: Date.now(), online: true })
        .then(() => { _liveOk = true; })     // recovered → re-enable live sync
        .catch(() => { _liveOk = false; });  // still failing → keep flagging
    }, 30000);  // every 30s — bumped from 60s for tighter freshness
    // (world chat is handled by worldchat.js)
  });
}

export function sendPosition(x,z,heading) {
  if(!_uid) return;
  if(_sendT) return; _sendT=setTimeout(()=>{_sendT=null;},200);
  update(ref(db,"players/"+_uid),{x,z,heading,ts:serverTimestamp()});
  if (_liveOk) update(ref(db,"live/"+_uid),{x,z,heading,place:_myPlace,online:true,ts:Date.now(),riding:_myRiding||null,passengerOf:_myPassengerOf||null}).catch(()=>{ _liveOk=false; });
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
// SYNC (Oct 19): tell other players what vehicle I'm currently riding
// (null = on foot). They'll render my avatar with a small 🏍️/🚗 badge
// above my name tag so they know I'm not just walking.
let _myRiding = null;
export function setMyRiding(vehicleId) {
  _myRiding = vehicleId || null;
  if (_uid && _liveOk) update(ref(db,"live/"+_uid),{riding:_myRiding}).catch(()=>{});
}
// SYNC (Oct 19): tell other players that I'm a passenger on another
// player's ride. They'll hide my avatar (I'm sitting on someone else's
// bike) and the driver will see me riding pillion.
let _myPassengerOf = null;
export function setMyPassengerOf(driverUid) {
  _myPassengerOf = driverUid || null;
  if (_uid && _liveOk) update(ref(db,"live/"+_uid),{passengerOf:_myPassengerOf}).catch(()=>{});
  updateAvatars();
}

export function sendChat(text) {
  if(!_uid||!text.trim()) return;
  push(ref(db,"chat"),{uid:_uid,name:String(_name||"Player").slice(0,30),text:text.trim().slice(0,200),ts:Date.now()});
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
    // isNameTag is used by _swapRidingMesh to find + lift the tag above the vehicle.
    sp.userData = { isRemotePlayer: true, playerUid: uid, playerName: d.name || "Player", isNameTag: true };
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
    sp.userData = { isRemotePlayer: true, playerUid: uid, playerName: d.name || "Player", isNameTag: true };
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
  const FAR = 500 * 500; // hide + skip animation beyond 500m (Oct 21: was 200m — players in outer districts couldn't see each other. Map is 580m wide so 500m covers most of it.)
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
    // SYNC (Oct 19): if this player is a passenger on MY ride, hide their
    // avatar — they're sitting on my bike, not walking around.
    if (d.passengerOf && d.passengerOf === _uid) { m.group.visible = false; continue; }
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
    // EMOTE BROADCAST (Oct 21): if this remote player has an active emote,
    // show the emoji sprite above their name tag. Clears when expired.
    _updateEmoteSprite(m, d);
    // HOUSE PARTY (Oct 25): actually PLAY the pose animation on the remote
    // avatar's character rig (dance/sit/spray/talk/together/wave...) — not
    // just the emoji badge. Everyone in the area sees what the person does.
    _applyRemotePose(m, d);
    // SYNC (Oct 19): if this remote player is riding, swap their walking
    // avatar for the ACTUAL VEHICLE 3D mesh. We keep their name tag
    // floating above the vehicle so you can still tell who's inside.
    // If they switch vehicles or dismount, dispose the old mesh first.
    if (m.riding !== (d.riding || null)) {
      const oldRiding = m.riding;
      m.riding = d.riding || null;
      _swapRidingMesh(m, oldRiding);
    }
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

// SYNC (Oct 19, v2): swap the walking-avatar for an ACTUAL VEHICLE 3D
// mesh when a remote player is riding. The avatar's character body is
// moved to the SEAT OFFSET (so it shows INSIDE the cabin of closed
// vehicles like danfo/jeep/ferrari, or sits ON TOP of open vehicles like
// okada/keke/bicycle). The name tag is lifted to roof level so it floats
// above the vehicle, telling viewers who's driving.
//
// Why we show the driver instead of hiding them: the user complained
// that the emoji-badge version was cheap and the hide-the-driver version
// made it look like the vehicle was driving itself. Now the driver is
// visible at the correct seat position. Test by viewing the vehicle
// from the FRONT and from the SIDE — the driver should appear sitting
// inside the cabin.
//
// Convention (matches vehicles.js):
//   seat = { f: forward (+X local), y: height above ground, s: left (-Z local) }
//   In avatar-group space (after the vehicle's -PI/2 rotation), vehicle-local
//   (f, y, -s) maps to group-local (s, y, f). So the character is positioned
//   at (s, y, f) in group space — same convention used by the local player.
const _ridingBuildInFlight = new Set();
function _swapRidingMesh(m, oldRiding) {
  // dispose old vehicle mesh if any
  if (m.vehicleMesh) {
    if (m.vehicleMesh.parent) m.vehicleMesh.parent.remove(m.vehicleMesh);
    if (!m.vehicleMesh.userData.shared) m.vehicleMesh.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); }
    });
    m.vehicleMesh = null;
  }
  // Restore the character body visibility + reset its seat offset
  if (m.ch && m.ch.model) {
    m.ch.model.visible = true;
    m.ch.model.position.set(0, 0, 0);
  }
  // If the player is no longer riding, we're done — they walk again
  if (!m.riding) return;
  // Don't fire duplicate builds
  const uid = m.playerUid;
  if (uid && _ridingBuildInFlight.has(uid)) return;
  if (uid) _ridingBuildInFlight.add(uid);
  // Position the character body at the seat offset (if the vehicle has one).
  // Vehicles without a seat keep the driver hidden (no clean place to sit).
  const seat = getSeat(m.riding);
  if (seat && m.ch && m.ch.model) {
    // (s, y, f) in group space = (f, y, -s) in vehicle local space, which is
    // exactly where the driver's hips/seat should be.
    m.ch.model.position.set(seat.s, seat.y, seat.f);
    m.ch.model.visible = true;
  } else if (m.ch && m.ch.model) {
    // No seat defined — hide the driver body to avoid clipping through the
    // vehicle's bodywork.
    m.ch.model.visible = false;
  }
  // Lift the name tag so it floats above the vehicle roof (not the head)
  for (const child of m.group.children) {
    if (child.isSprite && child.userData.isNameTag) {
      child.position.y = 2.6;  // was 2.0 (head level), now roof level
    }
  }
  // Build the actual vehicle mesh async (GLB load or box-geometry)
  buildRemoteVehicleMesh(m.riding).then((mesh) => {
    if (uid) _ridingBuildInFlight.delete(uid);
    if (!mesh) {
      console.warn("[multiplayer] vehicle mesh build failed for", m.riding);
      // restore avatar as fallback
      if (m.ch && m.ch.model) {
        m.ch.model.visible = true;
        m.ch.model.position.set(0, 0, 0);
      }
      return;
    }
    // Bail if the player dismounted while we were loading
    if (!m.riding) {
      mesh.traverse && mesh.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      return;
    }
    m.vehicleMesh = mesh;
    // Vehicle is a child of the avatar group so it inherits position +
    // rotation from the group. The character body is positioned at the
    // seat offset above (visible through the cabin windows).
    m.group.add(mesh);
    // Center the vehicle at the player's feet, nose pointing forward (+Z group)
    mesh.position.set(0, 0, 0);
    mesh.rotation.y = -Math.PI / 2;      // the model's nose is +X, the avatar group's forward is (sin h, cos h)
  }).catch((e) => {
    if (uid) _ridingBuildInFlight.delete(uid);
    console.warn("[multiplayer] vehicle build error:", e.message);
    if (m.ch && m.ch.model) {
      m.ch.model.visible = true;
      m.ch.model.position.set(0, 0, 0);
    }
  });
}

export function getMyUid(){return _uid;}
export function getMyName(){return _name;}
// HOUSE PARTY (Oct 25): expose my current room key ("" city, "home:<uid>",
// venue id) so the spray/chat systems can target "everyone in this room".
export function getMyPlace(){return _myPlace || "";}
// Remote players currently in MY room — [{ uid, name, x, z }] — used by the
// spray UI receiver list and the invite "nearby players" flow.
export function getPlayersInRoom() {
  const out = [];
  for (const [uid, d] of Object.entries(_players)) {
    if ((d.place || "") !== (_myPlace || "")) continue;
    out.push({ uid, name: d.name || "Player", x: d.x || 0, z: d.z || 0 });
  }
  return out;
}
// FEATURE: expose the remote-player meshes map so main.js can raycast against
// them on tap (for the "click another user's name to DM them" flow).
export function getRemotePlayers() { return _meshes; }
// SYNC (Oct 19): get UIDs of players who are passengers on my ride.
// Used by main.js to (a) drop them off when I dismount, (b) include them
// in the "is anyone on my ride?" check before picking up more.
export function getPassengerUids(driverUid) {
  const out = [];
  for (const [uid, d] of Object.entries(_players)) {
    if (d && d.passengerOf === driverUid) out.push(uid);
  }
  return out;
}
// SYNC (Oct 19): get the live data for a specific remote player (used by
// main.js to check "is player X currently riding?" before sending them
// a pickup invite).
export function getRemotePlayerData(uid) { return _players[uid] || null; }

// EMOTE BROADCAST (Oct 21): render an emote emoji sprite above a remote
// player's name tag when they broadcast an emote. The emote data comes from
// the live node: live/{uid} = { ..., emote, emoteDur, emoteTs }.
// When the emote expires (based on emoteDur + emoteTs), the sprite is removed.
const EMOTE_EMOJIS = {
  wave: "👋", dance: "🕺", clap: "👏", sit: "🪑", laugh: "😂",
  bow: "🙇", salute: "🫡", shrug: "🤷", thumbsup: "👍", peace: "✌️",
  spray: "🤑", talk: "💬", together: "🕺", bell: "🔔",
};
const EMOTE_DURATIONS = {
  wave: 3, dance: 5, clap: 3, sit: 0, laugh: 3,
  bow: 2, salute: 2, shrug: 2, thumbsup: 2, peace: 2,
  spray: 3, talk: 4, together: 6, bell: 2,
};
// ---- HOUSE PARTY (Oct 25): drive the remote avatar's bone rig with the
// pose emote. d = live/{uid} data: { emote, emoteDur, emoteTs }.
// dur 0 = persistent (sit) — stays until they clear it or start moving.
// We only re-trigger when the emote identity changes (type+ts), so calling
// this every frame is cheap.
function _applyRemotePose(m, d) {
  if (!m.ch || !m.ch.animate || !m.ch.animate.emote) return;
  const type = d ? d.emote : null;
  const ts = d ? d.emoteTs : 0;
  const dur = d && d.emoteDur != null ? d.emoteDur : EMOTE_DURATIONS[type];
  let active = false;
  if (type && EMOTE_DURATIONS[type] !== undefined) {
    if (!dur) active = true;                                   // persistent emote
    else if (ts) active = (Date.now() - ts) / 1000 < dur + 1;  // timed emote
  }
  const key = active ? type + ":" + (ts || 0) : "";
  if (key === m.lastPoseKey) return;
  m.lastPoseKey = key;
  if (active) m.ch.animate.emote(type, dur ? dur + 0.6 : 86400);
  else m.ch.animate.stopEmote();
}
function _updateEmoteSprite(m, d) {
  const emoteType = d?.emote;
  const emoteTs = d?.emoteTs;
  const emoteDur = d?.emoteDur ?? EMOTE_DURATIONS[emoteType];
  // Check if emote is active
  let active = false;
  if (emoteType && EMOTE_EMOJIS[emoteType]) {
    if (emoteDur === 0 || emoteDur == null) {
      // Persistent emote (like "sit") — stays until cleared
      active = true;
    } else if (emoteTs) {
      // Timed emote — check if expired
      const elapsed = (Date.now() - emoteTs) / 1000;
      active = elapsed < emoteDur;
    }
  }
  // Remove old emote sprite if no longer active or type changed
  if (m.emoteSprite) {
    const curType = m.emoteSprite.userData?.emoteType;
    if (!active || curType !== emoteType) {
      if (m.emoteSprite.parent) m.emoteSprite.parent.remove(m.emoteSprite);
      if (m.emoteSprite.material) {
        if (m.emoteSprite.material.map) m.emoteSprite.material.map.dispose();
        m.emoteSprite.material.dispose();
      }
      m.emoteSprite = null;
    }
  }
  // Add new emote sprite if active and not already shown
  if (active && !m.emoteSprite) {
    const emoji = EMOTE_EMOJIS[emoteType];
    const c = document.createElement("canvas");
    c.width = 64; c.height = 64;
    const ctx = c.getContext("2d");
    ctx.font = "44px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(emoji, 32, 34);
    const tex = new THREE.CanvasTexture(c);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    sp.position.y = 3.2;  // above the name tag (which is at 2.6)
    sp.scale.set(0.8, 0.8, 1);
    sp.userData = { emoteType };
    m.group.add(sp);
    m.emoteSprite = sp;
  }
}
