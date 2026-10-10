// src/multiplayer.js — real-time presence + chat
import { auth, db } from "./firebase.js";
import { ref, onValue, set, update, onDisconnect, push, serverTimestamp } from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";

const AVATAR_COLORS = ["#e11d48","#1d5fa8","#2e7d4f","#f2b134","#7a3b8f","#c0392b","#1a1a2e","#0f4d3a"];
let _uid=null, _name="Guest", _players={}, _meshes={}, _scene=null, _sendT=null, _onCount=null, _onChat=null;

export function initMultiplayer(scene, onCount, onChat) {
  _scene=scene; _onCount=onCount; _onChat=onChat;
  onAuthStateChanged(auth, (user) => {
    if (!user) return;
    _uid=user.uid;
    _name=user.displayName||user.email?.split("@")[0]||("Guest"+Math.floor(Math.random()*9999));
    const pRef=ref(db,"players/"+_uid);
    set(pRef,{name:_name,x:-9,z:11,heading:Math.PI,color:AVATAR_COLORS[Math.floor(Math.random()*AVATAR_COLORS.length)],ts:serverTimestamp()});
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

function updateAvatars() {
  if(!_scene) return;
  const seen=new Set();
  for(const [uid,d] of Object.entries(_players)) {
    seen.add(uid);
    if(!_meshes[uid]) {
      const g=new THREE.Group();
      const body=new THREE.Mesh(new THREE.CapsuleGeometry(0.3,0.8,4,8),new THREE.MeshLambertMaterial({color:d.color||"#e11d48"}));
      body.position.y=0.7; body.castShadow=true; g.add(body);
      const c=document.createElement("canvas"); c.width=256; c.height=64;
      const ctx=c.getContext("2d"); ctx.fillStyle="rgba(15,77,58,0.85)"; ctx.fillRect(0,0,256,64);
      ctx.fillStyle="#fff"; ctx.font="bold 28px Poppins,Arial"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(d.name||"Player",128,34);
      const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),depthTest:false}));
      sp.position.y=1.8; sp.scale.set(1.5,0.4,1); g.add(sp);
      _scene.add(g); _meshes[uid]=g;
    }
    _meshes[uid].position.set(d.x||0,0,d.z||0);
    _meshes[uid].rotation.y=d.heading||0;
  }
  for(const [uid,m] of Object.entries(_meshes)) {
    if(!seen.has(uid)) { _scene.remove(m); m.traverse(o=>{o.geometry?.dispose();o.material?.map?.dispose();o.material?.dispose();}); delete _meshes[uid]; }
  }
}

export function getMyUid(){return _uid;}
export function getMyName(){return _name;}
