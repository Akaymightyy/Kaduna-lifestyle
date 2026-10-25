// src/places/registry.js
// The Place Registry — every place in Kaduna Lifestyle is declared here.
//
// IMPORTANT: place modules are imported STATICALLY (not dynamic import) so
// they get bundled correctly by Vite. Dynamic import with @vite-ignore
// breaks in production because the relative path doesn't exist at runtime.
//
// Place shape:
//   id, name, type, worldX/Z, entranceX/Z, entranceFacing,
//   minimapIcon, minimapColor, hours, ambientSound, npcList, activities

// ---- STATIC IMPORTS (fixes "could not load" in production) ----
import * as central_market_mod from "./central_market.js";
import * as suya_spot_mod from "./suya_spot.js";
import * as central_mosque_mod from "./central_mosque.js";
import * as kawo_park_mod from "./kawo_park.js";
import * as university_mod from "./university.js";
import * as kasu_mod from "./kasu.js";
import * as zoo_mod from "./zoo.js";
import * as carnival_mod from "./carnival.js";
import * as mall_cinema_mod from "./mall_cinema.js";
import * as hospital_mod from "./hospital.js";
import * as bank_mod from "./bank.js";
import * as stadium_mod from "./stadium.js";
import * as river_park_mod from "./river_park.js";
import * as church_mod from "./church.js";
import * as barber_mod from "./barber.js";
import * as nightclub_mod from "./nightclub.js";
import * as home_mod from "./home.js";
import * as dealership_mod from "./dealership.js";
import * as arena_mod from "./arena.js";
import { enhanceInterior } from "../interior_enhance.js";

const MODULES = {
  central_market: central_market_mod,
  suya_spot: suya_spot_mod,
  central_mosque: central_mosque_mod,
  kawo_park: kawo_park_mod,
  university: university_mod,
  kasu: kasu_mod,
  zoo: zoo_mod,
  carnival: carnival_mod,
  mall_cinema: mall_cinema_mod,
  hospital: hospital_mod,
  bank: bank_mod,
  stadium: stadium_mod,
  river_park: river_park_mod,
  church: church_mod,
  barber: barber_mod,
  nightclub: nightclub_mod,
  home: home_mod,
  dealership: dealership_mod,
  arena: arena_mod,
};

