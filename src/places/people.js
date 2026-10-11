// src/places/people.js
// Helper for spawning believable people inside places.
// Uses createCharacter() from src/characters.js — never loads male.glb directly.
//
// export async function spawnPeople(group, specs)
//   specs: [{ id, name, role, outfit, pose, x, z, ry, route?, speed?, top?, skin? }]
//   returns { people, update(dt, now, px, pz), dispose() }
//
// Performance:
// - People are created one-per-frame (staggered) so entering never freezes.
// - Distance culling: hide + skip updates beyond 25 m from the player.
// - No per-frame allocations (reusable vectors).
// - dispose() removes only the per-person colour geometry; shared geometry/
//   material are left alone (other characters may still use them).

import * as THREE from "three";
import { createCharacter } from "../characters.js";

const CULL_DISTANCE = 25;
const CULL_DISTANCE_SQ = CULL_DISTANCE * CULL_DISTANCE;

// Reusable temp vectors (avoid per-frame allocation)
const _v = new THREE.Vector3();

export async function spawnPeople(group, specs) {
  const people = [];
  let spawnIdx = 0;

  // Spawn state first (so update can run even before models load)
  for (const s of specs) {
    people.push({
      id: s.id,
      name: s.name || "Person",
      role: s.role || "",
      spec: s,
      group: null,
      animate: null,
      ready: false,
      loading: false,
      // Route state
      route: s.route ? s.route.map((p) => ({ x: p.x, z: p.z })) : null,
      routeIdx: 0,
      speed: s.speed ?? 0.8,
      // Current position (used even before model loads)
      x: s.x,
      z: s.z,
      ry: s.ry || 0,
      moving: false,
      // Idle sway phase
      swayPhase: Math.random() * Math.PI * 2,
    });
  }

  // Spawn one person per frame (staggered) — returns true while still spawning
  let _spawnQueue = people.slice();
  function _spawnTick() {
    if (_spawnQueue.length === 0) return false;
    const p = _spawnQueue.shift();
    if (p.loading || p.ready) return _spawnQueue.length > 0;
    p.loading = true;
    const s = p.spec;
    createCharacter({
      seed: s.seed || (Math.abs(_hashStr(p.id + p.name)) % 100000),
      height: s.height || (1.62 + Math.random() * 0.23),
      outfit: s.outfit || "casual",
      pose: s.pose || "stand",
      top: s.top,
      bottom: s.bottom,
      skin: s.skin,
    }).then((ch) => {
      ch.group.position.set(p.x, 0, p.z);
      ch.group.rotation.y = p.ry;
      // Remote people inside places don't cast shadows (perf)
      ch.group.traverse((o) => {
        if (o.isMesh) { o.castShadow = false; o.frustumCulled = true; }
      });
      group.add(ch.group);
      p.group = ch.group;
      p.animate = ch.animate;
      p.ready = true;
      p.loading = false;
    }).catch(() => { p.loading = false; p.ready = false; });
    return true;
  }

  function update(dt, now, px, pz) {
    // Spawn one per frame
    _spawnTick();

    for (const p of people) {
      if (!p.ready || !p.group) continue;

      // Distance culling
      const dx = p.x - (px || 0), dz = p.z - (pz || 0);
      const distSq = dx * dx + dz * dz;
      if (distSq > CULL_DISTANCE_SQ) {
        p.group.visible = false;
        continue;
      }
      p.group.visible = true;

      // Route walking
      if (p.route && p.route.length > 1) {
        const target = p.route[p.routeIdx];
        const rdx = target.x - p.x, rdz = target.z - p.z;
        const rdist = Math.sqrt(rdx * rdx + rdz * rdz);
        if (rdist < 0.4) {
          // Reached waypoint — advance
          p.routeIdx = (p.routeIdx + 1) % p.route.length;
          p.moving = false;
        } else {
          const step = p.speed * dt;
          p.x += (rdx / rdist) * step;
          p.z += (rdz / rdist) * step;
          // Face direction of travel
          p.ry = Math.atan2(rdx, rdz);
          p.moving = true;
        }
        p.group.position.set(p.x, 0, p.z);
        p.group.rotation.y = p.ry;
        p.animate(dt, p.moving ? p.speed : 0);
      } else {
        // Standing / sitting — tiny idle sway (very cheap)
        p.swayPhase += dt * 1.5;
        if (p.group.position) {
          // Subtle breathing — only if pose is stand
          if ((p.spec.pose || "stand") === "stand") {
            p.group.position.y = Math.sin(p.swayPhase) * 0.005;
          }
        }
        p.animate(dt, 0);
      }
    }
  }

  function dispose() {
    for (const p of people) {
      if (!p.group) continue;
      group.remove(p.group);
      // Dispose only the per-person colour geometry; leave shared geometry alone
      p.group.traverse((o) => {
        if (o.isMesh && o.name === "__paint" && o.geometry) {
          o.geometry.dispose();
        }
      });
    }
    people.length = 0;
    _spawnQueue.length = 0;
  }

  function getPersonById(id) {
    return people.find((p) => p.id === id) || null;
  }

  return { people, update, dispose, getPersonById };
}

