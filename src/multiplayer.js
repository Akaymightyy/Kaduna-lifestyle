// src/multiplayer.js — real-time presence + chat with real GLB character avatars
import * as THREE from "three";
import { auth, db } from "./firebase.js";
import { ref, onValue, set, update, onDisconnect, push, serverTimestamp } from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";
import { createCharacter } from "./characters.js";


let _uid=null, _name="Guest", _players={}, _meshes={}, _scene=null, _sendT=null, _onCount=null, _onChat=null;

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
    set(pRef,{name:_name,x:-9,z:11,heading:Math.PI,ts:serverTimestamp()});
    onDisconnect(pRef).remove();
    onValue(ref(db,"players"),(s)=>{ _players=s.val()||{}; delete _players[_uid]; updateAvatars(); _onCount?.(Object.keys(_players).length+1); });
    onValue(ref(db,"chat"),(s)=>{ const m=s.val()||{}; const a=Object.values(m).sort((x,y)=>(x.ts||0)-(y.ts||0)); if(a.length&&_onChat) _onChat(a[a.length-1],a.length); });
  });
}

export function sendPosition(x,z,heading) {
  if(!_uid) return;
  if(_sendT) return; _sendT=setTimeout(()=>{_sendT=null;},200);
  update(ref(db,"players/"+_uid),{x,z,heading,ts:serverTimestamp()});
}

export function sendChat(text) {
  if(!_uid||!text.trim()) return;
  push(ref(db,"chat"),{uid:_uid,name:_name,text:text.trim().slice(0,200),ts:Date.now()});
}

async function createAvatarFor(uid, d) {
  try {
    const ch = await createCharacter({ seed: Math.abs(hashStr(uid)) % 100000, height: 1.75 });
    const model = ch.model;
    const group = ch.group;
    // Name tag sprite above head
    const tex = makeNameTag(d.name || "Player", d.color || "#f2b134");
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
    sp.position.y = 2.0; sp.scale.set(1.6, 0.4, 1);
    group.add(sp);
    _scene.add(group);
    _meshes[uid] = { group, model, walker: { animate: (dt, speed, moving) => ch.animate(dt, moving ? speed : 0) }, lastX: d.x||0, lastZ: d.z||0, phase: 0 };
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
    body.position.y = 0.7; body.castShadow = true; g.add(body);
    const tex = makeNameTag(d.name || "Player", d.color);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
    sp.position.y = 1.8; sp.scale.set(1.5, 0.4, 1); g.add(sp);
    _scene.add(g);
    _meshes[uid] = { group: g, model: null, walker: null, lastX: d.x||0, lastZ: d.z||0, phase: 0 };
    g.position.set(d.x||0, 0, d.z||0);
    g.rotation.y = d.heading||0;
  }
}

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return h;
}

function updateAvatars() {
  if(!_scene) return;
  const seen=new Set();
  let _dt = 0.016; // approx
  for(const [uid,d] of Object.entries(_players)) {
    seen.add(uid);
    if(!_meshes[uid]) {
      createAvatarFor(uid, d);
      continue;
    }
    const m = _meshes[uid];
    m.group.position.set(d.x||0, 0, d.z||0);
    m.group.rotation.y = d.heading||0;
    // Determine if moving (compare to last pos)
    const dx = (d.x||0) - m.lastX, dz = (d.z||0) - m.lastZ;
    const dist = Math.sqrt(dx*dx + dz*dz);
    const moving = dist > 0.05;
    const speed = Math.min(3, dist / _dt);
    m.lastX = d.x||0; m.lastZ = d.z||0;
    if (m.walker && moving) m.walker.animate(_dt, speed, true);
    else if (m.walker) m.walker.animate(_dt, 0, false);
  }
  for(const [uid,m] of Object.entries(_meshes)) {
    if(!seen.has(uid)) {
      _scene.remove(m.group);
      m.group.traverse(o => {
        o.geometry?.dispose();
        if (o.material) {
          if (o.material.map) o.material.map.dispose();
          o.material.dispose();
        }
      });
      delete _meshes[uid];
    }
  }
}

export function getMyUid(){return _uid;}
export function getMyName(){return _name;}
