import type { WorldArtifact, TimeOfDay } from '../../types/world';

interface Star  { x: number; y: number; r: number; phase: number; speed: number; color: string }
interface Orb   { x: number; y: number; r: number; angle: number; speed: number; color: string; trailLen: number; trail: {x:number;y:number}[] }
interface Nebula { cx: number; cy: number; rx: number; ry: number; color: string; rot: number }

const PALETTE = ['#ff6b9d','#c44dff','#4dc8ff','#ffcc44','#44ffc8','#ff8844','#88ff44'];

export class NebulaRenderer {
  private stars: Star[] = [];
  private orbs: Orb[] = [];
  private nebulae: Nebula[] = [];
  private t = 0;
  private mouseX = 0.5;
  private mouseY = 0.5;

  init(w: number, h: number) {
    this.stars = Array.from({ length: 350 }, () => ({
      x: Math.random(), y: Math.random(),
      r: Math.random() * 1.8 + 0.2,
      phase: Math.random() * Math.PI * 2,
      speed: 0.0003 + Math.random() * 0.001,
      color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
    }));
    this.orbs = Array.from({ length: 8 }, (_, i) => {
      const angle = (i / 8) * Math.PI * 2;
      const dist = 0.12 + Math.random() * 0.22;
      return {
        x: 0.5 + Math.cos(angle) * dist,
        y: 0.5 + Math.sin(angle) * dist * 0.6,
        r: 5 + Math.random() * 14,
        angle,
        speed: (0.0003 + Math.random() * 0.0004) * (Math.random() > 0.5 ? 1 : -1),
        color: PALETTE[i % PALETTE.length],
        trailLen: 18 + Math.floor(Math.random() * 18),
        trail: [],
      };
    });
    this.nebulae = Array.from({ length: 5 }, () => ({
      cx: 0.2 + Math.random() * 0.6,
      cy: 0.2 + Math.random() * 0.6,
      rx: 0.15 + Math.random() * 0.25,
      ry: 0.1 + Math.random() * 0.2,
      color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
      rot: Math.random() * Math.PI,
    }));
  }

  setMouse(x: number, y: number) { this.mouseX = x; this.mouseY = y; }

  render(ctx: CanvasRenderingContext2D, w: number, h: number, _tod: TimeOfDay, artifacts: WorldArtifact[], dt: number) {
    this.t += dt;

    // ── Deep space background ─────────────────────────────────────
    const bg = ctx.createRadialGradient(w*0.5, h*0.5, 0, w*0.5, h*0.5, Math.max(w,h)*0.7);
    bg.addColorStop(0, '#0a0318');
    bg.addColorStop(0.4, '#060110');
    bg.addColorStop(1, '#020008');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);

    // ── Nebula clouds ─────────────────────────────────────────────
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    this.nebulae.forEach((n, i) => {
      ctx.save();
      ctx.translate(n.cx * w, n.cy * h);
      ctx.rotate(n.rot + this.t * 0.00005);
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, n.rx * w);
      const hex = n.color;
      grad.addColorStop(0, hex + '18');
      grad.addColorStop(0.5, hex + '0a');
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.scale(1, n.ry / n.rx);
      ctx.beginPath(); ctx.arc(0, 0, n.rx * w, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });
    ctx.restore();

    // ── Stars ─────────────────────────────────────────────────────
    this.stars.forEach(s => {
      const alpha = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(this.t * s.speed + s.phase));
      ctx.beginPath();
      ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
      // Color tint for some stars
      ctx.fillStyle = Math.random() < 0.05 ? s.color + 'cc' : `rgba(255,255,255,${alpha})`;
      ctx.fill();
    });

    // ── Centre singularity ────────────────────────────────────────
    const coreX = w * 0.5 + (this.mouseX - 0.5) * 30;
    const coreY = h * 0.5 + (this.mouseY - 0.5) * 20;
    const cg = ctx.createRadialGradient(coreX, coreY, 0, coreX, coreY, 120);
    cg.addColorStop(0, 'rgba(255,255,255,0.9)');
    cg.addColorStop(0.08, 'rgba(200,160,255,0.7)');
    cg.addColorStop(0.3, 'rgba(100,60,200,0.2)');
    cg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(coreX, coreY, 120, 0, Math.PI * 2); ctx.fill();

    // Bright core
    ctx.beginPath(); ctx.arc(coreX, coreY, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff'; ctx.fill();

    // ── Orbiting bodies ───────────────────────────────────────────
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    this.orbs.forEach(orb => {
      orb.angle += orb.speed * dt;
      const dist = Math.sqrt(Math.pow((orb.x - 0.5) * w, 2) + Math.pow((orb.y - 0.5) * h, 2));
      orb.x = 0.5 + Math.cos(orb.angle) * (dist / w);
      orb.y = 0.5 + Math.sin(orb.angle) * (dist / h) * 0.6;
      const ox = orb.x * w, oy = orb.y * h;
      orb.trail.unshift({ x: ox, y: oy });
      if (orb.trail.length > orb.trailLen) orb.trail.pop();

      // Trail
      orb.trail.forEach((pt, i) => {
        const a = (1 - i / orb.trailLen) * 0.6;
        ctx.beginPath(); ctx.arc(pt.x, pt.y, orb.r * (1 - i / orb.trailLen), 0, Math.PI * 2);
        ctx.fillStyle = orb.color + Math.floor(a * 255).toString(16).padStart(2,'0');
        ctx.fill();
      });

      // Orb body
      const og = ctx.createRadialGradient(ox, oy, 0, ox, oy, orb.r * 2.5);
      og.addColorStop(0, '#ffffff');
      og.addColorStop(0.3, orb.color);
      og.addColorStop(1, orb.color + '00');
      ctx.fillStyle = og; ctx.beginPath(); ctx.arc(ox, oy, orb.r * 2.5, 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();

    // ── Artifacts ─────────────────────────────────────────────────
    this.drawArtifacts(ctx, w, h, artifacts);

    // ── Subtle scan lines for depth ───────────────────────────────
    ctx.save();
    ctx.globalAlpha = 0.03;
    for (let y = 0; y < h; y += 3) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, y, w, 1.5);
    }
    ctx.restore();
  }

  private drawArtifacts(ctx: CanvasRenderingContext2D, w: number, h: number, artifacts: WorldArtifact[]) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    artifacts.forEach((a, i) => {
      const x = a.x * w, y = a.y * h;
      const pulse = 1 + Math.sin(this.t * 0.0008 + i) * 0.2;
      const s = a.scale * 10 * pulse;
      // Glow
      const g = ctx.createRadialGradient(x, y, 0, x, y, s * 3);
      g.addColorStop(0, a.color + 'cc');
      g.addColorStop(1, a.color + '00');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, s * 3, 0, Math.PI * 2); ctx.fill();
      // Shape
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(this.t * 0.0005 * (i % 2 === 0 ? 1 : -1) + i);
      ctx.fillStyle = a.color;
      ctx.strokeStyle = '#fff8';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, s, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.restore();
    });
    ctx.restore();
  }
}
