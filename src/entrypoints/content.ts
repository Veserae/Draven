import type { WorldArtifact } from '../types/world';

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  excludeMatches: ['chrome://*/*', 'chrome-extension://*/*'],
  runAt: 'document_idle',

  main() {
    // Only collect once per page load, not on every navigation
    collectArtifact();
  },
});

function collectArtifact() {
  try {
    const color = extractDominantColor();
    const shape = deriveShape();
    const host = location.hostname.replace(/^www\./, '');

    const artifact: WorldArtifact = {
      id: `${host}-${Date.now()}`,
      color,
      shape,
      source: host,
      collectedAt: Date.now(),
      // Random position in the world's safe zone (away from clock/UI)
      x: 0.05 + Math.random() * 0.9,
      y: 0.1 + Math.random() * 0.75,
      scale: 0.6 + Math.random() * 1.4,
    };

    browser.runtime.sendMessage({ type: 'ARTIFACT_COLLECTED', payload: artifact });
  } catch (e) {
    // Silently fail – content script context can be restricted
  }
}

/** Sample CSS colors from the page's computed styles to find the dominant accent */
function extractDominantColor(): string {
  const candidates: string[] = [];

  // 1. Meta theme-color tag
  const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.content;
  if (themeColor) return normalizeColor(themeColor);

  // 2. Sample background colors from prominent elements
  const selectors = ['header', 'nav', '[role="banner"]', '.header', '#header', 'main', 'body'];
  for (const sel of selectors) {
    const el = document.querySelector<HTMLElement>(sel);
    if (el) {
      const bg = getComputedStyle(el).backgroundColor;
      if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
        candidates.push(bg);
      }
    }
  }

  // 3. Favicon color via canvas (best-effort)
  try {
    const link = document.querySelector<HTMLLinkElement>('link[rel*="icon"]');
    if (link?.href) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const cnv = document.createElement('canvas');
        cnv.width = 1; cnv.height = 1;
        const c = cnv.getContext('2d')!;
        c.drawImage(img, 0, 0, 1, 1);
        const [r, g, b] = c.getImageData(0, 0, 1, 1).data;
        browser.runtime.sendMessage({
          type: 'ARTIFACT_COLLECTED',
          payload: { color: `rgb(${r},${g},${b})` },
        });
      };
      img.src = link.href;
    }
  } catch {}

  if (candidates.length > 0) return normalizeColor(candidates[0]);

  // Fallback: generate color from hostname hash
  return hashColor(location.hostname);
}

function normalizeColor(color: string): string {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  // Boost saturation
  return rgbToVibrant(r, g, b);
}

function rgbToVibrant(r: number, g: number, b: number): string {
  // Convert to HSL, boost S, return hex
  const nr = r / 255, ng = g / 255, nb = b / 255;
  const max = Math.max(nr, ng, nb), min = Math.min(nr, ng, nb);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === nr) h = ((ng - nb) / d + (ng < nb ? 6 : 0)) / 6;
    else if (max === ng) h = ((nb - nr) / d + 2) / 6;
    else h = ((nr - ng) / d + 4) / 6;
  }
  return hslToHex(h, Math.min(1, s * 1.4 + 0.2), Math.max(0.35, Math.min(0.65, l)));
}

function hslToHex(h: number, s: number, l: number): string {
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = Math.round(hue2rgb(p, q, h + 1/3) * 255);
  const g = Math.round(hue2rgb(p, q, h) * 255);
  const b = Math.round(hue2rgb(p, q, h - 1/3) * 255);
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

function hashColor(str: string): string {
  let hash = 0;
  for (const ch of str) hash = ((hash << 5) - hash) + ch.charCodeAt(0);
  const h = Math.abs(hash) % 360;
  return hslToHex(h / 360, 0.7, 0.55);
}

type ArtifactShape = WorldArtifact['shape'];

/** Derive a shape from the page's element geometry ratios */
function deriveShape(): ArtifactShape {
  const shapes: ArtifactShape[] = ['circle', 'triangle', 'diamond', 'star', 'crystal'];
  // Use ratio of image count vs link count vs heading count as a deterministic shape selector
  const imgs = document.querySelectorAll('img').length;
  const links = document.querySelectorAll('a').length;
  const heads = document.querySelectorAll('h1,h2,h3').length;
  const idx = (imgs * 3 + links + heads * 2) % shapes.length;
  return shapes[idx];
}
