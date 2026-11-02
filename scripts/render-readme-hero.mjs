// Export the editable layered neon master for GitHub. No runtime dependencies.
import { readFileSync, writeFileSync } from "node:fs";
const assets = new URL("../docs/assets/", import.meta.url);
const master = readFileSync(new URL("noodle-logo-editable.svg", assets), "utf8");
// The supplied master uses ordinary SVG groups; balance nested groups, not a
// non-greedy regex that would silently cut off a nested editing layer.
function layer(xml, id) {
	const start = new RegExp(`<g\\b[^>]*\\bid="${id}"[^>]*>`).exec(xml);
	if (!start) throw new Error(`Missing editable layer: ${id}`);
	const tags = /<\/?g\b[^>]*>/g; tags.lastIndex = start.index;
	let depth = 0;
	for (let token; (token = tags.exec(xml));) {
		depth += token[0].startsWith("</") ? -1 : 1;
		if (!depth) return xml.slice(start.index, tags.lastIndex);
	}
	throw new Error(`Unclosed editable layer: ${id}`);
}
const reference = layer(master, "layer-reference");
const desktop = master.replace(reference, "").replace(/<metadata\b[^>]*>[\s\S]*?<\/metadata>/g, "")
	.replace(/\s+inkscape:[\w-]+="[^"]*"/g, "");
const defs = /<defs>[\s\S]*?<\/defs>/.exec(desktop)?.[0];
if (!defs) throw new Error("Missing vector definitions");
const embed = (id, box, x, y, width, height) => `<svg x="${x}" y="${y}" width="${width}" height="${height}" viewBox="${box}">${layer(desktop, id)}</svg>`;
const compact = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="760" viewBox="0 0 640 760" role="img" aria-labelledby="title description">
<title id="title">pi-noodle — neon skull and inner voice</title>
<desc id="description">Compact arrangement of the supplied neon skull reference, with editable vector geometry shared with the desktop logo.</desc>
${defs}
<rect width="640" height="760" rx="20" fill="#0a0714"/>
<rect width="640" height="760" rx="20" fill="url(#wall-grid)"/>
<ellipse cx="320" cy="240" rx="260" ry="230" fill="url(#mint-wall)"/>
<ellipse cx="320" cy="490" rx="290" ry="180" fill="url(#pink-wall)"/>
${embed("layer-skull", "60 40 440 490", 128, 8, 360, 400)}
${embed("layer-wordmark", "510 218 460 124", 45, 420, 550, 148)}
<text x="320" y="610" text-anchor="middle" font-family="ui-monospace,Consolas,Liberation Mono,monospace" font-size="26" letter-spacing=".9" fill="#c9b8ff" filter="url(#g)">Pi / your agent's inner voice</text>
${embed("layer-voice", "390 120 490 64", 70, 630, 500, 40)}
<g filter="url(#g)"><rect x="210" y="688" width="220" height="42" rx="6" fill="none" stroke="#7dd3c0" stroke-width="2.5"/>
<text x="320" y="716" text-anchor="middle" font-family="ui-monospace,Consolas,Liberation Mono,monospace" font-size="20" letter-spacing="2" fill="#7dd3c0">LOCAL MEMORY</text></g>
</svg>\n`;
for (const [name, svg] of [["noodle-hero.svg", desktop], ["noodle-hero-compact.svg", compact]]) {
	if (/<(?:image|script|foreignObject|animate)\b|\b(?:href|src|on[a-z]+)\s*=|@font-face|@import/i.test(svg)) throw new Error(`Web export contains an active or external resource: ${name}`);
	writeFileSync(new URL(name, assets), svg.replace(/[ \t]+$/gm, ""));
	console.log(`Rendered ${name}`);
}
