import type { WorldArtifact, TimeOfDay, WeatherCondition } from '../../types/world';

interface Star { x: number; y: number; r: number; twinkle: number; phase: number }
interface Cloud { x: number; y: number; w: number; h: number; speed: number; opacity: number }
interface Leaf  { x: number; y: number; vx: number; vy: number; rot: number; vrot: number; size: number; color: string; life: number }
interface RainDrop { x: number; y: number; len: number; speed: number }

export class IslandRenderer {
  private stars: Star[] = [];
  private clouds: Cloud[] = [];
  private leaves: Leaf[] = [];
  private rain: RainDrop[] = [];
  private t = 0;
  private mouseX = 0.5;
  private mouseY = 0.5;

  init(w: number, h: number) {
    this.stars = Array.from({ length: 180 }, () => ({
      x: Math.random(), y: Math.random() * 0.6,
      r: Math.random() * 1.5 + 0.3,
      twinkle: Math.random() * 0.5 + 0.5,
      phase: Math.random() * Math.PI * 2,
    }));
    this.clouds = Array.from({ length: 7 }, (_, i) => ({
      x: Math.random(), y: 0.08 + Math.random() * 0.22,
      w: 0.12 + Math.random() * 0.18, h: 0.04 + Math.random() * 0.06,
      speed: 0.00003 + Math.random() * 0.00005,
      opacity: 0.55 + Math.random() * 0.35,
    }));
    this.rain = Array.from({ length: 220 }, () => ({
      x: Math.random(), y: Math.random(),
      len: 0.015 + Math.random() * 0.03,
      speed: 0.008 + Math.random() * 0.006,
    }));
  }

  setMouse(x: number, y: number) { this.mouseX = x; this.mouseY = y; }

