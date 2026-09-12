import sharp from "sharp";
import { mkdirSync } from "node:fs";

mkdirSync("public/icons", { recursive: true });

const bg = "#1f6fe0";

function iconSvg(size, { maskableSafe = false } = {}) {
  const corner = maskableSafe ? 0 : size * 0.22;
  const fontSize = maskableSafe ? size * 0.42 : size * 0.55;
  return `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" rx="${corner}" fill="${bg}"/>
  <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle"
    font-family="Helvetica, Arial, sans-serif" font-weight="700"
    font-size="${fontSize}" fill="#ffffff">M</text>
</svg>`;
}

const jobs = [
  { file: "icon-192.png", size: 192, opts: {} },
  { file: "icon-512.png", size: 512, opts: {} },
  { file: "icon-maskable-512.png", size: 512, opts: { maskableSafe: true } },
  { file: "apple-touch-icon.png", size: 180, opts: {} },
  { file: "favicon-32.png", size: 32, opts: {} },
];

for (const job of jobs) {
  const svg = iconSvg(job.size, job.opts);
  await sharp(Buffer.from(svg)).png().toFile(`public/icons/${job.file}`);
  console.log("generated", job.file);
}
