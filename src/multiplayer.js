// src/multiplayer.js — real-time player presence + chat using Firebase Realtime DB
import { auth, db, ref, onValue, set, update, onDisconnect, remove, push, serverTimestamp, onAuthStateChanged } from "./firebase.js";

// Player presence: each player writes their position/heading to
//   /players/{uid} = { name, x, z, heading, lastSeen, color }
// On disconnect, the entry is removed.
// Other players' entries are listened to and rendered as simple avatar capsules.

const AVATAR_COLORS = ["#e11d48", "#1d5fa8", "#2e7d4f", "#f2b134", "#7a3b8f", "#c0392b", "#1a1a2e", "#0f4d3a"];
let _myUid = null;
let _myName = "Guest";
let _players = {};     // uid -> { name, x, z, heading, color }
let _avatarMeshes = {}; // uid -> THREE.Group
let _scene = null;
let _sendInterval = null;
let _onPlayerCount = null;
let _onChatMsg = null;
let _chatRef = null;

export function initMultiplayer(scene, onPlayerCount, onChatMsg) {
  _scene = scene;
  _onPlayerCount = onPlayerCount;
  _onChatMsg = onChatMsg;

  onAuthStateChanged(auth, (user) => {
    if (!user) return;
    _myUid = user.uid;
    _myName = user.displayName || user.email?.split("@")[0] || "Guest";
    if (user.isAnonymous) _myName = "Guest" + Math.floor(Math.random() * 9999);

    // Write initial presence
    const playerRef = ref(db, "players/" + _myUid);
    set(playerRef, {
      name: _myName,
      x: -9, z: 11, heading: Math.PI,
      color: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
      lastSeen: serverTimestamp()
    });

    // Remove on disconnect
    onDisconnect(playerRef).remove();

    // Listen for all players
    const allPlayersRef = ref(db, "players");
    onValue(allPlayersRef, (snap) => {
      _players = snap.val() || {};
      // Remove self from the list
      delete _players[_myUid];
      // Update avatars
      updateAvatars();
      // Report player count
      if (_onPlayerCount) _onPlayerCount(Object.keys(_players).length + 1);
    });

    // Listen for chat messages
    _chatRef = ref(db, "chat");
    onValue(_chatRef, (snap) => {
      const msgs = snap.val() || {};
      const arr = Object.values(msgs).sort((a, b) => (a.ts || 0) - (b.ts || 0));
      // Only fire for new messages
      if (arr.length > 0 && _onChatMsg) {
        _onChatMsg(arr[arr.length - 1], arr.length);
      }
    });
  });
}

// Send player position to Firebase (throttled to ~5x/second)
export function sendPosition(x, z, heading) {
  if (!_myUid) return;
  // Throttle: only send every 200ms
  if (_sendInterval) return;
  _sendInterval = setTimeout(() => { _sendInterval = null; }, 200);
  update(ref(db, "players/" + _myUid), { x, z, heading, lastSeen: serverTimestamp() });
}

// Send a chat message
export function sendChat(text) {
  if (!_myUid || !text.trim()) return;
  const chatRef = ref(db, "chat");
  push(chatRef, {
    uid: _myUid,
    name: _myName,
    text: text.trim().slice(0, 200),
    ts: Date.now()
  });
  // Clean up old messages (keep last 50)
  // This is a simple approach — in production you'd use a Cloud Function
}

// Update avatar meshes in the scene based on _players data
function updateAvatars() {
  if (!_scene) return;
  const seen = new Set();

  for (const [uid, data] of Object.entries(_players)) {
    seen.add(uid);
    if (!_avatarMeshes[uid]) {
      // Create a simple avatar: a colored capsule + name tag
      const group = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.3, 0.8, 4, 8),
        new THREE.MeshLambertMaterial({ color: data.color || "#e11d48" })
      );
      body.position.y = 0.7;
      body.castShadow = true;
      group.add(body);

      // Name tag (sprite)
      const canvas = document.createElement("canvas");
      canvas.width = 256; canvas.height = 64;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "rgba(15,77,58,0.85)";
      ctx.fillRect(0, 0, 256, 64);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 28px Poppins, Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(data.name || "Player", 128, 34);
      const tex = new THREE.CanvasTexture(canvas);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
      sprite.position.y = 1.8;
      sprite.scale.set(1.5, 0.4, 1);
      group.add(sprite);

      _scene.add(group);
      _avatarMeshes[uid] = group;
    }
    // Update position
    const mesh = _avatarMeshes[uid];
    mesh.position.set(data.x || 0, 0, data.z || 0);
    mesh.rotation.y = data.heading || 0;
    // Update name if changed
    if (data.name && mesh.userData.name !== data.name) {
      mesh.userData.name = data.name;
      // Update the sprite texture
      const sprite = mesh.children[1];
      if (sprite) {
        const canvas = document.createElement("canvas");
        canvas.width = 256; canvas.height = 64;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "rgba(15,77,58,0.85)";
        ctx.fillRect(0, 0, 256, 64);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 28px Poppins, Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(data.name, 128, 34);
        sprite.material.map = new THREE.CanvasTexture(canvas);
        sprite.material.needsUpdate = true;
      }
    }
  }

  // Remove avatars for players who left
  for (const [uid, mesh] of Object.entries(_avatarMeshes)) {
    if (!seen.has(uid)) {
      _scene.remove(mesh);
      mesh.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          if (o.material.map) o.material.map.dispose();
          o.material.dispose();
        }
      });
      delete _avatarMeshes[uid];
    }
  }
}

export function getMyUid() { return _myUid; }
export function getMyName() { return _myName; }
export function getPlayerCount() { return Object.keys(_players).length + 1; }
export function getPlayers() { return _players; }
