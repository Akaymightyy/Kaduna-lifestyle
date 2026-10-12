// src/furniture.js — furniture catalog + storage + decorate mode helpers
// 30+ items, each with: id, name, category, price, comfort, size (grid cells), emoji, colors
// Bought items saved to Firebase: players/{uid}/storage = [{id, color}]
// Placed items saved to Firebase: players/{uid}/homeFurniture = [{id, x, z, rot, color}]

export const FURNITURE_CATALOG = [
  // Bedroom
  { id: "bed_single", name: "Single Bed", cat: "Bedroom", price: 5000, comfort: 15, w: 2, d: 3, emoji: "🛏️", colors: ["#8b5a3c", "#1a1a2e", "#2d3a4a"] },
  { id: "bed_double", name: "Double Bed", cat: "Bedroom", price: 12000, comfort: 25, w: 3, d: 3, emoji: "🛏️", colors: ["#8b5a3c", "#1a1a2e", "#4a1a5e"] },
  { id: "wardrobe", name: "Wardrobe", cat: "Bedroom", price: 4000, comfort: 5, w: 2, d: 1, emoji: "🚪", colors: ["#8b5a3c", "#5a4a30", "#2d3a4a"] },
  { id: "mattress", name: "Memory Foam Mattress", cat: "Bedroom", price: 3000, comfort: 10, w: 2, d: 3, emoji: "🟫", colors: ["#f0f0f0", "#e0d0c0"] },
  // Living Room
  { id: "sofa_3seater", name: "3-Seater Sofa", cat: "Living", price: 8000, comfort: 20, w: 3, d: 1, emoji: "🛋️", colors: ["#2e7d4f", "#1d5fa8", "#8b5a3c", "#c0392b"] },
  { id: "sofa_2seater", name: "2-Seater Sofa", cat: "Living", price: 5000, comfort: 12, w: 2, d: 1, emoji: "🛋️", colors: ["#2e7d4f", "#1d5fa8", "#8b5a3c"] },
  { id: "tv_stand", name: "TV Stand", cat: "Living", price: 3000, comfort: 3, w: 2, d: 1, emoji: "📺", colors: ["#1a1a2e", "#5a4a30"] },
  { id: "tv_32", name: '32" TV', cat: "Living", price: 6000, comfort: 15, w: 2, d: 1, emoji: "📺", colors: ["#1a1a1a"] },
  { id: "rug_large", name: "Large Rug", cat: "Living", price: 2500, comfort: 8, w: 3, d: 2, emoji: "🟫", colors: ["#c0392b", "#1d5fa8", "#2e7d4f", "#f2b134"] },
  { id: "center_table", name: "Center Table", cat: "Living", price: 2000, comfort: 3, w: 2, d: 1, emoji: "🪵", colors: ["#8b5a3c", "#5a4a30"] },
  // Kitchen
  { id: "gas_cooker", name: "Gas Cooker", cat: "Kitchen", price: 7000, comfort: 5, w: 1, d: 2, emoji: "🔥", colors: ["#555", "#1a1a1a"] },
  { id: "fridge", name: "Fridge", cat: "Kitchen", price: 10000, comfort: 8, w: 1, d: 1, emoji: "🧊", colors: ["#e0e0e0", "#c0c0c0"] },
  { id: "microwave", name: "Microwave", cat: "Kitchen", price: 4000, comfort: 3, w: 1, d: 1, emoji: "📟", colors: ["#1a1a1a", "#555"] },
  { id: "dining_table", name: "Dining Table", cat: "Kitchen", price: 5000, comfort: 5, w: 3, d: 2, emoji: "🍽️", colors: ["#8b5a3c", "#5a4a30"] },
  { id: "water_dispenser", name: "Water Dispenser", cat: "Kitchen", price: 3500, comfort: 2, w: 1, d: 1, emoji: "💧", colors: ["#e0e0e0", "#1a1a1a"] },
  // Power
  { id: "generator", name: "Generator", cat: "Power", price: 15000, comfort: 10, w: 2, d: 1, emoji: "⚡", colors: ["#1a1a1a", "#555"] },
  { id: "standing_fan", name: "Standing Fan", cat: "Power", price: 2000, comfort: 5, w: 1, d: 1, emoji: "🌀", colors: ["#e0e0e0", "#555"] },
  { id: "ac_unit", name: "AC Unit", cat: "Power", price: 20000, comfort: 15, w: 1, d: 1, emoji: "❄️", colors: ["#e0e0e0", "#fff"] },
  { id: "solar_panel", name: "Solar Panel", cat: "Power", price: 25000, comfort: 12, w: 2, d: 1, emoji: "☀️", colors: ["#1a1a3e", "#2d3a5e"] },
  // Decor
  { id: "plant_small", name: "Small Plant", cat: "Decor", price: 1000, comfort: 3, w: 1, d: 1, emoji: "🪴", colors: ["#2e7d4f"] },
  { id: "plant_large", name: "Large Plant", cat: "Decor", price: 2500, comfort: 5, w: 1, d: 1, emoji: "🌳", colors: ["#2e7d4f"] },
  { id: "painting", name: "Wall Painting", cat: "Decor", price: 1500, comfort: 4, w: 1, d: 1, emoji: "🖼️", colors: ["#8b5a3c", "#1a1a2e"] },
  { id: "photo_frame", name: "Photo Frame", cat: "Decor", price: 800, comfort: 2, w: 1, d: 1, emoji: "📷", colors: ["#8b5a3c", "#1a1a2e"] },
  { id: "prayer_mat", name: "Prayer Mat", cat: "Decor", price: 2000, comfort: 8, w: 1, d: 2, emoji: "🕌", colors: ["#1f7a5a", "#c0392b", "#1d5fa8"] },
  { id: "trophy", name: "Trophy", cat: "Decor", price: 5000, comfort: 10, w: 1, d: 1, emoji: "🏆", colors: ["#f2b134"] },
  // Outdoor
  { id: "gate", name: "Gate", cat: "Outdoor", price: 8000, comfort: 5, w: 1, d: 1, emoji: "🚪", colors: ["#555", "#1a1a1a"] },
  { id: "palm_tree", name: "Palm Tree", cat: "Outdoor", price: 3000, comfort: 4, w: 1, d: 1, emoji: "🌴", colors: ["#2e7d4f"] },
  { id: "security_light", name: "Security Light", cat: "Outdoor", price: 2000, comfort: 3, w: 1, d: 1, emoji: "💡", colors: ["#f2b134"] },
  { id: "car_park", name: "Car Park Shade", cat: "Outdoor", price: 6000, comfort: 3, w: 3, d: 2, emoji: "🅿️", colors: ["#555", "#1a1a1a"] },
  // Bath
  { id: "shower", name: "Shower", cat: "Bath", price: 4000, comfort: 8, w: 1, d: 1, emoji: "🚿", colors: ["#e0e0e0", "#555"] },
  { id: "toilet", name: "Toilet", cat: "Bath", price: 3000, comfort: 5, w: 1, d: 1, emoji: "🚽", colors: ["#fff", "#e0e0e0"] },
];

