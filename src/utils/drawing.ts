import { HAND_CONNECTIONS } from '../ai/constants';
import type { FrameData } from '../types';

export interface DrawOptions {
  mirror: boolean;
  boxes: boolean;
}

const COLORS = { Right: '#3ee6f5', Left: '#4d8dff' } as const;

/** Draw skeletons, joints, bounding boxes and handedness labels for every detected hand. */
export function drawHands(ctx: CanvasRenderingContext2D, frame: FrameData | null, options: DrawOptions): void {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);
  if (!frame) return;
  const px = (x: number) => (options.mirror ? 1 - x : x) * width;
  const py = (y: number) => y * height;
  const scale = Math.max(1, width / 640);

  for (const hand of frame.hands) {
    const color = COLORS[hand.handedness];
    const pts = hand.landmarks;
    ctx.lineWidth = 3 * scale;
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8 * scale;
    ctx.beginPath();
    for (const [a, b] of HAND_CONNECTIONS) {
      ctx.moveTo(px(pts[a].x), py(pts[a].y));
      ctx.lineTo(px(pts[b].x), py(pts[b].y));
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    for (const p of pts) {
      ctx.beginPath();
      ctx.arc(px(p.x), py(p.y), 3.5 * scale, 0, Math.PI * 2);
      ctx.fill();
    }

    const xs = pts.map((p) => px(p.x));
    const ys = pts.map((p) => py(p.y));
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const pad = 12 * scale;
    if (options.boxes) {
      ctx.strokeStyle = `${color}aa`;
      ctx.lineWidth = 1.5 * scale;
      ctx.setLineDash([6 * scale, 4 * scale]);
      ctx.strokeRect(minX - pad, minY - pad, Math.max(...xs) - minX + pad * 2, Math.max(...ys) - minY + pad * 2);
      ctx.setLineDash([]);
    }
    const label = `${hand.handedness} ${(hand.score * 100).toFixed(0)}%`;
    ctx.font = `600 ${12 * scale}px Inter, system-ui, sans-serif`;
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = 'rgba(5,10,24,0.8)';
    ctx.fillRect(minX - pad, minY - pad - 20 * scale, tw + 12 * scale, 18 * scale);
    ctx.fillStyle = color;
    ctx.fillText(label, minX - pad + 6 * scale, minY - pad - 6 * scale);
  }
}
