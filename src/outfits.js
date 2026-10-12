// src/outfits.js — outfit presets (colour sets + style) for men and women, used by the sign-up
// character creator and the in-game wardrobe. All original colour schemes.
export const MEN_OUTFITS = [
  { id: "m-casual", name: "Casual Tee & Jeans", top: "#1f7a5a", bottom: "#2b3a55", shoes: "#f2f2ee", topStyle: "casual", bottomStyle: "trousers" },
  { id: "m-kaftan", name: "Kaftan (white)", top: "#f4efe4", bottom: "#f4efe4", shoes: "#8a5a3c", topStyle: "kaftan", bottomStyle: "trousers" },
  { id: "m-baban", name: "Baban Riga (sky)", top: "#9fc2d9", bottom: "#9fc2d9", shoes: "#8a5a3c", topStyle: "kaftan", bottomStyle: "trousers" },
  { id: "m-senator", name: "Senator (navy)", top: "#2d3a4a", bottom: "#2d3a4a", shoes: "#222222", topStyle: "kaftan", bottomStyle: "trousers" },
  { id: "m-street", name: "Street (red tee, shorts)", top: "#c0392b", bottom: "#3b3b3b", shoes: "#f2f2ee", topStyle: "casual", bottomStyle: "shorts" },
  { id: "m-corporate", name: "Corporate (blue shirt)", top: "#3c8dbc", bottom: "#1f2a36", shoes: "#222222", topStyle: "casual", bottomStyle: "trousers" },
];
export const WOMEN_OUTFITS = [
  { id: "w-ankara", name: "Ankara Gown (gold)", top: "#d98e2b", bottom: "#a23b72", shoes: "#222222", topStyle: "kaftan", bottomStyle: "trousers" },
  { id: "w-abaya", name: "Abaya (black)", top: "#2e2e2e", bottom: "#2e2e2e", shoes: "#222222", topStyle: "kaftan", bottomStyle: "trousers" },
  { id: "w-hijab-set", name: "Modest set (sage)", top: "#7aa58a", bottom: "#d9c7a0", shoes: "#f2f2ee", topStyle: "kaftan", bottomStyle: "trousers" },
  { id: "w-blouse", name: "Blouse & Skirt (purple)", top: "#6b4a8a", bottom: "#2b3a55", shoes: "#c0392b", topStyle: "casual", bottomStyle: "trousers" },
  { id: "w-casual", name: "Crop top & Jeans", top: "#e8c547", bottom: "#44546a", shoes: "#f2f2ee", topStyle: "casual", bottomStyle: "trousers" },
  { id: "w-gown", name: "Evening Gown (wine)", top: "#a23b72", bottom: "#a23b72", shoes: "#222222", topStyle: "kaftan", bottomStyle: "trousers" },
];
export const outfitsFor = (gender) => (gender === "female" ? WOMEN_OUTFITS : MEN_OUTFITS);
export const SKINS = ["#f1c9a5", "#c28a5c", "#a5714a", "#8a5a3c", "#7a4b2e", "#6b4429", "#5a3825", "#3d2517"];
export const HAIRS = ["#111111", "#2a1e14", "#4a3322", "#7a5a3a", "#c9b38a", "#a23b72", "#1d5fa8", "#f2f2ee"];
export const BUILDS = [
  { id: "slim", label: "Slim" },
  { id: "normal", label: "Normal" },
  { id: "big", label: "Big" },
];