  render(
    ctx: CanvasRenderingContext2D, w: number, h: number,
    tod: TimeOfDay, weather: WeatherCondition, artifacts: WorldArtifact[],
    dt: number,
  ) {
    this.t += dt;

    // ── Sky gradient ──────────────────────────────────────────────
    const skyColors: Record<TimeOfDay, [string, string, string]> = {
      dawn:      ['#1a0a2e', '#c0392b', '#f39c12'],
      morning:   ['#87ceeb', '#b8d4f0', '#e8f4fd'],
      afternoon: ['#4a90d9', '#87ceeb', '#c8e8f8'],
      dusk:      ['#0d0d2b', '#8b1a1a', '#e67e22'],
      night:     ['#050510', '#0a0a1a', '#0d0d2b'],
    };
    const [s1, s2, s3] = skyColors[tod];
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.65);
    skyGrad.addColorStop(0, s1);
    skyGrad.addColorStop(0.5, s2);
    skyGrad.addColorStop(1, s3);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    // ── Stars (night/dawn/dusk) ───────────────────────────────────
    if (tod === 'night' || tod === 'dawn' || tod === 'dusk') {
      const starAlpha = tod === 'night' ? 1 : tod === 'dawn' ? 0.4 : 0.6;
      this.stars.forEach(s => {
        const twinkle = s.twinkle + Math.sin(this.t * 0.001 + s.phase) * 0.3;
        ctx.beginPath();
        ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${twinkle * starAlpha})`;
        ctx.fill();
      });
    }

    // ── Sun / Moon ────────────────────────────────────────────────
    this.drawCelestialBody(ctx, w, h, tod);

    // ── Clouds ────────────────────────────────────────────────────
    const cloudAlpha = weather === 'clear' ? 0.7 : weather === 'cloudy' ? 1.0 : weather === 'rain' ? 0.9 : 0.5;
    this.clouds.forEach(c => {
      c.x += c.speed * dt;
      if (c.x - c.w > 1) c.x = -c.w;
      this.drawCloud(ctx, c.x * w, c.y * h, c.w * w, c.h * h, c.opacity * cloudAlpha, weather);
    });

    // ── Ocean ─────────────────────────────────────────────────────
    this.drawOcean(ctx, w, h, tod, weather);

    // ── Floating island ───────────────────────────────────────────
    const islandY = h * 0.52 + Math.sin(this.t * 0.0006) * 8;
    const islandX = w * 0.5 + Math.sin(this.t * 0.0003) * 4;
    // Subtle parallax with mouse
    const px = (this.mouseX - 0.5) * 18;
    const py = (this.mouseY - 0.5) * 8;
    this.drawIsland(ctx, islandX + px, islandY + py, w, h, tod, weather);

    // ── Rain ──────────────────────────────────────────────────────
    if (weather === 'rain' || weather === 'storm') {
      this.drawRain(ctx, w, h, weather === 'storm' ? 1.5 : 1.0, dt);
    }

    // ── Artifacts ─────────────────────────────────────────────────
    this.drawArtifacts(ctx, w, h, artifacts);

    // ── Vignette ──────────────────────────────────────────────────
    const vig = ctx.createRadialGradient(w/2, h/2, h*0.3, w/2, h/2, h*0.9);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);

    // ── Leaf particles ────────────────────────────────────────────
    this.updateLeaves(ctx, w, h, dt, islandX + px, islandY + py);
  }

  private drawCelestialBody(ctx: CanvasRenderingContext2D, w: number, h: number, tod: TimeOfDay) {
    const positions: Record<TimeOfDay, [number, number]> = {
      dawn:      [0.15, 0.35],
      morning:   [0.3,  0.18],
      afternoon: [0.65, 0.12],
      dusk:      [0.82, 0.3],
      night:     [0.75, 0.15],
    };
    const [nx, ny] = positions[tod];
    const cx = nx * w, cy = ny * h;

    if (tod === 'night') {
      // Moon
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, 28, 0, Math.PI * 2);
      ctx.fillStyle = '#e8e8d0';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + 10, cy - 6, 25, 0, Math.PI * 2);
      ctx.fillStyle = '#0a0a1a';
      ctx.fill();
      ctx.restore();
      // Moon glow
      const mg = ctx.createRadialGradient(cx, cy, 10, cx, cy, 80);
      mg.addColorStop(0, 'rgba(220,220,180,0.15)');
      mg.addColorStop(1, 'rgba(220,220,180,0)');
      ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(cx, cy, 80, 0, Math.PI * 2); ctx.fill();
    } else {
      // Sun
      const sunColors: Record<TimeOfDay, string> = {
        dawn: '#ff6b35', morning: '#ffd700', afternoon: '#fff176', dusk: '#ff4500', night: '#fff',
      };
      const sunGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 90);
      sunGlow.addColorStop(0, sunColors[tod]);
      sunGlow.addColorStop(0.3, sunColors[tod] + 'aa');
      sunGlow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sunGlow; ctx.beginPath(); ctx.arc(cx, cy, 90, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx, cy, 28, 0, Math.PI * 2);
      ctx.fillStyle = sunColors[tod]; ctx.fill();
    }
  }

  private drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, alpha: number, weather: WeatherCondition) {
    ctx.save();
    ctx.globalAlpha = alpha;
    const grad = ctx.createLinearGradient(x, y - h, x, y + h);
    if (weather === 'rain' || weather === 'storm') {
      grad.addColorStop(0, '#606070');
      grad.addColorStop(1, '#404050');
    } else {
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(1, '#d0d8e8');
    }
    ctx.fillStyle = grad;
    const blobCount = 5;
    for (let i = 0; i < blobCount; i++) {
      const bx = x + (i / (blobCount - 1)) * w - w * 0.5;
      const by = y - Math.sin((i / (blobCount - 1)) * Math.PI) * h * 0.6;
      const br = h * 0.6 + Math.sin(i * 1.3) * h * 0.2;
      ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  private drawOcean(ctx: CanvasRenderingContext2D, w: number, h: number, tod: TimeOfDay, weather: WeatherCondition) {
    const oceanY = h * 0.68;
    const oceanColors: Record<TimeOfDay, [string, string]> = {
      dawn:      ['#1a3a5c', '#0d1f2d'],
      morning:   ['#1a6896', '#0d3d5c'],
      afternoon: ['#1e7ab8', '#0d4a70'],
      dusk:      ['#8b3a2a', '#1a1a3a'],
      night:     ['#060d1a', '#030810'],
    };
    const [oc1, oc2] = oceanColors[tod];
    const og = ctx.createLinearGradient(0, oceanY, 0, h);
    og.addColorStop(0, oc1); og.addColorStop(1, oc2);
    ctx.fillStyle = og; ctx.fillRect(0, oceanY, w, h - oceanY);

    // Wave lines
    const waveCount = weather === 'storm' ? 6 : 3;
    for (let i = 0; i < waveCount; i++) {
      const wy = oceanY + (i + 1) * ((h - oceanY) / (waveCount + 2));
      const amp = 3 + i * 1.5 + (weather === 'storm' ? 4 : 0);
      ctx.beginPath();
      ctx.moveTo(0, wy);
      for (let x2 = 0; x2 <= w; x2 += 8) {
        ctx.lineTo(x2, wy + Math.sin((x2 / w) * Math.PI * 6 + this.t * 0.001 + i * 0.8) * amp);
      }
      ctx.strokeStyle = `rgba(255,255,255,${0.06 - i * 0.008})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Shimmer reflection
    if (tod !== 'night') {
      const shimX = w * 0.5 + (this.mouseX - 0.5) * w * 0.3;
      const sg = ctx.createRadialGradient(shimX, oceanY + 20, 0, shimX, oceanY + 80, 200);
      sg.addColorStop(0, 'rgba(255,255,180,0.18)');
      sg.addColorStop(1, 'rgba(255,255,180,0)');
      ctx.fillStyle = sg; ctx.fillRect(shimX - 200, oceanY, 400, 120);
    }
  }

  private drawIsland(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number, tod: TimeOfDay, weather: WeatherCondition) {
    const iw = w * 0.38, ih = h * 0.12;

    // Island shadow / underside
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy + ih * 0.7, iw * 0.85, ih * 1.2, 0, 0, Math.PI * 2);
    const shadowGrad = ctx.createLinearGradient(cx, cy, cx, cy + ih * 2);
    shadowGrad.addColorStop(0, 'rgba(20,10,40,0.8)');
    shadowGrad.addColorStop(1, 'rgba(10,5,20,0)');
    ctx.fillStyle = shadowGrad; ctx.fill();
    ctx.restore();

    // Rock / dirt base
    ctx.beginPath();
    ctx.ellipse(cx, cy + ih * 0.2, iw * 0.9, ih * 0.8, 0, 0, Math.PI * 2);
    const rockGrad = ctx.createLinearGradient(cx, cy - ih, cx, cy + ih);
    rockGrad.addColorStop(0, '#5a4a3a');
    rockGrad.addColorStop(1, '#2d2010');
    ctx.fillStyle = rockGrad; ctx.fill();

    // Grass top
    const grassColor = weather === 'rain' ? '#2d5a1a' : tod === 'night' ? '#1a3010' : '#3d7a20';
    ctx.beginPath();
    ctx.ellipse(cx, cy - ih * 0.1, iw * 0.92, ih * 0.45, 0, 0, Math.PI * 2);
    ctx.fillStyle = grassColor; ctx.fill();

    // Grass highlight
    ctx.beginPath();
    ctx.ellipse(cx - iw * 0.1, cy - ih * 0.25, iw * 0.35, ih * 0.15, -0.2, 0, Math.PI * 2);
    ctx.fillStyle = tod === 'night' ? '#254018' : '#5aaa30';
    ctx.fill();

    // Tree on island
    this.drawTree(ctx, cx - iw * 0.18, cy - ih * 0.35, h * 0.14, tod);
    this.drawTree(ctx, cx + iw * 0.22, cy - ih * 0.3, h * 0.1, tod);

    // Tiny cottage
    this.drawCottage(ctx, cx + iw * 0.05, cy - ih * 0.45, h * 0.065, tod);

    // Waterfall off edge
    this.drawWaterfall(ctx, cx - iw * 0.55, cy, h * 0.06, tod);
  }

