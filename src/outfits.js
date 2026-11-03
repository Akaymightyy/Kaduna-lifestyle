// src/outfits.js — outfit presets (colour sets + style) for men and women, used by the sign-up
// character creator and the in-game wardrobe. All original colour schemes.
// ---- the extra design keys an outfit can set (cleared whenever you switch outfit, so nothing stale is left behind) ----
export const OUTFIT_KEYS = ["top", "bottom", "shoes", "topStyle", "bottomStyle", "pattern", "pattern2", "accent", "under", "tie", "hat", "hatColor", "skirtColor", "jewel"];
export function applyOutfit(look, o) { for (const k of OUTFIT_KEYS) delete look[k]; return Object.assign(look, o); }

export const MEN_OUTFITS = [
  { id: "m-casual", name: "Casual Tee & Jeans", top: "#1f7a5a", bottom: "#2b3a55", shoes: "#f2f2ee", topStyle: "casual", bottomStyle: "trousers" },
  { id: "m-kaftan", name: "Kaftan (white)", top: "#f4efe4", bottom: "#f4efe4", shoes: "#8a5a3c", topStyle: "kaftan", bottomStyle: "trousers" },
  { id: "m-baban", name: "Baban Riga (sky)", top: "#9fc2d9", bottom: "#9fc2d9", shoes: "#8a5a3c", topStyle: "kaftan", bottomStyle: "trousers" },
  { id: "m-senator", name: "Senator (navy)", top: "#2d3a4a", bottom: "#2d3a4a", shoes: "#222222", topStyle: "kaftan", bottomStyle: "trousers" },
  { id: "m-street", name: "Street (red tee, shorts)", top: "#c0392b", bottom: "#3b3b3b", shoes: "#f2f2ee", topStyle: "casual", bottomStyle: "shorts" },
  { id: "m-corporate", name: "Corporate (blue shirt)", top: "#3c8dbc", bottom: "#1f2a36", shoes: "#222222", topStyle: "casual", bottomStyle: "trousers" },
  { id: "m-jogger", name: "Joggers & Hoodie", top: "#4a4a4a", bottom: "#2a2a2a", shoes: "#f2f2ee", topStyle: "casual", bottomStyle: "trousers" },
  { id: "m-ankara-2", name: "Ankara Native (green)", top: "#2e7d4f", bottom: "#1a5a3a", shoes: "#8a5a3c", topStyle: "kaftan", bottomStyle: "trousers" },
  { id: "m-danbani", name: "Dan Fani (indigo)", top: "#3b4a8a", bottom: "#2a3a6a", shoes: "#222222", topStyle: "kaftan", bottomStyle: "trousers" },
  { id: "m-jalabiya", name: "Jalabiya (gold trim)", top: "#e8c04a", bottom: "#c9a030", shoes: "#8a5a3c", topStyle: "kaftan", bottomStyle: "trousers" },
  // ---- NIGERIAN (Nov 3): agbada / buba & sokoto sets with woven + embroidered cloth, and a fila ----
  { id: "m-agbada-blue", name: "Agbada (royal blue & gold)", top: "#2a4fc0", bottom: "#2a4fc0", shoes: "#1d2f7a", topStyle: "agbada", bottomStyle: "trousers", pattern: "geo", accent: "#d4af37" },
  { id: "m-buba-green", name: "Buba & Sokoto (green/yellow)", top: "#2f8f3a", bottom: "#2f8f3a", shoes: "#2f8f3a", topStyle: "buba", bottomStyle: "trousers", pattern: "tri", accent: "#e6c82a" },
  { id: "m-agbada-white", name: "Agbada (white & red)", top: "#f4f1ec", bottom: "#f4f1ec", shoes: "#f2f2ee", topStyle: "agbada", bottomStyle: "trousers", pattern: "geo", accent: "#c4272d" },
  { id: "m-agbada-purple", name: "Agbada (purple & gold)", top: "#6a3fa8", bottom: "#6a3fa8", shoes: "#4a2a7a", topStyle: "agbada", bottomStyle: "trousers", pattern: "geo", accent: "#d4af37" },
  { id: "m-buba-orange", name: "Buba & Sokoto (orange swirl)", top: "#16120f", bottom: "#16120f", shoes: "#222222", topStyle: "buba", bottomStyle: "trousers", pattern: "spiral", accent: "#e8741c" },
  { id: "m-agbada-maroon", name: "Agbada (wine & gold)", top: "#7a1f3a", bottom: "#7a1f3a", shoes: "#3a1020", topStyle: "agbada", bottomStyle: "trousers", pattern: "geo", accent: "#d4af37" },
  // ---- WESTERN (Nov 3) ----
  { id: "m-suit-navy", name: "Navy Suit & Tie", top: "#1c2a55", bottom: "#1c2a55", shoes: "#4a2f1a", topStyle: "suit", bottomStyle: "trousers", under: "#f2f2ee", tie: "#16204a" },
  { id: "m-suit-grey", name: "Charcoal Suit", top: "#3a3d44", bottom: "#3a3d44", shoes: "#111111", topStyle: "suit", bottomStyle: "trousers", under: "#9fc0e0", tie: "#8a1f2a" },
  { id: "m-tweed", name: "Tweed Jacket & Chinos", top: "#8a7a62", bottom: "#1f2a4a", shoes: "#4a2f1a", topStyle: "tweed", bottomStyle: "trousers", under: "#8fb4d9" },
  { id: "m-trench", name: "Trench Coat & Hoodie", top: "#c9b28a", bottom: "#4a6a9a", shoes: "#f2f2ee", topStyle: "trench", bottomStyle: "trousers", under: "#1f2a5a" },
  { id: "m-tux", name: "Black Tuxedo", top: "#15161a", bottom: "#15161a", shoes: "#0a0a0a", topStyle: "tux", bottomStyle: "trousers" },
  { id: "m-sweater-green", name: "Green Sweater & Dark Jeans", top: "#3f6b3a", bottom: "#1f2a44", shoes: "#4a2f1a", topStyle: "sweater", bottomStyle: "trousers" },
  { id: "m-hoodie-navy", name: "Navy Hoodie & Beanie", top: "#1f2a55", bottom: "#4a6a9a", shoes: "#f2f2ee", topStyle: "hoodie", bottomStyle: "trousers", hat: "beanie", hatColor: "#1f2a44" },
  { id: "m-denim-jacket", name: "Denim Jacket & White Tee", top: "#4f7fb5", bottom: "#2a3550", shoes: "#f2f2ee", topStyle: "denim", bottomStyle: "trousers", under: "#f2f2ee" },
  { id: "m-shirt-white", name: "Smart Shirt & Trousers", top: "#f2f2ee", bottom: "#1f2a44", shoes: "#222222", topStyle: "shirt", bottomStyle: "trousers" },
];
export const WOMEN_OUTFITS = [
  { id: "w-ankara", name: "Ankara Gown (gold)", top: "#d98e2b", bottom: "#a23b72", shoes: "#222222", topStyle: "kaftan", bottomStyle: "gown" },
  { id: "w-abaya", name: "Abaya (black)", top: "#2e2e2e", bottom: "#2e2e2e", shoes: "#222222", topStyle: "kaftan", bottomStyle: "gown" },
  { id: "w-hijab-set", name: "Modest set (sage)", top: "#7aa58a", bottom: "#d9c7a0", shoes: "#f2f2ee", topStyle: "kaftan", bottomStyle: "gown" },
  { id: "w-blouse", name: "Blouse & Skirt (purple)", top: "#6b4a8a", bottom: "#2b3a55", shoes: "#c0392b", topStyle: "casual", bottomStyle: "skirt" },
  { id: "w-casual", name: "Crop top & Jeans", top: "#e8c547", bottom: "#44546a", shoes: "#f2f2ee", topStyle: "casual", bottomStyle: "trousers" },
  { id: "w-gown", name: "Evening Gown (wine)", top: "#a23b72", bottom: "#a23b72", shoes: "#222222", topStyle: "kaftan", bottomStyle: "gown" },
  { id: "w-ankara-2", name: "Ankara Two-Piece (teal)", top: "#1a8a7a", bottom: "#a23b72", shoes: "#222222", topStyle: "casual", bottomStyle: "trousers" },
  { id: "w-iro-buba", name: "Iro & Buba (coral)", top: "#e06a5a", bottom: "#d4a04a", shoes: "#8a5a3c", topStyle: "kaftan", bottomStyle: "gown" },
  { id: "w-hijab-dress", name: "Hijab Dress (olive)", top: "#6a7a4a", bottom: "#6a7a4a", shoes: "#222222", topStyle: "kaftan", bottomStyle: "gown" },
  { id: "w-jeans-top", name: "Off-shoulder & Jeans", top: "#d4577a", bottom: "#2a3a55", shoes: "#f2f2ee", topStyle: "casual", bottomStyle: "trousers" },
  // ---- NIGERIAN (Nov 3): iro & buba with gele + gold jewellery ----
  { id: "w-iro-blue", name: "Iro & Buba (royal blue & gold)", top: "#2a4fc0", bottom: "#2a4fc0", shoes: "#d4af37", topStyle: "iro", bottomStyle: "iro", pattern: "geo", accent: "#d4af37" },
  { id: "w-iro-green", name: "Iro & Buba (green/yellow)", top: "#2f8f3a", bottom: "#2f8f3a", shoes: "#d4af37", topStyle: "iro", bottomStyle: "iro", pattern: "tri", accent: "#e6c82a" },
  { id: "w-iro-white", name: "Iro & Buba (white & red)", top: "#f4f1ec", bottom: "#f4f1ec", shoes: "#d9d9d9", topStyle: "iro", bottomStyle: "iro", pattern: "plaid", pattern2: "plaid", accent: "#c4272d" },
  { id: "w-iro-purple", name: "Iro & Buba (purple & gold)", top: "#6a3fa8", bottom: "#6a3fa8", shoes: "#d4af37", topStyle: "iro", bottomStyle: "iro", pattern: "geo", accent: "#d4af37" },
  { id: "w-iro-orange", name: "Iro & Buba (orange swirl)", top: "#16120f", bottom: "#16120f", shoes: "#e8741c", topStyle: "iro", bottomStyle: "iro", pattern: "spiral", accent: "#e8741c" },
  { id: "w-iro-pink", name: "Iro & Buba (pink ankara)", top: "#c2417a", bottom: "#c2417a", shoes: "#d4af37", topStyle: "iro", bottomStyle: "iro", pattern: "wax", accent: "#f2b134" },
  // ---- WESTERN (Nov 3) ----
  { id: "w-blazer-skirt", name: "Grey Blazer & Skirt", top: "#4a4d55", bottom: "#4a4d55", shoes: "#111111", topStyle: "blazer", bottomStyle: "pencil", under: "#e8dccb" },
  { id: "w-blouse-trousers", name: "White Blouse & Navy Trousers", top: "#f4f1ec", bottom: "#1f2a44", shoes: "#222222", topStyle: "shirt", bottomStyle: "trousers" },
  { id: "w-denim-skirt", name: "Denim Jacket & Skirt", top: "#4f7fb5", bottom: "#2a3550", shoes: "#f2f2ee", topStyle: "denim", bottomStyle: "skirt", under: "#f2f2ee" },
  { id: "w-green-gown", name: "Emerald Evening Gown", top: "#0f6b4a", bottom: "#0f6b4a", shoes: "#0f6b4a", topStyle: "gown_v", bottomStyle: "gown" },
  { id: "w-turtle-leopard", name: "Mustard Turtleneck & Print Skirt", top: "#d9a22a", bottom: "#1a1a1a", shoes: "#8a6a1a", topStyle: "turtle", bottomStyle: "skirt_t", pattern2: "leopard", skirtColor: "#c9a35a", accent: "#8a6a3a" },
  { id: "w-hoodie-beanie", name: "Hoodie, Jeans & Beanie", top: "#1f2a55", bottom: "#4a6a9a", shoes: "#f2f2ee", topStyle: "hoodie", bottomStyle: "trousers", hat: "beanie", hatColor: "#1f2a44" },
  { id: "w-trench", name: "Trench Coat & Boots", top: "#c9b28a", bottom: "#1a1a1a", shoes: "#2a1a10", topStyle: "trench", bottomStyle: "trousers", under: "#1f2a5a" },
];
export const outfitsFor = (gender) => (gender === "female" ? WOMEN_OUTFITS : MEN_OUTFITS);
export const SKINS = ["#f1c9a5", "#c28a5c", "#a5714a", "#8a5a3c", "#7a4b2e", "#6b4429", "#5a3825", "#3d2517"];
export const HAIRS = ["#111111", "#2a1e14", "#4a3322", "#7a5a3a", "#c9b38a", "#a23b72", "#1d5fa8", "#f2f2ee"];
export const BUILDS = [
  { id: "slim", label: "Slim" },
  { id: "normal", label: "Normal" },
  { id: "big", label: "Big" },
];

