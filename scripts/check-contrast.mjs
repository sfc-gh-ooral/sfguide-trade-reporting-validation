// Checks WCAG AA contrast (4.5:1 for text) for every text token in docs/DESIGN.md's palette,
// on the page, panel and inset surfaces, in both themes. Exits non-zero on any failure.
//   node scripts/check-contrast.mjs
const THEMES = {
  dark: { bg: "#0B0E13", surface: "#12161D", "surface-2": "#1A1F28", text: "#E8EAEE", "text-2": "#A9B0BC", muted: "#8A92A0", signal: "#FFB020", ice: "#7CC4FF", mint: "#5BE49B", coral: "#FF7A6B", violet: "#B59CFF" },
  light: { bg: "#F4F2EC", surface: "#FFFFFF", "surface-2": "#ECE9E1", text: "#16181D", "text-2": "#4A4F59", muted: "#5E6470", signal: "#8F5400", ice: "#1F5F9E", mint: "#17784A", coral: "#B23A2C", violet: "#5B44B8" },
};
const TEXT = ["text", "text-2", "muted", "signal", "ice", "mint", "coral", "violet"];
const SURFACES = ["bg", "surface", "surface-2"];
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const lum = (h) => { const [r, g, b] = rgb(h).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
// A tinted pill: the token at 14% over the surface.
const mix = (fg, bg, t) => "#" + rgb(fg).map((c, i) => Math.round((c * t + rgb(bg)[i] * (1 - t)) * 255).toString(16).padStart(2, "0")).join("");
let fails = 0;
for (const [name, t] of Object.entries(THEMES)) {
  for (const fg of TEXT) {
    for (const s of SURFACES) {
      const r = ratio(t[fg], t[s]);
      if (r < 4.5) { fails++; console.log(`FAIL ${name} ${fg} on ${s}: ${r.toFixed(2)}`); }
    }
    if (fg !== "text" && fg !== "text-2" && fg !== "muted") {
      const r = ratio(t[fg], mix(t[fg], t.surface, 0.14));
      if (r < 4.5) { fails++; console.log(`FAIL ${name} ${fg} on its pill: ${r.toFixed(2)}`); }
    }
  }
}
console.log(fails ? `${fails} pairs below 4.5:1` : "All text tokens meet WCAG AA (4.5:1) on every surface and pill, both themes.");
process.exit(fails ? 1 : 0);
