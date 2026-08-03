/**
 * Genera la imagineria de demostracion de BARZUO.
 *
 * En lugar de depender de bancos de imagenes externos, componemos atmosferas
 * nocturnas (focos de escenario, humo, bokeh y grano de pelicula) con sharp.
 * El resultado son archivos reales en public/demo que el seed asigna a eventos,
 * galeria, carta y portadas.
 *
 * Uso:  node scripts/generate-artwork.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

const OUT = path.join(process.cwd(), "public", "demo");

/** PRNG determinista: el arte se regenera identico en cada ejecucion. */
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

const PALETTES = {
  crimson: ["#e11d2a", "#7a0d16", "#2a0409"],
  ember: ["#ff5b2e", "#b4111b", "#2b0a06"],
  gilt: ["#e8cf7a", "#a8761c", "#241705"],
  violet: ["#7b3ff2", "#3a1170", "#120520"],
  teal: ["#12b3a8", "#0a5b57", "#041a1c"],
  rose: ["#ff2e73", "#8a0b3a", "#25050f"],
  amber: ["#ffb020", "#a35c05", "#241402"],
  ice: ["#5fa8ff", "#1c4b8a", "#050f1f"],
};

const PALETTE_NAMES = Object.keys(PALETTES);

/** Capa de ruido monocromo, compuesta en modo overlay para dar textura. */
function grainBuffer(width, height, seed, strength = 20) {
  const rand = rng(seed);
  const px = Buffer.allocUnsafe(width * height * 4);

  for (let i = 0; i < width * height; i++) {
    const v = 128 + (rand() - 0.5) * strength * 2;
    const o = i * 4;
    px[o] = v;
    px[o + 1] = v;
    px[o + 2] = v;
    px[o + 3] = 255;
  }

  return sharp(px, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

/**
 * SVG de la escena. La referencia es una fotografia de sala a oscuras: el negro
 * domina y la luz aparece solo en focos concretos, con humo, siluetas de
 * publico y bokeh fuera de foco.
 */
function sceneSvg(width, height, seed, paletteName, opts = {}) {
  const rand = rng(seed);
  const [hot, mid, deep] = PALETTES[paletteName] ?? PALETTES.crimson;
  const beams = opts.beams ?? 3;
  const blobs = opts.blobs ?? 4;
  const bokeh = opts.bokeh ?? 26;
  const crowd = opts.crowd ?? true;
  // Multiplicador de luz: la portada necesita mas presencia que un afiche.
  const intensity = opts.intensity ?? 1;
  const maxDim = Math.max(width, height);
  const blur = (maxDim * 0.01).toFixed(1);

  // Focos: pequenos y contenidos, para que el negro siga mandando.
  const gradients = [];
  const glows = Array.from({ length: blobs }, (_, i) => {
    const cx = (0.08 + rand() * 0.84) * width;
    const cy = (0.04 + rand() * 0.55) * height;
    const r = (0.1 + rand() * 0.18) * maxDim;
    const color = i === 0 ? hot : i % 2 === 0 ? mid : deep;
    const opacity = Math.min(0.85, (0.34 - i * 0.05) * intensity).toFixed(2);

    gradients.push(`<radialGradient id="g${i}" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${color}" stop-opacity="0.9"/>
      <stop offset="35%" stop-color="${color}" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
    </radialGradient>`);

    return `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${r.toFixed(0)}" fill="url(#g${i})" opacity="${opacity}"/>`;
  }).join("");

  // Haces estrechos que bajan desde las varas de luces.
  const lightBeams = Array.from({ length: beams }, (_, i) => {
    const x = (0.12 + rand() * 0.76) * width;
    const spread = (0.04 + rand() * 0.1) * width;
    const angle = (rand() - 0.5) * 30;
    const color = i % 2 === 0 ? hot : mid;
    const drop = (0.55 + rand() * 0.45) * height;

    gradients.push(`<linearGradient id="b${i}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${color}" stop-opacity="0.5"/>
      <stop offset="60%" stop-color="${color}" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
    </linearGradient>`);

    return `<g transform="rotate(${angle.toFixed(1)} ${x.toFixed(0)} 0)">
      <polygon points="${(x - spread * 0.08).toFixed(0)},0 ${(x + spread * 0.08).toFixed(0)},0 ${(x + spread).toFixed(0)},${drop.toFixed(0)} ${(x - spread).toFixed(0)},${drop.toFixed(0)}"
        fill="url(#b${i})" opacity="${Math.min(0.95, (0.3 + rand() * 0.3) * intensity).toFixed(2)}"/>
    </g>`;
  }).join("");

  // Banda de humo a media altura: separa el fondo del primer plano.
  const hazeY = (0.42 + rand() * 0.22) * height;
  gradients.push(`<linearGradient id="haze" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="${hot}" stop-opacity="0"/>
    <stop offset="50%" stop-color="${hot}" stop-opacity="0.16"/>
    <stop offset="100%" stop-color="${hot}" stop-opacity="0"/>
  </linearGradient>`);
  const haze = `<rect x="0" y="${(hazeY - height * 0.16).toFixed(0)}" width="${width}" height="${(height * 0.32).toFixed(0)}" fill="url(#haze)"/>`;

  // Siluetas de publico recortadas contra la luz.
  const heads = crowd
    ? Array.from({ length: Math.round(width / 90) + 6 }, () => {
        const cx = rand() * width;
        const baseY = height * (0.86 + rand() * 0.16);
        const rH = (0.018 + rand() * 0.026) * maxDim;
        return `<g fill="#020103" opacity="${(0.8 + rand() * 0.2).toFixed(2)}">
          <circle cx="${cx.toFixed(0)}" cy="${baseY.toFixed(0)}" r="${rH.toFixed(0)}"/>
          <ellipse cx="${cx.toFixed(0)}" cy="${(baseY + rH * 2.3).toFixed(0)}" rx="${(rH * 1.9).toFixed(0)}" ry="${(rH * 2.1).toFixed(0)}"/>
        </g>`;
      }).join("")
    : "";

  const dots = Array.from({ length: bokeh }, () => {
    const cx = rand() * width;
    const cy = (0.15 + rand() * 0.7) * height;
    const r = (0.003 + rand() * 0.014) * width;
    const color = rand() > 0.5 ? hot : "#f4efe7";
    return `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${r.toFixed(1)}" fill="${color}" opacity="${(0.08 + rand() * 0.3).toFixed(3)}"/>`;
  }).join("");

  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      ${gradients.join("")}
      <linearGradient id="base" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#0a0810"/>
        <stop offset="55%" stop-color="#060509"/>
        <stop offset="100%" stop-color="#030204"/>
      </linearGradient>
      <radialGradient id="vig" cx="50%" cy="38%" r="72%">
        <stop offset="35%" stop-color="#000000" stop-opacity="0"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0.95"/>
      </radialGradient>
      <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#000000" stop-opacity="0"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0.9"/>
      </linearGradient>
      <filter id="soft"><feGaussianBlur stdDeviation="${blur}"/></filter>
      <filter id="softer"><feGaussianBlur stdDeviation="${(maxDim * 0.022).toFixed(1)}"/></filter>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#base)"/>
    <g filter="url(#soft)">${lightBeams}</g>
    <g filter="url(#softer)">${glows}</g>
    <g filter="url(#softer)">${haze}</g>
    <g filter="url(#soft)">${dots}</g>
    <g filter="url(#soft)">${heads}</g>
    <rect x="0" y="${(height * 0.7).toFixed(0)}" width="${width}" height="${(height * 0.3).toFixed(0)}" fill="url(#floor)"/>
    <rect width="${width}" height="${height}" fill="url(#vig)"/>
  </svg>`);
}

async function render(name, width, height, seed, palette, opts = {}) {
  const svg = sceneSvg(width, height, seed, palette, opts);
  const grain = await grainBuffer(width, height, seed + 7919, opts.grain ?? 22);

  const buffer = await sharp(svg)
    .composite([{ input: grain, blend: "overlay" }])
    .jpeg({ quality: 78, mozjpeg: true, chromaSubsampling: "4:4:4" })
    .toBuffer();

  await writeFile(path.join(OUT, name), buffer);
  return `/demo/${name}`;
}

async function main() {
  await mkdir(OUT, { recursive: true });

  const made = [];
  const push = (p) => {
    made.push(p);
    process.stdout.write(`  ${p}\n`);
  };

  console.log("Generando imagineria de BARZUO…");

  // Portada principal y og por defecto
  push(await render("hero.jpg", 2400, 1350, 101, "crimson", { beams: 4, blobs: 5, bokeh: 34, intensity: 2.1 }));
  push(await render("hero-mobile.jpg", 1200, 1600, 137, "crimson", { beams: 3, blobs: 4, bokeh: 22, intensity: 2.1 }));
  push(await render("og-default.jpg", 1200, 630, 211, "ember", { beams: 3, blobs: 4, bokeh: 18, intensity: 1.9 }));

  // Nosotros
  push(await render("about-1.jpg", 1200, 1500, 313, "ember", { beams: 2, blobs: 4, bokeh: 20 }));
  push(await render("about-2.jpg", 1200, 900, 331, "gilt", { beams: 2, blobs: 3, bokeh: 16 }));

  // Afiches de eventos (formato vertical 5:7)
  for (let i = 1; i <= 10; i++) {
    const palette = PALETTE_NAMES[i % PALETTE_NAMES.length];
    push(await render(`poster-${i}.jpg`, 1000, 1400, 1000 + i * 37, palette, {
      beams: 3,
      blobs: 4,
      bokeh: 24,
    }));
  }

  // Galeria, alternando vertical y horizontal para el mosaico
  const gallerySizes = [
    [1200, 1600], [1600, 1100], [1200, 1200], [1100, 1500],
    [1600, 1000], [1200, 1500], [1400, 1400], [1000, 1400],
    [1600, 1200], [1200, 1600], [1500, 1000], [1200, 1400],
    [1400, 1050], [1100, 1450],
  ];
  for (let i = 0; i < gallerySizes.length; i++) {
    const [w, h] = gallerySizes[i];
    const palette = PALETTE_NAMES[(i + 3) % PALETTE_NAMES.length];
    push(await render(`gallery-${i + 1}.jpg`, w, h, 5000 + i * 53, palette, {
      beams: 2,
      blobs: 4,
      bokeh: 20,
    }));
  }

  // Categorias de la carta
  for (let i = 1; i <= 15; i++) {
    push(await render(`category-${i}.jpg`, 1000, 750, 7000 + i * 61, PALETTE_NAMES[i % PALETTE_NAMES.length], {
      beams: 1,
      blobs: 3,
      bokeh: 12,
      grain: 16,
      crowd: false,
    }));
  }

  // Productos de la carta (cuadrados)
  for (let i = 1; i <= 14; i++) {
    push(await render(`product-${i}.jpg`, 900, 900, 9000 + i * 71, PALETTE_NAMES[(i + 1) % PALETTE_NAMES.length], {
      beams: 1,
      blobs: 3,
      bokeh: 10,
      grain: 14,
      crowd: false,
    }));
  }

  // Promociones de la BarzuCard
  for (let i = 1; i <= 6; i++) {
    push(await render(`promo-${i}.jpg`, 1200, 800, 11000 + i * 83, PALETTE_NAMES[(i + 5) % PALETTE_NAMES.length], {
      beams: 2,
      blobs: 3,
      bokeh: 14,
    }));
  }

  console.log(`\nListo: ${made.length} imagenes en public/demo`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