const PLACE_DEFS = [
  {
    id: "central_market",
    name: "Kaduna Central Market",
    type: "interior",
    worldX: -30, worldZ: -25,
    entranceX: -28, entranceZ: -22,
    entranceFacing: Math.PI,
    minimapIcon: "🛒",
    minimapColor: 0xc0392b,
    hours: { open: 7, close: 20 },
    ambientSound: "market",
    npcList: [
      { id: "trader1", name: "Mama Nkechi", outfit: "ankara", role: "fabric seller" },
      { id: "trader2", name: "Alhaji Sani", outfit: "kaftan", role: "spice trader" },
      { id: "trader3", name: "Aunty Bisi", outfit: "ankara", role: "tailor" },
    ],
    activities: [
      { id: "haggle", label: "Haggle for fabric", desc: "Try to get the best price from Mama Nkechi" },
      { id: "buy_spices", label: "Buy spices", desc: "Stock up on dried pepper and curry" },
      { id: "tailor", label: "Tailor an outfit", desc: "Get measured by Aunty Bisi" },
      { id: "eat", label: "Eat at food corner", desc: "Hot tuwo and miyan kuka" },
    ],
  },
  {
    id: "suya_spot",
    name: "Mai Suya Spot",
    type: "outdoor",
    worldX: -55, worldZ: 22,
    entranceX: -53, entranceZ: 20,
    entranceFacing: 0,
    minimapIcon: "🍢",
    minimapColor: 0xd98e2b,
    hours: { open: 16, close: 24 },
    ambientSound: "street",
    npcList: [
      { id: "suya1", name: "Mallam Audu", outfit: "kaftan", role: "suya seller" },
      { id: "boy1", name: "Yaro", outfit: "casual", role: "errand boy" },
    ],
    activities: [
      { id: "order_suya", label: "Order suya", desc: "Beef or chicken suya with yaji pepper" },
      { id: "drink_zobo", label: "Buy zobo", desc: "Chilled zobo with cucumber" },
      { id: "chat", label: "Gist with the boys", desc: "Talk football and politics" },
    ],
  },
  {
    id: "central_mosque",
    name: "Central Mosque",
    type: "interior",
    worldX: 48, worldZ: 34,
    entranceX: 48, entranceZ: 20.5,
    entranceFacing: Math.PI,
    minimapIcon: "🕌",
    minimapColor: 0x1f7a5a,
    hours: null,
    ambientSound: "mosque",
    npcList: [
      { id: "imam", name: "Imam Ibrahim", outfit: "kaftan", role: "Imam" },
      { id: "guard1", name: "Mallam Garba", outfit: "kaftan", role: "entrance guard" },
    ],
    activities: [
      { id: "pray", label: "Pray", desc: "Restore mood and hygiene" },
      { id: "listen_adhan", label: "Listen to adhan", desc: "Call to prayer at salat times" },
      { id: "read_quran", label: "Read Quran", desc: "Quiet reflection" },
    ],
  },
  {
    id: "kawo_park",
    name: "Kawo Motor Park",
    type: "outdoor",
    worldX: -90, worldZ: -35,
    entranceX: -88, entranceZ: -32,
    entranceFacing: Math.PI / 2,
    minimapIcon: "🚌",
    minimapColor: 0xf2b134,
    hours: { open: 5, close: 22 },
    ambientSound: "motorpark",
    npcList: [
      { id: "conductor1", name: "Musa", outfit: "casual", role: "bus conductor" },
      { id: "driver1", name: "Alhaji Tanko", outfit: "kaftan", role: "bus driver" },
    ],
    activities: [
      { id: "board_bus", label: "Board bus to Zaria", desc: "Travel north — ₦800" },
      { id: "hire_keke", label: "Hire keke", desc: "Quick ride into town — ₦200" },
      { id: "hire_okada", label: "Hire okada", desc: "Fastest through traffic — ₦400" },
      { id: "eat_park", label: "Eat at park vendor", desc: "Hot kunu and kosai — ₦300" },
    ],
  },
  {
    id: "university",
    name: "Kaduna Polytechnic",
    type: "outdoor",
    worldX: 100, worldZ: -38,
    entranceX: 98, entranceZ: -34,
    entranceFacing: -Math.PI / 2,
    minimapIcon: "🎓",
    minimapColor: 0x1d5fa8,
    hours: { open: 6, close: 22 },
    ambientSound: "campus",
    npcList: [
      { id: "lecturer1", name: "Dr. Aminu", outfit: "kaftan", role: "lecturer" },
      { id: "student1", name: "Fatima", outfit: "casual", role: "student" },
      { id: "kadpoly_rector", name: "Engr. Dr. Bala", outfit: "kaftan", role: "rector" },
      { id: "kadpoly_exam", name: "Mrs. Okolo", outfit: "casual", role: "exam officer" },
      { id: "kadpoly_quiz", name: "Mr. Sani", outfit: "kaftan", role: "quiz master" },
      { id: "kadpoly_wsi", name: "Engr. Nuhu", outfit: "casual", role: "workshop instructor" },
    ],
    activities: [
      { id: "attend_lecture", label: "🎓 Attend lecture", desc: "Engineering Maths at LT1 — ₦500 stipend" },
      { id: "study_library", label: "📚 Study at library", desc: "Hit the books — brain +10" },
      { id: "eat_cafeteria", label: "🍝 Eat at cafeteria", desc: "Aunty Rabi's rice & beans — ₦400" },
      { id: "bookshop", label: "📖 Buy textbook", desc: "₦600 — boosts Quiz Night winnings ×1.5" },
      { id: "play_football", label: "⚽ Play football", desc: "Score on the KADPOLY field" },
      { id: "play_basketball", label: "🏀 Play basketball", desc: "Slam dunk on the court" },
      { id: "play_volleyball", label: "🏐 Play volleyball", desc: "Spike it with the squad" },
      { id: "sprint_race", label: "🏃 Sprint race", desc: "100m dash — beat your record" },
      { id: "workshop_practice", label: "🔧 Workshop practice", desc: "Weld & fabricate — earn ₦900" },
      { id: "fix_engine", label: "🛠️ Fix engine", desc: "Uche's auto bay — earn ₦800 per fix" },
      { id: "quiz_night", label: "🧠 Quiz Night", desc: "Win up to ₦6,750 in prize money!" },
      { id: "karaoke", label: "🎤 Karaoke", desc: "Sing at KADPOLY Arena — ₦300" },
      { id: "talent_show", label: "🎭 Talent show", desc: "Perform & earn tips" },
      { id: "debate_club", label: "🗣️ Debate club", desc: "Win the argument — ₦500 prize" },
      { id: "campus_party", label: "🎉 Campus party", desc: "Turn up with DJ Bash — ₦1000" },
      { id: "hangout", label: "🌳 Gist under the neem tree", desc: "Campus gist with friends" },
      { id: "rest_hostel", label: "😴 Rest at hostel", desc: "Block C Hostel — energy +40" },
      { id: "write_exam", label: "📝 Write exam", desc: "Exam season! Textbook = guaranteed pass + ₦1,500" },
      { id: "hostel_party", label: "🪩 Hostel party", desc: "Block C block-o with Bilkisu — ₦800" },
      { id: "graduation", label: "🎓 Graduation ceremony", desc: "₦5,000 — full ceremony, confetti & your ND/HND!" },
    ],
  },
  {
    id: "kasu",
    name: "KASU University",
    type: "outdoor",
    worldX: 160, worldZ: 30,
    entranceX: 160, entranceZ: 24,
    entranceFacing: Math.PI,
    minimapIcon: "🎓",
    minimapColor: 0x1f7a5a,
    hours: { open: 6, close: 22 },
    ambientSound: "campus",
    npcList: [
      { id: "kasu_vc", name: "Prof. Abdullahi", outfit: "kaftan", role: "vice chancellor" },
      { id: "kasu_lect1", name: "Dr. Yakubu", outfit: "kaftan", role: "lecturer" },
      { id: "kasu_stud1", name: "Hauwa", outfit: "casual", role: "student" },
      { id: "kasu_vendor", name: "Mama Ngozi", outfit: "casual", role: "cafeteria cook" },
      { id: "kasu_quiz", name: "Mr. Danjuma", outfit: "kaftan", role: "quiz master" },
    ],
    activities: [
      { id: "spray", label: "💸 Spray Money", desc: "Odogwu campus vibes" },
      { id: "together", label: "🕺 Together", desc: "Campus-wide dance!" },
      { id: "attend_lecture", label: "🎓 Attend lecture", desc: "GNS 101 at LT1 — ₦500 stipend" },
      { id: "study_library", label: "📚 Study at library", desc: "Hit the books — brain +10" },
      { id: "eat_cafeteria", label: "🍝 Eat at cafeteria", desc: "Mama Ngozi's rice & stew — ₦400" },
      { id: "bookshop", label: "📖 Buy textbook", desc: "₦600 — boosts Quiz Night winnings ×1.5" },
      { id: "play_football", label: "⚽ Play football", desc: "Score on the KASU field" },
      { id: "play_basketball", label: "🏀 Play basketball", desc: "Slam dunk on the court" },
      { id: "play_volleyball", label: "🏐 Play volleyball", desc: "Spike it with the squad" },
      { id: "sprint_race", label: "🏃 Sprint race", desc: "100m dash — beat your record" },
      { id: "quiz_night", label: "🧠 Quiz Night", desc: "Win up to ₦6,750 in prize money!" },
      { id: "karaoke", label: "🎤 Karaoke", desc: "Sing at KASU Arena — ₦300" },
      { id: "talent_show", label: "🎭 Talent show", desc: "Perform & earn tips" },
      { id: "debate_club", label: "🗣️ Debate club", desc: "Win the argument — ₦500 prize" },
      { id: "campus_party", label: "🎉 Campus party", desc: "Turn up with DJ Zainab — ₦1000" },
      { id: "hangout", label: "🌳 Gist under mango tree", desc: "Campus gist with friends" },
      { id: "rest_hostel", label: "😴 Rest at hostel", desc: "Amina Hostel — energy +40" },
      { id: "write_exam", label: "📝 Write exam", desc: "Exam season! Textbook = guaranteed pass + ₦1,500" },
      { id: "hostel_party", label: "🪩 Hostel party", desc: "Amina block-o with Blessing — ₦800" },
      { id: "graduation", label: "🎓 Graduation ceremony", desc: "₦5,000 — full ceremony, confetti & your degree!" },
      { id: "photo_mode", label: "📸 Photo Mode", desc: "Snap a KASU memory" },
    ],
  },
  {
    id: "zoo",
    name: "Kaduna Zoo",
    type: "outdoor",
    worldX: 200, worldZ: 32,
    entranceX: 200, entranceZ: 26,
    entranceFacing: Math.PI,
    minimapIcon: "🦁",
    minimapColor: 0xb5651d,
    hours: { open: 9, close: 18 },
    ambientSound: "campus",
    npcList: [
      { id: "zoo_keeper", name: "Alhaji Musa", outfit: "kaftan", role: "zookeeper" },
      { id: "zoo_guide", name: "Grace", outfit: "casual", role: "tour guide" },
      { id: "zoo_vet", name: "Dr. Ngozi", outfit: "casual", role: "vet" },
      { id: "zoo_vendor", name: "Hauwa", outfit: "casual", role: "zoo vendor" },
    ],
    activities: [
      { id: "feed_lion", label: "🦁 Feed the lions", desc: "Meat time! — ₦600" },
      { id: "feed_elephant", label: "🐘 Feed the elephants", desc: "Sugarcane & bananas — ₦400" },
      { id: "monkey_watch", label: "🐒 Monkey island", desc: "They will steal your popcorn lol" },
      { id: "croc_pond", label: "🐊 Crocodile pond", desc: "Watch your step!" },
      { id: "snake_show", label: "🐍 Snake show", desc: "Brave the python — earn tips!" },
      { id: "ostrich_feed", label: "🪶 Ostrich feeding", desc: "They run 70km/h! — ₦300" },
      { id: "guided_tour", label: "🚶 Guided zoo tour", desc: "Grace shows you everything — ₦700" },
      { id: "learn_centre", label: "🎓 Conservation class", desc: "Learn wildlife facts — brain +8" },
      { id: "post_animal", label: "📹 Animal video", desc: "Post a viral video — earn tips" },
      { id: "buy_snack", label: "🍿 Buy popcorn", desc: "Hauwa's kiosk — ₦300" },
      { id: "gift_shop", label: "🎁 Gift shop souvenir", desc: "Lion plushie — ₦900, mood boost!" },
      { id: "zoo_picnic", label: "🧺 Picnic on the lawn", desc: "Relax under the trees" },
      { id: "photo_mode", label: "📸 Photo Mode", desc: "Snap a wildlife selfie" },
    ],
  },
  {
    id: "carnival",
    name: "Kaduna Carnival",
    type: "outdoor",
    worldX: 0, worldZ: 46,
    entranceX: 0, entranceZ: 40,
    entranceFacing: Math.PI,
    minimapIcon: "🎪",
    minimapColor: 0xe11d48,
    hours: { open: 10, close: 23 },
    ambientSound: "street",
    npcList: [
      { id: "carn_mc", name: "Queen Ada", outfit: "casual", role: "carnival MC" },
      { id: "carn_drums", name: "Baba Ola", outfit: "kaftan", role: "drummer" },
      { id: "carn_paint", name: "Ngozi", outfit: "casual", role: "face painter" },
      { id: "carn_booth", name: "Eddy", outfit: "casual", role: "booth attendant" },
    ],
    activities: [
      { id: "spray", label: "💸 Spray Money", desc: "Rain on the whole carnival!" },
      { id: "together", label: "🕺 Together", desc: "Everybody dance at once!" },
      { id: "ride_ferris", label: "🎡 Ferris wheel", desc: "See the whole city! — ₦1000" },
      { id: "ride_carousel", label: "🎠 Carousel ride", desc: "Classic fun — ₦500" },
      { id: "dance_contest", label: "💃 Carnival Dance-Off", desc: "Hit the beat! Win up to ₦4,000!" },
      { id: "watch_parade", label: "🎺 Watch the parade", desc: "Floats, dancers & masquerades" },
      { id: "drum_circle", label: "🥁 Drum circle", desc: "Learn gangan from Baba Ola" },
      { id: "ring_toss", label: "🎯 Ring toss booth", desc: "₦300 to play — win ₦1,000!" },
      { id: "balloon_dart", label: "🎈 Balloon darts", desc: "₦300 to play — win ₦1,200!" },
      { id: "festival_food", label: "🍢 Festival food", desc: "Suya & kilishi galore — ₦500" },
      { id: "fura_drink", label: "🥛 Fura da nono", desc: "Ice-cold — ₦300" },
      { id: "face_paint", label: "🎨 Face painting", desc: "Look the part — ₦400" },
      { id: "costume_parade", label: "🥳 Join the masquerade", desc: "Dance through the grounds!" },
      { id: "fireworks", label: "🎆 Fireworks show", desc: "Boom! Boom! — fun +30" },
      { id: "photo_mode", label: "📸 Photo Mode", desc: "Snap a carnival memory" },
    ],
  },
  {
    id: "mall_cinema",
    name: "Kaduna Mall & Cinema",
    type: "interior",
    worldX: 130, worldZ: 32,
    entranceX: 130, entranceZ: 24,
    entranceFacing: Math.PI,
    minimapIcon: "🏬",
    minimapColor: 0x7a3b8f,
    hours: { open: 9, close: 23 },
    ambientSound: "mall",
    npcList: [
      { id: "cashier1", name: "Glory", outfit: "casual", role: "boutique cashier" },
      { id: "usher1", name: "Emeka", outfit: "casual", role: "cinema usher" },
    ],
    activities: [
      { id: "shop_clothes", label: "Shop for clothes", desc: "Designer outfits from ₦3000" },
      { id: "watch_movie", label: "Watch a movie", desc: "Nollywood premiere — ₦1500" },
      { id: "eat_foodcourt", label: "Eat at food court", desc: "Continental dishes from ₦1000" },
      { id: "browse", label: "Browse shops", desc: "Window shopping — fun +5" },
    ],
  },
  {
    id: "hospital",
    name: "Barau Dikko Hospital",
    type: "interior",
    worldX: -130, worldZ: -30,
    entranceX: -128, entranceZ: -27,
    entranceFacing: Math.PI / 2,
    minimapIcon: "🏥",
    minimapColor: 0xe11d48,
    hours: null,
    ambientSound: "hospital",
    npcList: [
      { id: "doctor1", name: "Dr. Okafor", outfit: "casual", role: "doctor" },
      { id: "nurse1", name: "Nurse Aisha", outfit: "casual", role: "nurse" },
    ],
    activities: [
      { id: "treat", label: "Get treatment", desc: "Full health restore — ₦2000" },
      { id: "checkup", label: "Health checkup", desc: "Diagnose sickness — ₦500" },
      { id: "buy_drugs", label: "Buy drugs", desc: "Pharmacy — from ₦200" },
      { id: "rest", label: "Rest in ward", desc: "Energy +30 — ₦1000" },
    ],
  },
  {
    id: "bank",
    name: "First Bank Kaduna",
    type: "interior",
    worldX: 70, worldZ: 38,
    entranceX: 70, entranceZ: 26,
    entranceFacing: Math.PI,
    minimapIcon: "🏦",
    minimapColor: 0x1a5a3a,
    hours: { open: 8, close: 16 },
    ambientSound: "bank",
    npcList: [
      { id: "teller1", name: "Mr. Bello", outfit: "casual", role: "teller" },
      { id: "manager1", name: "Mrs. Okon", outfit: "casual", role: "branch manager" },
    ],
    activities: [
      { id: "deposit", label: "Deposit money", desc: "Safely store your cash" },
      { id: "withdraw", label: "Withdraw money", desc: "Take out your savings" },
      { id: "loan", label: "Apply for loan", desc: "Borrow up to ₦50,000" },
      { id: "transfer", label: "Transfer money", desc: "Send to another player" },
    ],
  },
  {
    id: "stadium",
    name: "Ahmadu Bello Stadium",
    type: "outdoor",
    worldX: -100, worldZ: 38,
    entranceX: -100, entranceZ: 28,
    entranceFacing: Math.PI,
    minimapIcon: "⚽",
    minimapColor: 0x2e7d4f,
    hours: { open: 15, close: 22 },
    ambientSound: "stadium",
    npcList: [
      { id: "coach1", name: "Coach Daniel", outfit: "casual", role: "coach" },
      { id: "player1", name: "Ahmed", outfit: "casual", role: "footballer" },
    ],
    activities: [
      { id: "spray", label: "💸 Spray Money", desc: "Celebrate like a senator" },
      { id: "together", label: "🕺 Together", desc: "Stand united, dance united" },
      { id: "watch_match", label: "Watch a match", desc: "Fun +30 — ₦500" },
      { id: "play_match", label: "Join a match", desc: "Earn ₦1000 if you win" },
      { id: "buy_ticket", label: "Buy season ticket", desc: "₦5000 — discounts" },
      { id: "buy_snacks", label: "Buy snacks", desc: "Hunger +20 — ₦300" },
    ],
  },
  {
    id: "river_park",
    name: "Kaduna River Park",
    type: "outdoor",
    worldX: 120, worldZ: -38,
    entranceX: 118, entranceZ: -34,
    entranceFacing: -Math.PI / 2,
    minimapIcon: "🌊",
    minimapColor: 0x0ea5e9,
    hours: null,
    ambientSound: "river",
    npcList: [
      { id: "fisher1", name: "Pa Audu", outfit: "kaftan", role: "fisherman" },
      { id: "guard2", name: "Sergeant Idris", outfit: "casual", role: "park ranger" },
    ],
    activities: [
      { id: "fish", label: "Go fishing", desc: "Catch fish — sell for ₦200-800" },
      { id: "picnic", label: "Have a picnic", desc: "Mood +25, fun +15" },
      { id: "boat_ride", label: "Boat ride", desc: "Romantic — ₦1000, mood +30" },
      { id: "relax", label: "Relax by the water", desc: "Energy +20, mood +10" },
    ],
  },
  {
    id: "church",
    name: "St. Bartholomew's Church",
    type: "interior",
    worldX: -70, worldZ: 38,
    entranceX: -70, entranceZ: 26,
    entranceFacing: Math.PI,
    minimapIcon: "⛪",
    minimapColor: 0xc8b890,
    hours: { open: 6, close: 21 },
    ambientSound: "church",
    npcList: [
      { id: "pastor1", name: "Pastor John", outfit: "casual", role: "pastor" },
      { id: "usher2", name: "Sister Mary", outfit: "casual", role: "usher" },
    ],
    activities: [
      { id: "pray_church", label: "Pray", desc: "Mood +25, social +10" },
      { id: "attend_service", label: "Attend service", desc: "Sundays — mood +30" },
      { id: "choir", label: "Join choir practice", desc: "Fun +15, social +15" },
      { id: "donate", label: "Donate", desc: "Give ₦500 — mood +20" },
    ],
  },
  {
    id: "barber",
    name: "Musa's Barber Shop",
    type: "interior",
    worldX: 30, worldZ: -38,
    entranceX: 30, entranceZ: -30,
    entranceFacing: -Math.PI / 2,
    minimapIcon: "💈",
    minimapColor: 0x1a1a2e,
    hours: { open: 8, close: 20 },
    ambientSound: "barber",
    npcList: [
      { id: "barber1", name: "Musa", outfit: "casual", role: "barber" },
      { id: "customer1", name: "Sani", outfit: "kaftan", role: "customer" },
    ],
    activities: [
      { id: "haircut", label: "Get a haircut", desc: "Hygiene +20, fun +10 — ₦500" },
      { id: "beard_trim", label: "Trim beard", desc: "Hygiene +10 — ₦300" },
      { id: "shave", label: "Clean shave", desc: "Hygiene +25 — ₦400" },
      { id: "gossip", label: "Gist with Musa", desc: "Social +15, hear news" },
    ],
  },
  {
    id: "nightclub",
    name: "Kajuru Nightclub",
    type: "interior",
    worldX: 0, worldZ: -38,
    entranceX: 0, entranceZ: -30,
    entranceFacing: -Math.PI / 2,
    minimapIcon: "🪩",
    minimapColor: 0x6b21a8,
    hours: { open: 20, close: 4 },
    ambientSound: "club",
    npcList: [
      { id: "dj1", name: "DJ Zee", outfit: "casual", role: "DJ" },
      { id: "bouncer1", name: "Big Mike", outfit: "casual", role: "bouncer" },
    ],
    activities: [
      { id: "dance", label: "Dance", desc: "Fun +30, energy -10 — ₦1000" },
      { id: "spray", label: "💸 Spray Money", desc: "Make it rain in the club!" },
      { id: "together", label: "🕺 Together", desc: "Whole club dances!" },
      { id: "buy_drink", label: "Buy a drink", desc: "Social +10 — ₦500" },
      { id: "socialize", label: "Socialize", desc: "Meet people — social +20" },
      { id: "vip", label: "Book VIP table", desc: "₦5000 — fun +40, social +30" },
    ],
  },
  {
    id: "home",
    name: "My Home",
    type: "interior",
    worldX: -150, worldZ: 40,
    entranceX: -150, entranceZ: 37,
    entranceFacing: Math.PI,
    minimapIcon: "🏠",
    minimapColor: 0x2e7d4f,
    hours: null,
    ambientSound: null,
    npcList: [],
    activities: [
      // HOUSE SOCIAL BAR (Oct 25) — Lagos-Life style house party buttons
      { id: "spray", label: "💸 Spray", desc: "Make it rain on somebody" },
      { id: "dance", label: "💃 Dance", desc: "Show your moves" },
      { id: "together", label: "🕺 Together", desc: "Everybody dance!" },
      { id: "socialise", label: "🗣️ Socialise", desc: "Gist with the house" },
      { id: "house_chat", label: "💬 Message", desc: "House group chat" },
      { id: "ring_bell", label: "🔔 Ring Bell", desc: "Ding dong!" },
      { id: "sit", label: "🪑 Sit", desc: "Take a seat" },
      { id: "invite_guests", label: "✉️ Invite", desc: "Invite friends over" },
      { id: "house_settings", label: "⚙️ Settings", desc: "Who can enter + throw a party" },
      // Original home needs actions
      { id: "sleep", label: "Sleep (energy +40)", desc: "Rest in your bed" },
      { id: "eat_home", label: "Eat from fridge (hunger +30)", desc: "Grab food from the fridge" },
      { id: "tv", label: "Watch TV (fun +20)", desc: "Relax and watch TV" },
      { id: "shower", label: "Shower (hygiene +30)", desc: "Freshen up" },
      { id: "toilet", label: "Use toilet (bladder +40)", desc: "Relieve yourself" },
      { id: "photo_mode", label: "📸 Photo Mode", desc: "Hide UI + capture a screenshot for flexing" },
    ],
  },
  {
    id: "dealership",
    name: "Kaduna Motors",
    type: "interior",
    worldX: 60, worldZ: 38,
    entranceX: 60, entranceZ: 35,
    entranceFacing: Math.PI,
    minimapIcon: "🚗",
    minimapColor: 0xf2b134,
    hours: { open: 8, close: 20 },
    ambientSound: null,
    npcList: [],
    activities: [
      { id: "browse_cars", label: "Browse cars", desc: "Walk the showroom floor and tap any car to view" },
    ],
  },
  {
    id: "arena",
    name: "Kaduna Arena",
    type: "interior",
    worldX: -60, worldZ: -80,
    entranceX: -60, entranceZ: -77,
    entranceFacing: Math.PI / 2,
    minimapIcon: "🎮",
    minimapColor: 0xf2b134,
    hours: { open: 10, close: 24 },
    ambientSound: null,
    npcList: [],
    activities: [
      { id: "bowling", label: "🎳 Bowling", desc: "Roll a strike — coming soon" },
      { id: "pool", label: "🎱 Pool", desc: "Rack 'em up — coming soon" },
      { id: "arcade", label: "🕹️ Arcade", desc: "Insert coin — coming soon" },
      { id: "okada_dash", label: "🏍️ Okada Dash", desc: "Endless runner — coming soon" },
      { id: "browse", label: "👀 Look around", desc: "Hang out + meet people" },
    ],
  },
];