function _hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return h;
}

// Per-person dialogue lines (Nigerian English / light Pidgin / a little Hausa)
const DIALOGUE = {
  // Generic lines for unnamed NPCs
  _generic: [
    "Sannu! How you dey?",
    "You wan buy something?",
    "Kaduna sun hot today oo.",
    "Make you no rush, small small.",
    "I dey waka since morning.",
    "Abeg bring change.",
  ],
  // Per-role lines
  "fabric seller": [
    "My sister, this Ankara na quality. ₦5000, last price.",
    "You go like this color? E fit you well.",
    "Buy two, I go give you discount.",
    "Na original Hollandis, no be fake.",
  ],
  "spice trader": [
    "This pepper na real Kaduna pepper. Make you no touch your eye!",
    "Curry, nutmeg, turmeric — everything dey.",
    "Buy ₦500 own, I go add jara.",
    "Suya spice? I get the best yaji.",
  ],
  "tailor": [
    "Stand straight, let me take your measurement.",
    "Your agbada go ready by Friday.",
    "I dey sew since 6 AM, my brother.",
    "You want round neck or V-neck?",
  ],
  "vegetable seller": [
    "Fresh tomatoes! From Kawo farm this morning.",
    "Pepper, onion, garden egg — everything dey.",
    "Buy ₦200 own, I go add one extra.",
    "Na organic, no chemical.",
  ],
  "food corner": [
    "Tuwo and miyan kuka, hot hot!",
    "You want amala or semo?",
    "₦500 plate, I go give you plenty meat.",
    "Eat well, my customer.",
  ],
  "suya seller": [
    "Suya! Suya! Beef or chicken?",
    "Make I add extra yaji for you?",
    "₦1000 for full stick. You go enjoy am.",
    "This one just come off the fire.",
  ],
  "errand boy": [
    "Oga, you need anything? I fit run am.",
    "I dey help Mallam Audu since morning.",
    "Small boy, but I sabi road well well.",
  ],
  "Imam": [
    "Salam alaykum. May Allah bless your day.",
    "Salat is the key to paradise.",
    "May your heart find peace here.",
    "Come for Jumu'ah on Friday.",
  ],
  "entrance guard": [
    "Salam. Please remove your shoes inside.",
    "Dress modestly, my brother.",
    "The Imam dey inside if you want to talk.",
    "Quiet please, people dey pray.",
  ],
  "bus conductor": [
    "Kano! Kano! Two seats remaining!",
    "Enter make we go. ₦800 to Zaria.",
    "Oga, you dey go where?",
    "Bus go move when e full.",
  ],
  "bus driver": [
    "Make you sit down well. We dey move now.",
    "Road dey clear today, Alhamdulillah.",
    "Hold your ticket well.",
    "Next stop, Kawo junction.",
  ],
  "load carrier": [
    "I fit carry your load for ₦200.",
    "Strong man, I no dey tire.",
    "Where you dey go? I follow you.",
  ],
  "food vendor": [
    "Kunu and kosai! Hot and sweet!",
    "₦300 only. Come and chop.",
    "I get puff-puff too.",
    "This kunu go cool your body.",
  ],
  "park tout": [
    "You need keke? I fit call one for you.",
    "Oga, welcome to Kawo park.",
    "Make you no fear, we dey here.",
  ],
  "lecturer": [
    "Good morning class. Open your notebooks.",
    "Any questions before we continue?",
    "Assignment due next week — no late submission.",
    "Engineering is about problem-solving.",
  ],
  "student": [
    "Bros, you don do the assignment?",
    "Lecturer no dey come today, I hear.",
    "Exams next week, I never read oo.",
    "Let's go play football after class.",
  ],
  "cafeteria cook": [
    "Rice and stew, ₦400 only!",
    "You want chicken or fish?",
    "Eat fast before e finish.",
    "Student price, no worry.",
  ],
  "boutique cashier": [
    "That outfit fits you perfectly!",
    "We have a sale this week.",
    "Card or cash?",
    "Try it on if you like.",
  ],
  "cinema usher": [
    "Tickets here, please.",
    "The movie starts in 5 minutes.",
    "Screen 2 is on your right.",
    "No phones inside, abeg.",
  ],
  "food court vendor": [
    "Jollof, fried rice, chicken — everything dey.",
    "₦1000 plate. You go enjoy am.",
    "Spicy or mild?",
    "Cold Zobo to wash it down?",
  ],
  "doctor": [
    "What seems to be the problem?",
    "Malaria is common this season. Take your drugs.",
    "Drink plenty water and rest.",
    "Come back if you no feel better.",
  ],
  "nurse": [
    "Please sit, the doctor will see you soon.",
    "Have you taken your temperature?",
    "This way to the pharmacy.",
    "Make sure you finish your drugs.",
  ],
  "teller": [
    "Good morning. How can I help you?",
    "Please enter your PIN.",
    "Your balance is... do you want a receipt?",
    "Next teller, please.",
  ],
  "branch manager": [
    "Welcome to First Bank Kaduna.",
    "For loans, please fill this form.",
    "Your account is in good standing.",
    "Is there anything else I can help with?",
  ],
  "coach": [
    "Run faster! The match starts soon!",
    "Pass the ball! Teamwork!",
    "We need two goals to win.",
    "Drink water, stay hydrated.",
  ],
  "footballer": [
    "Pass! Pass! I'm open!",
    "Goal! That was a good one!",
    "Coach, put me in the second half.",
    "Kaduna United forever!",
  ],
  "fisherman": [
    "I dey fish here since I was small.",
    "Today catch dey small, but tomorrow dey.",
    "You wan try? I fit teach you.",
    "River Kaduna get plenty fish.",
  ],
  "park ranger": [
    "Welcome to Kaduna River Park.",
    "Please don't litter the water.",
    "Boat rides are ₦1000.",
    "The sunset here is beautiful.",
  ],
  "pastor": [
    "God bless you, my brother.",
    "Service starts at 10 AM on Sundays.",
    "May the Lord grant your requests.",
    "Join us for choir practice on Thursday.",
  ],
  "usher": [
    "Welcome to St. Bartholomew's.",
    "Sit anywhere you like.",
    "Bibles are in the pew pocket.",
    "Service starts in 10 minutes.",
  ],
  "barber": [
    "Sit down, my brother. What style you want?",
    "Skin fade or low cut?",
    "I go make you look sharp.",
    "You want beard trim too?",
  ],
  "customer": [
    "Musa, you sabi cut well well.",
    "I go wait my turn.",
    "This your shop fine oo.",
    "How much for clean shave?",
  ],
  "DJ": [
    "Everybody on the floor!",
    "This one na my new track!",
    "Make some noise, Kaduna!",
    "Next song go scatter the place!",
  ],
  "bouncer": [
    "₦1000 entry. Pay at the bar.",
    "No fighting inside, abeg.",
    "VIP is ₦5000.",
    "Enjoy your night, boss.",
  ],
  "bartender": [
    "What you wan drink?",
    "Zobo cocktail? I get am.",
    "₦500 per glass.",
    "Chill, I dey come.",
  ],
};

