import type { WorldArtifact, TimeOfDay, WeatherCondition } from '../../types/world';

interface Fish   { x: number; y: number; vx: number; vy: number; size: number; color: string; flap: number; scared: boolean }
interface Bubble { x: number; y: number; r: number; speed: number; wobble: number; phase: number }
interface Kelp   { x: number; segs: { ox: number }[]; color: string; height: number }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: string }

export class UnderwaterRenderer {
  private fish: Fish[] = [];
  private bubbles: Bubble[] = [];
  private kelp: Kelp[] = [];
  private particles: Particle[] = [];
  private t = 0;
  private mouseX = 0.5;
  private mouseY = 0.5;
  private lastMouseX = 0.5;
  private lastMouseY = 0.5;

  init(w: number, h: number) {
    this.fish = Array.from({ length: 22 }, () => ({
      x: Math.random(),
      y: 0.15 + Math.random() * 0.65,
      vx: (Math.random() * 0.0012 + 0.0004) * (Math.random() > 0.5 ? 1 : -1),
      vy: 0,
      size: 6 + Math.random() * 22,
      color: this.randomFishColor(),
      flap: Math.random() * Math.PI * 2,
      scared: false,
    }));
    this.bubbles = Array.from({ length: 30 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 2 + Math.random() * 8,
      speed: 0.0003 + Math.random() * 0.0006,
      wobble: Math.random() * 0.003,
      phase: Math.random() * Math.PI * 2,
    }));
    this.kelp = Array.from({ length: 12 }, () => ({
      x: Math.random(),
      segs: Array.from({ length: 10 }, () => ({ ox: 0 })),
      color: `hsl(${120 + Math.random() * 40},${50 + Math.random() * 30}%,${20 + Math.random() * 20}%)`,
      height: 0.15 + Math.random() * 0.3,
    }));
  }

  setMouse(x: number, y: number) {
    this.lastMouseX = this.mouseX;
    this.lastMouseY = this.mouseY;
    this.mouseX = x;
    this.mouseY = y;
  }

  private randomFishColor(): string {
    const hues = [15, 30, 45, 180, 200, 280, 340];
    const h = hues[Math.floor(Math.random() * hues.length)] + (Math.random() - 0.5) * 20;
    return `hsl(${h},${70 + Math.random() * 25}%,${55 + Math.random() * 20}%)`;
  }

  render(
    ctx: CanvasRenderingContext2D, w: number, h: number,
    tod: TimeOfDay, weather: WeatherCondition, artifacts: WorldArtifact[], dt: number,
  ) {
    this.t += dt;

    // ── Water gradient ────────────────────────────────────────────
    const depthColors: Record<TimeOfDay, [string, string, string]> = {
      dawn:      ['#0d3a5c', '#0a2040', '#06101e'],
      morning:   ['#0a5c8a', '#083d5e', '#041e30'],
      afternoon: ['#0d6fa0', '#0a4a6e', '#05253a'],
      dusk:      ['#1a2a4a', '#0d1a30', '#060d18'],
      night:     ['#060d1a', '#030810', '#010508'],
    };
    const [d1, d2, d3] = depthColors[tod];
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, d1); bg.addColorStop(0.5, d2); bg.addColorStop(1, d3);
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);

    // ── Caustic light rays from surface ───────────────────────────
    if (tod !== 'night') {
      this.drawCaustics(ctx, w, h, tod);
    }

    // ── Sand / seabed ─────────────────────────────────────────────
    this.drawSeabed(ctx, w, h);

    // ── Kelp ──────────────────────────────────────────────────────
    this.kelp.forEach(k => this.drawKelp(ctx, k, w, h));

    // ── Coral / rocks ─────────────────────────────────────────────
    this.drawCorals(ctx, w, h, tod);

    // ── Bubbles ───────────────────────────────────────────────────
    this.bubbles.forEach(b => {
      b.y -= b.speed * dt;
      b.x += Math.sin(this.t * b.wobble + b.phase) * 0.001;
      if (b.y < -0.05) { b.y = 1.05; b.x = Math.random(); }
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.beginPath(); ctx.arc(b.x * w, b.y * h, b.r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(180,220,255,0.8)'; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.fillStyle = 'rgba(200,230,255,0.08)'; ctx.fill();
      ctx.restore();
    });

    // ── Fish ──────────────────────────────────────────────────────
    this.fish.forEach(f => {
      // React to mouse
      const dx = this.mouseX - f.x;
      const dy = this.mouseY - f.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      f.scared = dist < 0.12;
      if (f.scared) {
        f.vx -= dx * 0.00008 * dt;
        f.vy -= dy * 0.00008 * dt;
      } else {
        f.vy *= 0.98;
        f.vy += (0.5 - f.y) * 0.0001;
      }
      // Clamp speed
      const speed = Math.sqrt(f.vx*f.vx + f.vy*f.vy);
      const maxSpd = 0.003;
      if (speed > maxSpd) { f.vx = (f.vx/speed)*maxSpd; f.vy = (f.vy/speed)*maxSpd; }
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      if (f.x < -0.05) f.x = 1.05;
      if (f.x > 1.05) f.x = -0.05;
      f.y = Math.max(0.1, Math.min(0.88, f.y));
      f.flap += 0.15 * dt * 0.05;
      this.drawFish(ctx, f, w, h);
    });

    // ── Artifacts ─────────────────────────────────────────────────
    this.drawArtifacts(ctx, w, h, artifacts);

    // ── Surface shimmer ───────────────────────────────────────────
    const surf = ctx.createLinearGradient(0, 0, 0, h * 0.12);
    surf.addColorStop(0, 'rgba(120,200,255,0.25)');
    surf.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = surf; ctx.fillRect(0, 0, w, h * 0.12);

    // Surface wave lines
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(0, h * (0.02 + i * 0.02));
      for (let x = 0; x <= w; x += 6) {
        ctx.lineTo(x, h * (0.02 + i * 0.02) + Math.sin(x / w * Math.PI * 8 + this.t * 0.001 + i) * 4);
      }
      ctx.strokeStyle = `rgba(150,220,255,${0.12 - i * 0.03})`; ctx.lineWidth = 1.5; ctx.stroke();
    }

    // ── Water overlay tint ────────────────────────────────────────
    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = '#004466';
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  private drawCaustics(ctx: CanvasRenderingContext2D, w: number, h: number, tod: TimeOfDay) {
    const intensity = tod === 'afternoon' ? 0.12 : tod === 'morning' ? 0.08 : 0.04;
    ctx.save();
    ctx.globalAlpha = intensity;
    for (let i = 0; i < 8; i++) {
      const x = (Math.sin(this.t * 0.0003 + i * 0.8) * 0.5 + 0.5) * w;
      const angle = -0.3 + Math.sin(this.t * 0.0002 + i) * 0.15;
      const rayH = h * (0.3 + Math.random() * 0.4);
      ctx.save();
      ctx.translate(x, 0);
      ctx.rotate(angle);
      const rg = ctx.createLinearGradient(0, 0, 0, rayH);
      rg.addColorStop(0, 'rgba(180,230,255,0.8)');
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rg;
      const width = 15 + Math.sin(this.t * 0.001 + i) * 8;
      ctx.fillRect(-width/2, 0, width, rayH);
      ctx.restore();
    }
    ctx.restore();
  }

  private drawSeabed(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const bedY = h * 0.88;
    ctx.beginPath();
    ctx.moveTo(0, bedY);
    for (let x = 0; x <= w; x += 20) {
      ctx.lineTo(x, bedY + Math.sin(x * 0.02) * 6);
    }
    ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
    const sg = ctx.createLinearGradient(0, bedY, 0, h);
    sg.addColorStop(0, '#c8b068'); sg.addColorStop(1, '#8a6a30');
    ctx.fillStyle = sg; ctx.fill();
  }

  private drawKelp(ctx: CanvasRenderingContext2D, k: Kelp, w: number, h: number) {
    const baseX = k.x * w;
    const baseY = h * 0.88;
    const segH = (k.height * h) / k.segs.length;
    ctx.save();
    ctx.strokeStyle = k.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    let cx = baseX, cy = baseY;
    k.segs.forEach((seg, i) => {
      seg.ox = Math.sin(this.t * 0.0008 + k.x * 10 + i * 0.4) * (i + 1) * 3;
      ctx.lineTo(cx + seg.ox, cy - segH);
      cx += seg.ox; cy -= segH;
    });
    ctx.stroke();
    ctx.restore();
  }

  private drawCorals(ctx: CanvasRenderingContext2D, w: number, h: number, tod: TimeOfDay) {
    const coralColors = tod === 'night'
      ? ['#1a4060', '#0d2030', '#102030']
      : ['#e05050', '#e08030', '#e0c020', '#50c080', '#8050e0'];
    const positions = [0.08, 0.18, 0.35, 0.55, 0.72, 0.85, 0.94];
    positions.forEach((px, i) => {
      const x = px * w;
      const y = h * 0.88;
      const color = coralColors[i % coralColors.length];
      const size = 8 + (i % 3) * 6;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      // Simple branching coral
      const drawBranch = (bx: number, by: number, len: number, angle: number, depth: number) => {
        if (depth === 0 || len < 3) return;
        const ex = bx + Math.cos(angle) * len;
        const ey = by + Math.sin(angle) * len;
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey);
        ctx.lineWidth = depth * 1.2; ctx.stroke();
        drawBranch(ex, ey, len * 0.65, angle - 0.45, depth - 1);
        drawBranch(ex, ey, len * 0.65, angle + 0.45, depth - 1);
      };
      drawBranch(x, y, size, -Math.PI / 2, 4);
      ctx.restore();
    });
  }

  private drawFish(ctx: CanvasRenderingContext2D, f: Fish, w: number, h: number) {
    const fx = f.x * w, fy = f.y * h;
    const dir = f.vx >= 0 ? 1 : -1;
    ctx.save();
    ctx.translate(fx, fy);
    ctx.scale(dir, 1);
    const tailWag = Math.sin(f.flap) * (f.scared ? 0.4 : 0.2);
    // Body
    ctx.beginPath();
    ctx.ellipse(0, 0, f.size, f.size * 0.45, 0, 0, Math.PI * 2);
    ctx.fillStyle = f.color; ctx.fill();
    // Tail
    ctx.beginPath();
    ctx.moveTo(-f.size * 0.7, 0);
    ctx.lineTo(-f.size * 1.4, f.size * (0.5 + tailWag));
    ctx.lineTo(-f.size * 1.4, -f.size * (0.5 - tailWag));
    ctx.closePath();
    ctx.fillStyle = f.color; ctx.fill();
    // Eye
    ctx.beginPath(); ctx.arc(f.size * 0.5, -f.size * 0.1, f.size * 0.14, 0, Math.PI * 2);
    ctx.fillStyle = '#111'; ctx.fill();
    ctx.beginPath(); ctx.arc(f.size * 0.52, -f.size * 0.12, f.size * 0.05, 0, Math.PI * 2);
    ctx.fillStyle = '#fff'; ctx.fill();
    // Fin
    ctx.beginPath();
    ctx.moveTo(0, -f.size * 0.4);
    ctx.lineTo(f.size * 0.3, -f.size * 0.75);
    ctx.lineTo(-f.size * 0.1, -f.size * 0.42);
    ctx.closePath();
    ctx.fillStyle = f.color; ctx.globalAlpha = 0.7; ctx.fill();
    ctx.restore();
  }

  private drawArtifacts(ctx: CanvasRenderingContext2D, w: number, h: number, artifacts: WorldArtifact[]) {
    artifacts.forEach((a, i) => {
      const x = a.x * w;
      const y = a.y * h * 0.85 + h * 0.05;
      const drift = Math.sin(this.t * 0.0006 + i * 1.2) * 6;
      ctx.save();
      ctx.translate(x + drift, y);
      ctx.rotate(this.t * 0.0003 + i * 0.5);
      ctx.globalAlpha = 0.8;
      const s = a.scale * 10;
      // Bioluminescent glow
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 3);
      g.addColorStop(0, a.color + 'aa');
      g.addColorStop(1, a.color + '00');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, s*3, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = a.color;
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, s, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.restore();
    });
  }
}
