// src/places/people.js — spawn believable people inside places.
// Uses createCharacter() from src/characters.js — never loads male.glb directly.
import * as THREE from "three";
import { createCharacter } from "../characters.js";

const CULL_DISTANCE_SQ = 25 * 25;

export async function spawnPeople(group, specs) {
  const people = [];
  for (const s of specs) {
    people.push({
      id: s.id, name: s.name || "Person", role: s.role || "", spec: s,
      group: null, animate: null, ready: false, loading: false,
      route: s.route ? s.route.map((p) => ({ x: p.x, z: p.z })) : null,
      routeIdx: 0, speed: s.speed ?? 0.8,
      x: s.x, z: s.z, ry: s.ry || 0, moving: false,
      swayPhase: Math.random() * Math.PI * 2,
    });
  }
  let _spawnQueue = people.slice();
  function _spawnTick() {
    if (!_spawnQueue.length) return false;
    const p = _spawnQueue.shift();
    if (p.loading || p.ready) return _spawnQueue.length > 0;
    p.loading = true;
    createCharacter({
      seed: p.spec.seed || (Math.abs(_hash(p.id + p.name)) % 100000),
      height: p.spec.height || (1.62 + Math.random() * 0.23),
      outfit: p.spec.outfit || "casual",
      pose: p.spec.pose || "stand",
      top: p.spec.top, bottom: p.spec.bottom, skin: p.spec.skin,
    }).then((ch) => {
      ch.group.position.set(p.x, 0, p.z);
      ch.group.rotation.y = p.ry;
      ch.group.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = true; } });
      // NAME TAG (Oct 21): floating name + role sprite above the NPC's head.
      // Like MyAbujaLife's "Ebere [STAFF]" — green background, white text.
      const tagText = p.name + (p.role ? " [" + p.role.toUpperCase() + "]" : "");
      const tagCanvas = document.createElement("canvas");
      tagCanvas.width = 256; tagCanvas.height = 48;
      const tctx = tagCanvas.getContext("2d");
      tctx.fillStyle = "rgba(15,77,58,0.88)";
      tctx.fillRect(0, 0, 256, 48);
      tctx.fillStyle = "#f2b134";
      tctx.fillRect(0, 0, 4, 48);
      tctx.fillStyle = "#fff";
      tctx.font = "bold 18px Poppins,Arial,sans-serif";
      tctx.textAlign = "center"; tctx.textBaseline = "middle";
      tctx.fillText(tagText.slice(0, 24), 130, 25, 240);
      const tagTex = new THREE.CanvasTexture(tagCanvas);
      const tagSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tagTex, depthTest: false, transparent: true }));
      tagSprite.position.y = 2.0;
      tagSprite.scale.set(1.4, 0.28, 1);
      tagSprite.userData = { isNameTag: true, npcId: p.id };
      ch.group.add(tagSprite);
      group.add(ch.group);
      p.group = ch.group; p.animate = ch.animate; p.ready = true; p.loading = false;
    }).catch(() => { p.loading = false; p.ready = false; });
    return true;
  }
  function update(dt, now, px, pz) {
    _spawnTick();
    for (const p of people) {
      if (!p.ready || !p.group) continue;
      const dx = p.x - (px || 0), dz = p.z - (pz || 0);
      const distSq = dx * dx + dz * dz;
      if (distSq > CULL_DISTANCE_SQ) { p.group.visible = false; continue; }
      p.group.visible = true;
      if (p.route && p.route.length > 1) {
        const target = p.route[p.routeIdx];
        const rdx = target.x - p.x, rdz = target.z - p.z;
        const rdist = Math.sqrt(rdx * rdx + rdz * rdz);
        if (rdist < 0.4) { p.routeIdx = (p.routeIdx + 1) % p.route.length; p.moving = false; }
        else { const step = p.speed * dt; p.x += (rdx / rdist) * step; p.z += (rdz / rdist) * step; p.ry = Math.atan2(rdx, rdz); p.moving = true; }
        p.group.position.set(p.x, 0, p.z); p.group.rotation.y = p.ry;
        p.animate(dt, p.moving ? p.speed : 0);
      } else {
        p.swayPhase += dt * 1.5;
        if ((p.spec.pose || "stand") === "stand") p.group.position.y = Math.sin(p.swayPhase) * 0.005;
        p.animate(dt, 0);
      }
    }
  }
  function dispose() {
    for (const p of people) {
      if (!p.group) continue;
      group.remove(p.group);
      p.group.traverse((o) => { if (o.isMesh && o.name === "__paint" && o.geometry) o.geometry.dispose(); });
    }
    people.length = 0; _spawnQueue.length = 0;
  }
  function getPersonById(id) { return people.find((p) => p.id === id) || null; }
  // HOUSE PARTY (Oct 25): register spawned people so the crowd can be made to
  // dance/gist together ("Together" / big sprays). Purged lazily when the
  // place that owns them is disposed (group removed from its parent).
  for (const p of people) _livePeople.add(p);
  return { people, update, dispose, getPersonById };
}
// ---- live place-NPC registry (weak-ish: purged on access) ----
const _livePeople = new Set();
function _purgeLivePeople() {
  for (const p of _livePeople) {
    if (!p.group || !p.group.parent) _livePeople.delete(p);
  }
}
// HOUSE PARTY (Oct 25): trigger a pose emote on every place NPC within radius
// of (x, z) — e.g. the whole room starts dancing when "Together" is pressed
// or a big money spray lands.
export function emotePeopleNearby(x, z, type, dur, radius = 12) {
  _purgeLivePeople();
  const r2 = radius * radius;
  for (const p of _livePeople) {
    if (!p.ready || !p.animate || !p.animate.emote) continue;
    const dx = p.x - x, dz = p.z - z;
    if (dx * dx + dz * dz > r2) continue;
    try { p.animate.emote(type, dur || 4); } catch (e) {}
  }
}
export function countPeopleNearby(x, z, radius = 12) {
  _purgeLivePeople();
  let n = 0; const r2 = radius * radius;
  for (const p of _livePeople) {
    const dx = p.x - x, dz = p.z - z;
    if (dx * dx + dz * dz <= r2) n++;
  }
  return n;
}
function _hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0; return h; }

