const sharp = require('sharp');
const path = require('path');

const svgIcon = (size) => {
  const r = Math.round(size * 0.219); // rx for rounded square
  const cx = Math.round(size * 0.698); // meteor center x
  const cy = Math.round(size * 0.5);  // meteor center y
  const mr = Math.round(size * 0.146); // meteor outer radius
  const ir = Math.round(size * 0.063); // meteor inner radius
  const t1y = Math.round(size * 0.448); // tail y1
  const t2y = Math.round(size * 0.5);  // tail y2
  const t3y = Math.round(size * 0.552); // tail y3
  const tx1s = Math.round(size * 0.323); // tail short start
  const tx1l = Math.round(size * 0.26);  // tail long start
  const txe  = Math.round(size * 0.573); // tail end
  const sw   = Math.round(size * 0.042); // stroke width

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${r}" fill="#FF5A36"/>
  <line x1="${tx1s}" y1="${t1y}" x2="${txe}" y2="${t1y}" stroke="white" stroke-width="${sw}" stroke-linecap="round" opacity="0.45"/>
  <line x1="${tx1l}" y1="${t2y}" x2="${txe}" y2="${t2y}" stroke="white" stroke-width="${sw}" stroke-linecap="round" opacity="0.7"/>
  <line x1="${tx1s}" y1="${t3y}" x2="${txe}" y2="${t3y}" stroke="white" stroke-width="${sw}" stroke-linecap="round" opacity="0.45"/>
  <circle cx="${cx}" cy="${cy}" r="${mr}" fill="white"/>
  <circle cx="${cx}" cy="${cy}" r="${ir}" fill="#FF5A36"/>
</svg>`;
};

// maskable: 약간 더 여백 주고 중앙 배치
const svgMaskable = (size) => {
  const safe = Math.round(size * 0.8);
  const offset = Math.round((size - safe) / 2);
  const inner = svgIcon(safe).replace(`width="${safe}" height="${safe}" viewBox="0 0 ${safe} ${safe}"`, `width="${safe}" height="${safe}" viewBox="0 0 ${safe} ${safe}"`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#FF5A36"/>
  <image href="data:image/svg+xml;base64,${Buffer.from(svgIcon(safe)).toString('base64')}" x="${offset}" y="${offset}" width="${safe}" height="${safe}"/>
</svg>`;
};

async function generate() {
  await sharp(Buffer.from(svgIcon(192))).png().toFile(path.join('icons', 'icon-192.png'));
  console.log('icon-192.png 생성 완료');
  await sharp(Buffer.from(svgIcon(512))).png().toFile(path.join('icons', 'icon-512.png'));
  console.log('icon-512.png 생성 완료');
  // status-mono (흑백 단색 실루엣)
  const mono = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
  <circle cx="67" cy="48" r="18" fill="white"/>
  <circle cx="67" cy="48" r="8" fill="black"/>
  <line x1="20" y1="43" x2="45" y2="43" stroke="white" stroke-width="5" stroke-linecap="round" opacity="0.6"/>
  <line x1="14" y1="48" x2="45" y2="48" stroke="white" stroke-width="5" stroke-linecap="round"/>
  <line x1="20" y1="53" x2="45" y2="53" stroke="white" stroke-width="5" stroke-linecap="round" opacity="0.6"/>
</svg>`;
  await sharp(Buffer.from(mono)).png().toFile(path.join('icons', 'status-mono.png'));
  console.log('status-mono.png 생성 완료');
}

generate().catch(console.error);
