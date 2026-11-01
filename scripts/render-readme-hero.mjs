// Documentation art only. Uses the supplied SVG mark and supplied vector letter paths.
// No runtime dependencies, network requests, fonts, scripts or raster embeds in the output.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const directory = new URL("../docs/assets/", import.meta.url);
function source(name) {
	const text = readFileSync(new URL(name, directory), "utf8");
	const match = /<svg\b([^>]*)>([\s\S]*)<\/svg>\s*$/.exec(text);
	const viewBox = /\bviewBox="([^"]+)"/.exec(match?.[1] ?? "")?.[1];
	if (!match || !viewBox || /<(?:script|image|foreignObject|animate|set)\b|\b(?:href|src|on[a-z]+)\s*=|@import/i.test(text)) throw new Error(`Expected self-contained static vector: ${name}`);
	return { viewBox, body: match[2].replace(/<title>[\s\S]*?<\/title>/g, "") };
}
const mark = source("noodle-neon.svg"), wordmark = source("noodle-neon-wordmark.svg");
const embed = (source, x, y, width, height, extra = "") => `<svg x="${x}" y="${y}" width="${width}" height="${height}" viewBox="${source.viewBox}" ${extra}>${source.body}</svg>`;
function hero(compact) {
	const w = compact ? 600 : 960, h = compact ? 500 : 320;
	const line = Array.from({ length: 141 }, (_, i) => {
		const t = i / 140, x = (compact ? 120 : 320) + t * (compact ? 360 : 550);
		const y = (compact ? 462 : 274) + Math.sin(t * Math.PI * 20) * Math.sin(t * Math.PI) ** 2 * 5;
		return `${i ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`;
	}).join(" ");
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="title description">
<title id="title">pi-noodle — Pi / your agent's inner voice</title>
<desc id="description">The supplied neon skull-and-noodle mark beside the Noodle neon wordmark. Static decorative artwork, not a live activity indicator.</desc>
<defs>
 <linearGradient id="wall" x2="1" y2="1"><stop stop-color="#090e18"/><stop offset="1" stop-color="#181024"/></linearGradient>
 <radialGradient id="aura"><stop stop-color="#7dd3c0" stop-opacity=".16"/><stop offset="1" stop-color="#7dd3c0" stop-opacity="0"/></radialGradient>
 <linearGradient id="edge"><stop stop-color="#7dd3c0" stop-opacity=".7"/><stop offset=".6" stop-color="#9c8ed0" stop-opacity=".14"/><stop offset="1" stop-color="#ff7a93" stop-opacity=".5"/></linearGradient>
 <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" stroke="#fff" stroke-opacity=".025"/></pattern>
 <filter id="neon" x="-10%" y="-30%" width="120%" height="160%"><feGaussianBlur stdDeviation="2.2"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
 <clipPath id="frame"><rect width="${w}" height="${h}" rx="24"/></clipPath>
</defs>
<g clip-path="url(#frame)">
 <rect width="${w}" height="${h}" fill="url(#wall)"/>
 <rect width="${w}" height="${h}" fill="url(#grid)"/>
 <ellipse cx="${compact ? 300 : 160}" cy="${compact ? 146 : 160}" rx="190" ry="180" fill="url(#aura)"/>
 ${embed(mark, compact ? 190 : 38, compact ? 20 : 36, compact ? 220 : 242, compact ? 220 : 242)}
 ${compact ? "" : '<path d="M296 76V248" stroke="#7dd3c0" stroke-opacity=".16"/>'}
 ${embed(wordmark, compact ? 65 : 316, compact ? 267 : 72, compact ? 470 : 570, compact ? 127 : 154, 'filter="url(#neon)"')}
 <text x="${compact ? 300 : 330}" y="${compact ? 430 : 246}" ${compact ? 'text-anchor="middle"' : ""} fill="#d5c8fa" font-family="Verdana,Arial,sans-serif" font-size="${compact ? 24 : 23}">Pi / your agent's inner voice</text>
 <path d="${line}" fill="none" stroke="#ffd27a" stroke-opacity=".55" stroke-width="1.6"/>
</g>
<rect x=".75" y=".75" width="${w - 1.5}" height="${h - 1.5}" rx="23.25" fill="none" stroke="url(#edge)" stroke-width="1.5"/>
</svg>\n`;
}
for (const [name, compact] of [["noodle-hero.svg", false], ["noodle-hero-compact.svg", true]]) {
	writeFileSync(new URL(name, directory), hero(compact).replace(/[ \t]+$/gm, ""));
	console.log(`Rendered ${fileURLToPath(new URL(name, directory))}`);
}