  private drawTree(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, tod: TimeOfDay) {
    // Trunk
    ctx.fillStyle = '#4a2f10';
    ctx.fillRect(x - size * 0.06, y, size * 0.12, size * 0.45);
    // Foliage layers
    const leafColor = tod === 'night' ? '#1a3a10' : '#2d6e18';
    const leafHi = tod === 'night' ? '#254018' : '#4a9a28';
    for (let i = 0; i < 3; i++) {
      const ly = y - size * (0.35 + i * 0.28);
      const lw = size * (0.5 - i * 0.1);
      ctx.beginPath();
      ctx.moveTo(x, ly - size * 0.28);
      ctx.lineTo(x - lw, ly);
      ctx.lineTo(x + lw, ly);
      ctx.closePath();
      ctx.fillStyle = i === 1 ? leafHi : leafColor;
      ctx.fill();
    }
  }

  private drawCottage(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, tod: TimeOfDay) {
    // Body
    ctx.fillStyle = '#c8b08a';
    ctx.fillRect(x - size * 0.6, y, size * 1.2, size * 0.9);
    // Roof
    ctx.beginPath();
    ctx.moveTo(x - size * 0.75, y);
    ctx.lineTo(x, y - size * 0.7);
    ctx.lineTo(x + size * 0.75, y);
    ctx.closePath();
    ctx.fillStyle = '#8b3a2a'; ctx.fill();
    // Window glow at night
    if (tod === 'night' || tod === 'dusk') {
      ctx.fillStyle = '#ffcc44';
      ctx.fillRect(x - size * 0.25, y + size * 0.2, size * 0.3, size * 0.3);
      // Warm glow
      const glow = ctx.createRadialGradient(x - size*0.1, y + size*0.35, 0, x - size*0.1, y + size*0.35, size * 1.2);
      glow.addColorStop(0, 'rgba(255,200,60,0.25)');
      glow.addColorStop(1, 'rgba(255,200,60,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(x - size*0.1, y + size*0.35, size*1.2, 0, Math.PI*2); ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(x - size * 0.25, y + size * 0.2, size * 0.3, size * 0.3);
    }
    // Door
    ctx.fillStyle = '#5a3a18';
    ctx.fillRect(x + size * 0.1, y + size * 0.45, size * 0.22, size * 0.45);
  }

  private drawWaterfall(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, tod: TimeOfDay) {
    const alpha = 0.55 + Math.sin(this.t * 0.003) * 0.1;
    ctx.save();
    ctx.globalAlpha = alpha;
    const wg = ctx.createLinearGradient(x, y, x, y + size * 3);
    wg.addColorStop(0, 'rgba(160,200,255,0.9)');
    wg.addColorStop(1, 'rgba(100,160,255,0)');
    ctx.fillStyle = wg;
    for (let i = 0; i < 3; i++) {
      const ox = Math.sin(this.t * 0.002 + i) * 2;
      ctx.fillRect(x + ox + i * 4 - 6, y, 4, size * 3);
    }
    ctx.restore();
  }

  private drawRain(ctx: CanvasRenderingContext2D, w: number, h: number, intensity: number, dt: number) {
    ctx.save();
    ctx.strokeStyle = 'rgba(180,200,255,0.35)';
    ctx.lineWidth = 1;
    this.rain.forEach(r => {
      r.y += r.speed * intensity * dt * 0.05;
      if (r.y > 1) { r.y = 0; r.x = Math.random(); }
      ctx.beginPath();
      ctx.moveTo(r.x * w, r.y * h);
      ctx.lineTo(r.x * w + r.len * w * 0.2, (r.y + r.len) * h);
      ctx.stroke();
    });
    ctx.restore();
  }

  private drawArtifacts(ctx: CanvasRenderingContext2D, w: number, h: number, artifacts: WorldArtifact[]) {
    artifacts.forEach((a, i) => {
      const x = a.x * w;
      const y = a.y * h;
      const pulse = 1 + Math.sin(this.t * 0.001 + i * 0.7) * 0.12;
      const s = a.scale * 12 * pulse;
      ctx.save();
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = a.color;
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1;
      ctx.translate(x, y);
      ctx.rotate(this.t * 0.0003 + i * 0.4);
      this.drawShape(ctx, a.shape, s);
      ctx.restore();
    });
  }

  private drawShape(ctx: CanvasRenderingContext2D, shape: WorldArtifact['shape'], s: number) {
    ctx.beginPath();
    switch (shape) {
      case 'circle':
        ctx.arc(0, 0, s, 0, Math.PI * 2);
        break;
      case 'triangle':
        ctx.moveTo(0, -s); ctx.lineTo(s * 0.866, s * 0.5); ctx.lineTo(-s * 0.866, s * 0.5);
        ctx.closePath(); break;
      case 'diamond':
        ctx.moveTo(0, -s); ctx.lineTo(s * 0.7, 0); ctx.lineTo(0, s); ctx.lineTo(-s * 0.7, 0);
        ctx.closePath(); break;
      case 'star': {
        for (let p = 0; p < 5; p++) {
          const a1 = (p * 4 * Math.PI) / 5 - Math.PI / 2;
          const a2 = ((p * 4 + 2) * Math.PI) / 5 - Math.PI / 2;
          p === 0 ? ctx.moveTo(Math.cos(a1)*s, Math.sin(a1)*s) : ctx.lineTo(Math.cos(a1)*s, Math.sin(a1)*s);
          ctx.lineTo(Math.cos(a2)*s*0.4, Math.sin(a2)*s*0.4);
        }
        ctx.closePath(); break;
      }
      case 'crystal':
        ctx.moveTo(0, -s*1.2); ctx.lineTo(s*0.5, -s*0.2); ctx.lineTo(s*0.4, s*0.8);
        ctx.lineTo(-s*0.4, s*0.8); ctx.lineTo(-s*0.5, -s*0.2);
        ctx.closePath(); break;
    }
    ctx.fill(); ctx.stroke();
  }

  private updateLeaves(ctx: CanvasRenderingContext2D, w: number, h: number, dt: number, islandX: number, islandY: number) {
    // Spawn new leaves occasionally
    if (Math.random() < 0.015) {
      this.leaves.push({
        x: islandX + (Math.random() - 0.5) * w * 0.12,
        y: islandY - h * 0.06,
        vx: (Math.random() - 0.5) * 0.4,
        vy: -0.1 - Math.random() * 0.2,
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 0.05,
        size: 3 + Math.random() * 5,
        color: `hsl(${100 + Math.random() * 40},${60 + Math.random() * 30}%,${30 + Math.random() * 20}%)`,
        life: 1.0,
      });
    }
    this.leaves = this.leaves.filter(l => l.life > 0);
    this.leaves.forEach(l => {
      l.x += l.vx * dt * 0.05;
      l.vy += 0.002;
      l.y += l.vy * dt * 0.05;
      l.rot += l.vrot * dt * 0.05;
      l.life -= 0.002 * dt * 0.05;
      ctx.save();
      ctx.globalAlpha = l.life;
      ctx.translate(l.x, l.y);
      ctx.rotate(l.rot);
      ctx.fillStyle = l.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, l.size, l.size * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }
}