// ---- Boutique catalogue. slot: outfit | head | shoes | wrist.  for: m | f | any ----
export const SHOP = [
  { id: "ankara", name: "Ankara Native", emoji: "👗", price: 3000, slot: "outfit", for: "m", desc: "Bold African print colours", patch: { top: "#d98e2b", bottom: "#a23b72", topStyle: "kaftan", bottomStyle: "trousers" }, fun: 15 },
  { id: "ankara-gown", name: "Ankara Gown", emoji: "👗", price: 3000, slot: "outfit", for: "f", desc: "Bold African print colours", patch: { top: "#d98e2b", bottom: "#a23b72", topStyle: "kaftan", bottomStyle: "gown" }, fun: 15 },
  { id: "babanriga", name: "Baban Riga", emoji: "🧥", price: 8000, slot: "outfit", for: "m", desc: "Northern Nigeria traditional", patch: { top: "#9fc2d9", bottom: "#9fc2d9", topStyle: "kaftan", bottomStyle: "trousers" }, social: 20 },
  { id: "agbada", name: "Agbada Set", emoji: "🥻", price: 6500, slot: "outfit", for: "m", desc: "Flowing robe", patch: { top: "#f4efe4", bottom: "#c9b38a", topStyle: "kaftan", bottomStyle: "trousers" }, social: 15 },
  { id: "senator", name: "Senator Suit", emoji: "🧑‍💼", price: 7000, slot: "outfit", for: "m", desc: "Navy senator wear", patch: { top: "#2d3a4a", bottom: "#2d3a4a", topStyle: "kaftan", bottomStyle: "trousers" }, social: 12 },
  { id: "abaya", name: "Abaya", emoji: "🧕", price: 5000, slot: "outfit", for: "f", desc: "Elegant black abaya", patch: { top: "#2e2e2e", bottom: "#2e2e2e", topStyle: "kaftan", bottomStyle: "gown" }, social: 12 },
  { id: "gown", name: "Evening Gown", emoji: "👗", price: 9000, slot: "outfit", for: "f", desc: "Wine evening gown", patch: { top: "#a23b72", bottom: "#a23b72", topStyle: "kaftan", bottomStyle: "gown" }, fun: 15 },
  { id: "kufi", name: "Kufi Cap", emoji: "🎩", price: 1500, slot: "head", for: "any", desc: "White traditional cap", acc: "kufi" },
  { id: "sneakers", name: "Designer Sneakers", emoji: "👟", price: 4000, slot: "shoes", for: "any", desc: "Fresh white sneakers", patch: { shoes: "#ffffff" } },
  { id: "watch", name: "Gold Watch", emoji: "⌚", price: 12000, slot: "wrist", for: "any", desc: "Status symbol", acc: "watch" },
];
export const SLOT_KEYS = { outfit: ["top", "bottom", "topStyle", "bottomStyle"], shoes: ["shoes"], head: [], wrist: [] };