export const CATEGORIES = ["Bedroom", "Living", "Kitchen", "Power", "Decor", "Outdoor", "Bath"];

export function getItem(id) { return FURNITURE_CATALOG.find(f => f.id === id); }

// Build a simple furniture mesh from primitives (box/cylinder)
export function makeFurnitureMesh(item, color) {
  // Returns a THREE.Group with the furniture
  // This is a simplified version — just a colored box with the right dimensions
  const group = new THREE.Group();
  const c = color || item.colors[0];
  const w = item.w * 0.8, d = item.d * 0.8;
  let h = 0.5; // default height

  // Height varies by type
  if (item.id.includes("bed")) h = 0.6;
  else if (item.id.includes("sofa")) h = 0.9;
  else if (item.id.includes("wardrobe")) h = 2.0;
  else if (item.id.includes("fridge")) h = 1.8;
  else if (item.id.includes("tv")) h = 1.2;
  else if (item.id.includes("plant")) h = 1.0;
  else if (item.id.includes("palm")) h = 3.0;
  else if (item.id.includes("gate")) h = 2.5;
  else if (item.id.includes("generator")) h = 0.8;
  else if (item.id.includes("toilet")) h = 0.5;
  else if (item.id.includes("shower")) h = 2.0;

  // Main body
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color: c })
  );
  body.position.y = h / 2;
  body.castShadow = false;
  body.receiveShadow = true;
  group.add(body);

  // Add a label sprite (emoji) above
  const labelCanvas = document.createElement("canvas");
  labelCanvas.width = 64; labelCanvas.height = 64;
  const ctx = labelCanvas.getContext("2d");
  ctx.font = "40px Arial";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(item.emoji, 32, 32);
  const tex = new THREE.CanvasTexture(labelCanvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  sprite.position.y = h + 0.3;
  sprite.scale.set(0.5, 0.5, 1);
  group.add(sprite);

  group.userData = { furnitureId: item.id, w: item.w, d: item.d, comfort: item.comfort };
  return group;
}

// Calculate total comfort from placed furniture
export function calcComfort(placedItems) {
  let total = 0;
  for (const p of placedItems) {
    const item = getItem(p.id);
    if (item) total += item.comfort;
  }
  return total;
}