// ---- registry runtime state ----
const _loaded = new Map();
const _listeners = new Set();

export function listPlaces() {
  return PLACE_DEFS.map((d) => ({ ...d }));
}

export function getPlace(id) {
  return PLACE_DEFS.find((p) => p.id === id) || null;
}

// ---- Dynamic home entrance ----
// The home's entrance coordinates must be updated to match the player's actual
// plot position in their chosen area. Without this, the "Press here 🟢 to enter"
// prompt never shows at the player's house, and the "🏠 Home" button teleports
// them to the wrong place.
export function updateHomeEntrance(x, z, facing) {
  const home = getPlace("home");
  if (!home) return;
  home.worldX = x;
  home.worldZ = z;
  home.entranceX = x;
  home.entranceZ = z;
  if (facing != null) home.entranceFacing = facing;
}

export function findPlaceAtPosition(x, z, radius = 6) {
  for (const def of PLACE_DEFS) {
    const dx = def.entranceX - x, dz = def.entranceZ - z;
    if (dx * dx + dz * dz < radius * radius) return def;
  }
  return null;
}

export function isPlaceOpen(def, gameHour) {
  if (!def.hours) return true;
  if (def.hours.open <= def.hours.close) {
    return gameHour >= def.hours.open && gameHour < def.hours.close;
  }
  return gameHour >= def.hours.open || gameHour < def.hours.close;
}