const DIALOGUE = {
  _generic: ["Sannu! How you dey?", "You wan buy something?", "Kaduna sun hot today oo.", "Make you no rush, small small.", "I dey waka since morning.", "Abeg bring change."],
  "fabric seller": ["My sister, this Ankara na quality. ₦5000, last price.", "You go like this color? E fit you well.", "Buy two, I go give you discount.", "Na original Hollandis, no be fake."],
  "spice trader": ["This pepper na real Kaduna pepper.", "Curry, nutmeg, turmeric — everything dey.", "Buy ₦500 own, I go add jara.", "Suya spice? I get the best yaji."],
  "tailor": ["Stand straight, let me take your measurement.", "Your agbada go ready by Friday.", "I dey sew since 6 AM.", "You want round neck or V-neck?"],
  "food corner": ["Tuwo and miyan kuka, hot hot!", "You want amala or semo?", "₦500 plate, I go give you plenty meat.", "Eat well, my customer."],
  "suya seller": ["Suya! Suya! Beef or chicken?", "Make I add extra yaji for you?", "₦1000 for full stick.", "This one just come off the fire."],
  "errand boy": ["Oga, you need anything?", "I dey help Mallam Audu.", "Small boy, but I sabi road."],
  "Imam": ["Salam alaykum. May Allah bless your day.", "Salat is the key to paradise.", "May your heart find peace here.", "Come for Jumu'ah on Friday."],
  "entrance guard": ["Salam. Please remove your shoes inside.", "Dress modestly, my brother.", "The Imam dey inside.", "Quiet please, people dey pray."],
  "bus conductor": ["Kano! Kano! Two seats remaining!", "Enter make we go. ₦800 to Zaria.", "Oga, you dey go where?", "Bus go move when e full."],
  "bus driver": ["Make you sit down well.", "Road dey clear today, Alhamdulillah.", "Hold your ticket well."],
  "food vendor": ["Kunu and kosai! Hot and sweet!", "₦300 only. Come and chop.", "I get puff-puff too."],
  "park tout": ["You need keke? I fit call one.", "Oga, welcome to Kawo park."],
  "lecturer": ["Good morning class.", "Any questions?", "Assignment due next week.", "Engineering is about problem-solving."],
  "student": ["Bros, you don do the assignment?", "Exams next week, I never read oo.", "Let's play football after class."],
  "cafeteria cook": ["Rice and stew, ₦400 only!", "You want chicken or fish?", "Student price, no worry."],
  "boutique cashier": ["That outfit fits you perfectly!", "We have a sale this week.", "Card or cash?"],
  "cinema usher": ["Tickets here, please.", "The movie starts in 5 minutes.", "No phones inside, abeg."],
  "food court vendor": ["Jollof, fried rice, chicken — dey here.", "₦1000 plate.", "Cold Zobo to wash it down?"],
  "doctor": ["What seems to be the problem?", "Malaria is common this season.", "Drink plenty water and rest."],
  "nurse": ["Please sit, doctor will see you soon.", "Have you taken your temperature?", "Finish your drugs, abeg."],
  "teller": ["Good morning. How can I help you?", "Please enter your PIN.", "Next teller, please."],
  "branch manager": ["Welcome to First Bank Kaduna.", "For loans, fill this form."],
  "coach": ["Run faster! Match starts soon!", "Pass the ball! Teamwork!", "Drink water, stay hydrated."],
  "footballer": ["Pass! Pass! I'm open!", "Goal! That was good!", "Kaduna United forever!"],
  "fisherman": ["I dey fish here since I was small.", "Today catch dey small, but tomorrow dey.", "You wan try? I fit teach you."],
  "park ranger": ["Welcome to Kaduna River Park.", "Please don't litter the water.", "Boat rides are ₦1000."],
  "pastor": ["God bless you, my brother.", "Service starts at 10 AM Sundays.", "May the Lord grant your requests."],
  "usher": ["Welcome to St. Bartholomew's.", "Sit anywhere you like.", "Service starts in 10 minutes."],
  "barber": ["Sit down, my brother. What style?", "Skin fade or low cut?", "I go make you look sharp."],
  "DJ": ["Everybody on the floor!", "This one na my new track!", "Make some noise, Kaduna!"],
  "bouncer": ["₦1000 entry. Pay at the bar.", "No fighting inside, abeg.", "VIP is ₦5000."],
  "bartender": ["What you wan drink?", "₦500 per glass.", "Chill, I dey come."],
  "vice chancellor": ["Welcome to KASU, the Centre of Learning.", "Read your books — knowledge is power.", "Our campus is your home. Feel free.", "Aim for first class, my dear student."],
  "bookseller": ["Textbook na ₦600. E go boost your Quiz Night oo!", "Handout dey available for every course.", "You want past questions? I get am."],
  "quiz master": ["Welcome to Quiz Night! Win up to ₦6,750!", "Five questions. No cheating oo!", "Textbook owners dey win double here!"],
  "guard": ["Welcome to KASU campus.", "Show your ID card, abeg.", "Campus dey safe. No worry."],
  "cheerleader": ["KASU! KASU! We dey win!", "Come watch the match, e go sweet!", "Our team na the best!"],
  "exam officer": ["Exam dey start — no expo oo!", "Bring your textbook, e go help you!", "Quiet in the exam hall, abeg."],
  "graduation marshal": ["Graduation fee na ₦5,000!", "Come with your gown, the VC dey wait!", "Today you become graduate!"],
  "party host": ["Block-o tonight at Amina Hostel!", "₦800 only — come with your friends!", "We go dance till morning!"],
  "zookeeper": ["Welcome to Kaduna Zoo!", "No feed the animals without me, abeg.", "Simba the lion dey in good mood today."],
  "tour guide": ["Tour na ₦700 — you go see everything!", "Stay on the path, wetin dey cage no dey smile.", "Zoo open 9am to 6pm daily!"],
  "vet": ["All our animals dey healthy.", "Simba just finish check-up — e dey strong.", "Wildlife conservation matters, my friend."],
  "zoo vendor": ["Popcorn! Fresh popcorn! ₦300!", "Cold zobo and cookies dey too!", "No near the monkey cage with food oo!"],
  "rector": ["Welcome to Kaduna Polytechnic — the home of technology.", "Skill acquisition na the real deal. Learn handwork!", "Our workshop dey produce the best engineers.", "Aim for distinction in your ND!"],
  "workshop instructor": ["Safety first — wear your overall!", "Today na welding practical. No play!", "Measure twice, cut once!", "Your project must pass standard oo."],
  "mechanic": ["Bring am make I check the engine.", "Okada, keke, motor — I fit fix anything!", "You sabi turn spanner? Come learn!"],
  "carnival MC": ["Kaduna Carnival! Make some noise!", "Dance-Off winner go chop ₦4,000!", "One more time for the drummers!"],
  "drummer": ["Feel the beat — gbam gbam gbam!", "Gangan no dey lie. Follow the rhythm.", "Come learn the talking drum!"],
  "face painter": ["You want lion face or butterfly?", "₦400 — you go fine well well!", "Carnival no complete without face paint!"],
  "booth attendant": ["Ring toss ₦300 — win ₦1,000!", "Balloon darts! Test your aim!", "One try — you fit win big!"],
};
const NAMED = {
  "Mama Nkechi": ["My sister, Ankara na ₦5000. Quality no be small.", "You wan buy two? I go give you better price.", "This color go fit your skin well."],
  "Alhaji Sani": ["Sannu. My spice na the best in Kaduna.", "Pepper from Kano, curry from Sokoto.", "Buy ₦1000, I go add jara."],
  "Aunty Bisi": ["Stand straight, let me measure you.", "Your agbada go ready by Friday.", "You want Ankara or lace?"],
  "Mallam Audu": ["Suya! Suya! Beef or chicken?", "₦1000 for full stick.", "This one just come off the fire."],
  "Yaro": ["Oga, you need anything?", "I dey help Mallam Audu."],
  "Imam Ibrahim": ["Salam alaykum. May Allah bless you.", "Salat is the key to paradise.", "Come for Jumu'ah on Friday."],
  "Mallam Garba": ["Salam. Please remove your shoes.", "Dress modestly inside, my brother."],
  "Musa": ["Sit down, my brother. What style?", "Skin fade or low cut?", "₦500 only, best in Kaduna."],
  "Dr. Aminu": ["Good morning class.", "Engineering is about problem-solving.", "Any questions?"],
  "Fatima": ["Bros, you don do the assignment?", "Exams next week, I never read oo."],
  "Dr. Okafor": ["What seems to be the problem?", "Malaria is common this season.", "Drink plenty water and rest."],
  "Nurse Aisha": ["Please sit, doctor will see you soon.", "Finish your drugs, abeg."],
  "Mr. Bello": ["Good morning. How can I help you?", "Please enter your PIN."],
  "Mrs. Okon": ["Welcome to First Bank Kaduna.", "For loans, fill this form."],
  "Coach Daniel": ["Run faster! Match starts soon!", "Pass the ball! Teamwork!"],
  "Pa Audu": ["I dey fish here since I was small.", "You wan try? I fit teach you."],
  "Pastor John": ["God bless you, my brother.", "Service starts at 10 AM Sundays."],
  "Sister Mary": ["Welcome to St. Bartholomew's.", "Sit anywhere you like."],
  "DJ Zee": ["Everybody on the floor!", "Make some noise, Kaduna!"],
  "Big Mike": ["₦1000 entry. Pay at the bar.", "VIP is ₦5000."],
  "Glory": ["That outfit fits you perfectly!", "We have a sale this week."],
  "Emeka": ["Tickets here, please.", "No phones inside, abeg."],
  "Mr. Tunde": ["Jollof, fried rice, chicken — dey here.", "₦1000 plate."],
  "Alhaji Tanko": ["Make you sit down well.", "Road dey clear today."],
  "Mama Chinedu": ["Kunu and kosai! Hot and sweet!", "₦300 only."],
  "Aunty Rabi": ["Rice and stew, ₦400 only!", "Student price, no worry."],
  "Prof. Abdullahi": ["Welcome to KASU — Centre of Learning.", "Knowledge is light, my dear student.", "Aim for first class!"],
  "Mama Ngozi": ["Rice and beans dey hot! ₦400 only!", "You look hungry — come and chop!", "Student price, I go add extra stew."],
  "Mr. Danjuma": ["Quiz Night starts now! ₦500 per correct answer!", "Textbook owners dey win ×1.5 here!", "Who wan become a millionaire tonight?"],
  "DJ Zainab": ["KASU Arena, make some noise!", "This track na for you!", "Party no go finish tonight!"],
  "Coach Emeka": ["Sprint! Faster! You fit do am!", "Basketball court dey free — come play!", "Teamwork makes the dream work!"],
  "Mallam Bala": ["Textbook ₦600 — Quiz Night go pay you back!", "Past questions dey available!", "Buy your handout here, fresh print!"],
  "Officer Yusuf": ["Welcome to KASU campus.", "No noise after 10pm, abeg.", "Campus dey safe, no worry."],
  "Mrs. Danladi": ["Exam hall dey quiet — enter softly.", "Read your textbook, e go save you!", "No cheating — eyes right!"],
  "Chief Bello": ["Graduation fee ₦5,000 — come celebrate!", "Your certificate dey ready!", "Family go proud of you today!"],
  "Blessing": ["Block-o tonight! ₦800 only!", "Come with your crew, we go turnt!", "Amina Hostel parties no dey disappoint!"],
  "Alhaji Musa": ["Welcome to the zoo — no loud noise, abeg.", "Simba dey sleep now, come back later.", "Feeding time na 2pm!"],
  "Grace": ["Guided tour ₦700 — best value!", "The elephants na my favorite.", "Stay on the path, abeg!"],
  "Dr. Ngozi": ["All animals dey healthy today.", "I treat even lions — no fear.", "Conservation na our future."],
  "Hauwa": ["Popcorn ₦300! Hot hot!", "No carry food near monkeys oo!", "Cold drinks dey available!"],
  "Queen Ada": ["Welcome to Kaduna Carnival!", "Dance-Off dey soon — come win!", "Enjoy the rides, one love!"],
  "Baba Ola": ["Feel the gangan rhythm!", "Drum circle starts now — join us!", "The talking drum speaks your name."],
  "Ngozi": ["Lion face or butterfly — ₦400!", "You go shine for the parade!", "Face painting — carnival special!"],
  "Eddy": ["Ring toss — ₦300 to play!", "Balloon darts! Win ₦1,200!", "Try your luck, my friend!"],
  "Engr. Dr. Bala": ["Welcome to KADPOLY — home of technology.", "Skill + certificate = success, my dear.", "The workshop is your second classroom.", "Kadpoly students dey rule the tech world!"],
  "Mrs. Okolo": ["Exam hall dey quiet — enter softly.", "Read your textbook, e go save you!", "No cheating — eyes right!"],
  "Mallam Shehu": ["Textbook ₦600 — Quiz Night go pay you back!", "Engineering drawing set dey available!", "Past questions dey for every course!"],
  "Mr. Sani": ["KADPOLY Quiz Night starts now! ₦500 per correct answer!", "Five questions — no googling oo!", "Textbook owners dey win ×1.5 here!"],
  "DJ Bash": ["KADPOLY Arena, make some noise!", "This track na for my poly people!", "Party no go finish tonight!"],
  "Chief Audi": ["Graduation fee ₦5,000 — come celebrate!", "Your ND/HND certificate dey ready!", "The Rector go shake your hand today!"],
  "Bilkisu": ["Block-o tonight at Block C hostel!", "₦800 only — come with your crew!", "KADPOLY block-o no dey disappoint!"],
  "Engr. Nuhu": ["Wear your safety boots before you enter!", "Welding practical today — clean joints na ₦900!", "Engineers no dey fear work!"],
  "Uche": ["Your engine sabi knock o! Bring am come.", "I go teach you how to turn spanner.", "Fix engine, chop money!"],
  "Coach Tunde": ["Sprint! Faster! You fit do am!", "The field dey free — come play ball!", "Train hard, play hard!"],
};
export function getDialogue(role, name) { const l = DIALOGUE[role] || DIALOGUE._generic; return l[Math.floor(Math.random() * l.length)]; }
export function getNamedDialogue(name) { const l = NAMED[name]; return l ? l[Math.floor(Math.random() * l.length)] : null; }