export function getDialogue(role, name) {
  const lines = DIALOGUE[role] || DIALOGUE._generic;
  return lines[Math.floor(Math.random() * lines.length)];
}

// Lines for specific named people (override role)
const NAMED_LINES = {
  "Mama Nkechi": [
    "My sister, Ankara na ₦5000. Quality no be small.",
    "You wan buy two? I go give you better price.",
    "This color go fit your skin well.",
    "Bring your friend next time, I get discount.",
  ],
  "Alhaji Sani": [
    "Sannu. My spice na the best in Kaduna.",
    "Pepper from Kano, curry from Sokoto.",
    "Buy ₦1000, I go add jara.",
    "Allah bless your trading.",
  ],
  "Aunty Bisi": [
    "Stand straight, let me measure you.",
    "Your agbada go ready by Friday.",
    "I sabi sew since I dey 15.",
    "You want Ankara or lace?",
  ],
  "Mallam Audu": [
    "Suya! Suya! Beef or chicken?",
    "Make I add extra yaji for you.",
    "₦1000 for full stick.",
    "This one just come off the fire.",
  ],
  "Yaro": [
    "Oga, you need anything? I fit run am.",
    "I dey help Mallam Audu.",
    "Small boy, but I sabi road.",
  ],
  "Imam Ibrahim": [
    "Salam alaykum. May Allah bless you.",
    "Salat is the key to paradise.",
    "Come for Jumu'ah on Friday.",
    "May your heart find peace here.",
  ],
  "Mallam Garba": [
    "Salam. Please remove your shoes.",
    "Dress modestly inside, my brother.",
    "Imam dey inside if you want to talk.",
    "Quiet please, people dey pray.",
  ],
  "Musa": [
    "Sit down, my brother. What style?",
    "Skin fade or low cut?",
    "I go make you look sharp.",
    "₦500 only, best in Kaduna.",
  ],
  "Dr. Aminu": [
    "Good morning class. Open your notebooks.",
    "Engineering is about problem-solving.",
    "Assignment due next week.",
    "Any questions?",
  ],
  "Fatima": [
    "Bros, you don do the assignment?",
    "Exams next week, I never read oo.",
    "Let's play football after class.",
  ],
  "Dr. Okafor": [
    "What seems to be the problem?",
    "Malaria is common this season.",
    "Drink plenty water and rest.",
    "Come back if you no feel better.",
  ],
  "Nurse Aisha": [
    "Please sit, doctor will see you soon.",
    "Have you taken your temperature?",
    "This way to the pharmacy.",
    "Finish your drugs, abeg.",
  ],
  "Mr. Bello": [
    "Good morning. How can I help you?",
    "Please enter your PIN.",
    "Your balance is... receipt?",
    "Next teller, please.",
  ],
  "Mrs. Okon": [
    "Welcome to First Bank Kaduna.",
    "For loans, fill this form.",
    "Your account is in good standing.",
  ],
  "Coach Daniel": [
    "Run faster! Match starts soon!",
    "Pass the ball! Teamwork!",
    "We need two goals to win.",
    "Drink water, stay hydrated.",
  ],
  "Pa Audu": [
    "I dey fish here since I was small.",
    "Today catch dey small, but tomorrow dey.",
    "You wan try? I fit teach you.",
  ],
  "Pastor John": [
    "God bless you, my brother.",
    "Service starts at 10 AM Sundays.",
    "May the Lord grant your requests.",
    "Join us for choir practice Thursday.",
  ],
  "Sister Mary": [
    "Welcome to St. Bartholomew's.",
    "Sit anywhere you like.",
    "Service starts in 10 minutes.",
  ],
  "DJ Zee": [
    "Everybody on the floor!",
    "This one na my new track!",
    "Make some noise, Kaduna!",
    "Next song go scatter the place!",
  ],
  "Big Mike": [
    "₦1000 entry. Pay at the bar.",
    "No fighting inside, abeg.",
    "VIP is ₦5000.",
    "Enjoy your night, boss.",
  ],
  "Glory": [
    "That outfit fits you perfectly!",
    "We have a sale this week.",
    "Card or cash?",
    "Try it on if you like.",
  ],
  "Emeka": [
    "Tickets here, please.",
    "The movie starts in 5 minutes.",
    "Screen 2 is on your right.",
    "No phones inside, abeg.",
  ],
  "Mr. Tunde": [
    "Jollof, fried rice, chicken — dey here.",
    "₦1000 plate. You go enjoy am.",
    "Spicy or mild?",
    "Cold Zobo to wash it down?",
  ],
  "Alhaji Tanko": [
    "Make you sit down well. We dey move.",
    "Road dey clear today, Alhamdulillah.",
    "Hold your ticket well.",
  ],
  "Mama Chinedu": [
    "Kunu and kosai! Hot and sweet!",
    "₦300 only. Come and chop.",
    "I get puff-puff too.",
  ],
  "Aunty Rabi": [
    "Rice and stew, ₦400 only!",
    "You want chicken or fish?",
    "Student price, no worry.",
  ],
};

export function getNamedDialogue(name) {
  const lines = NAMED_LINES[name];
  if (lines) return lines[Math.floor(Math.random() * lines.length)];
  return null;
}