// Build a place: look up its module statically, call build(). Cached.
export async function buildPlace(id, scene, ctx) {
  if (_loaded.has(id)) return _loaded.get(id).instance;
  const def = getPlace(id);
  if (!def) throw new Error("Unknown place: " + id);
  const mod = MODULES[id];
  if (!mod || !mod.build || typeof mod.build !== "function") {
    throw new Error("Place module for " + id + " not found or has no build()");
  }
  const instance = await mod.build(scene, ctx);
  // INTERIOR ENHANCEMENT (Oct 21): add common props (plants, ceiling lights,
  // bench, wall paintings) to interior places after they're built. Safe —
  // enhanceInterior returns early for outdoor places + home + dealership.
  try { if (instance?.group) enhanceInterior(instance.group, def); } catch (e) {}
  _loaded.set(id, { def, moduleExports: mod, instance });
  _notify("built", id);
  return instance;
}

export async function disposePlace(id) {
  const entry = _loaded.get(id);
  if (!entry) return;
  if (entry.instance?.dispose) {
    try { await entry.instance.dispose(); } catch (e) { console.warn("dispose error", e); }
  }
  _loaded.delete(id);
  _notify("disposed", id);
}

export function getLoadedPlace(id) {
  return _loaded.has(id) ? _loaded.get(id).instance : null;
}

export function subscribe(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}
function _notify(type, id) {
  for (const fn of _listeners) {
    try { fn({ type, id }); } catch (_) {}
  }
}

export function enterablePlaces(gameHour, playerX, playerZ, radius = 6) {
  const out = [];
  for (const def of PLACE_DEFS) {
    const dx = def.entranceX - playerX, dz = def.entranceZ - playerZ;
    const inRange = dx * dx + dz * dz < radius * radius;
    if (!inRange) continue;
    const open = isPlaceOpen(def, gameHour);
    out.push({ ...def, open });
  }
  return out;
}
