import { randomUUID } from 'node:crypto';
import type { Stroke, StrokePoint } from '@it-is-what-is-it/shared';
import type { Room } from './room.js';
import { clearBotTimers } from './room.js';

type Poly = StrokePoint[];

function circle(cx: number, cy: number, r: number, steps = 24): Poly {
  const pts: Poly = [];
  for (let i = 0; i <= steps; i += 1) {
    const a = (i / steps) * Math.PI * 2;
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return pts;
}

function line(x1: number, y1: number, x2: number, y2: number, steps = 12): Poly {
  const pts: Poly = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    pts.push({ x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t });
  }
  return pts;
}

function arc(cx: number, cy: number, r: number, a0: number, a1: number, steps = 16): Poly {
  const pts: Poly = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const a = a0 + (a1 - a0) * t;
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return pts;
}

/** Simple recognizable doodles for common words; fallback is a stylized squiggle. */
function recipeForWord(word: string): Poly[] {
  switch (word) {
    case 'banana':
      return [arc(0.5, 0.5, 0.28, 0.3, 2.6), arc(0.52, 0.48, 0.22, 0.35, 2.5)];
    case 'pizza':
      return [
        line(0.5, 0.18, 0.2, 0.78),
        line(0.5, 0.18, 0.8, 0.78),
        line(0.2, 0.78, 0.8, 0.78),
        circle(0.42, 0.45, 0.03, 8),
        circle(0.55, 0.55, 0.03, 8),
        circle(0.48, 0.62, 0.03, 8),
      ];
    case 'robot':
      return [
        // head
        line(0.35, 0.25, 0.65, 0.25),
        line(0.65, 0.25, 0.65, 0.5),
        line(0.65, 0.5, 0.35, 0.5),
        line(0.35, 0.5, 0.35, 0.25),
        circle(0.43, 0.35, 0.03, 8),
        circle(0.57, 0.35, 0.03, 8),
        line(0.42, 0.43, 0.58, 0.43),
        // body
        line(0.38, 0.5, 0.62, 0.5),
        line(0.62, 0.5, 0.62, 0.78),
        line(0.62, 0.78, 0.38, 0.78),
        line(0.38, 0.78, 0.38, 0.5),
        line(0.5, 0.18, 0.5, 0.25),
        circle(0.5, 0.15, 0.025, 8),
      ];
    case 'rocket':
      return [
        line(0.5, 0.15, 0.38, 0.45),
        line(0.5, 0.15, 0.62, 0.45),
        line(0.38, 0.45, 0.38, 0.7),
        line(0.62, 0.45, 0.62, 0.7),
        line(0.38, 0.7, 0.62, 0.7),
        line(0.38, 0.7, 0.3, 0.85),
        line(0.62, 0.7, 0.7, 0.85),
        line(0.45, 0.7, 0.5, 0.9),
        line(0.55, 0.7, 0.5, 0.9),
        circle(0.5, 0.4, 0.04, 10),
      ];
    case 'umbrella':
      return [
        arc(0.5, 0.42, 0.28, Math.PI, Math.PI * 2),
        line(0.5, 0.42, 0.5, 0.78),
        arc(0.55, 0.78, 0.06, 0, Math.PI),
      ];
    case 'sun':
    case 'meteor':
      return [
        circle(0.5, 0.45, 0.16),
        ...Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2;
          return line(
            0.5 + Math.cos(a) * 0.2,
            0.45 + Math.sin(a) * 0.2,
            0.5 + Math.cos(a) * 0.32,
            0.45 + Math.sin(a) * 0.32,
            4,
          );
        }),
      ];
    case 'dolphin':
    case 'whale':
      return [
        arc(0.48, 0.5, 0.22, -0.4, 3.2),
        arc(0.48, 0.52, 0.14, -0.2, 3.0),
        line(0.68, 0.42, 0.82, 0.32),
        line(0.82, 0.32, 0.74, 0.48),
        circle(0.38, 0.42, 0.015, 6),
      ];
    case 'guitar':
      return [
        circle(0.45, 0.62, 0.14),
        circle(0.45, 0.48, 0.1),
        line(0.5, 0.4, 0.72, 0.18),
        line(0.72, 0.18, 0.78, 0.22),
        line(0.78, 0.22, 0.55, 0.45),
        circle(0.45, 0.58, 0.04, 10),
      ];
    case 'house':
    case 'castle':
      return [
        line(0.25, 0.55, 0.5, 0.25),
        line(0.5, 0.25, 0.75, 0.55),
        line(0.28, 0.55, 0.28, 0.82),
        line(0.72, 0.55, 0.72, 0.82),
        line(0.28, 0.82, 0.72, 0.82),
        line(0.44, 0.82, 0.44, 0.65),
        line(0.56, 0.82, 0.56, 0.65),
        line(0.44, 0.65, 0.56, 0.65),
      ];
    case 'tree':
    case 'cactus':
      return [
        line(0.5, 0.8, 0.5, 0.45),
        circle(0.5, 0.35, 0.16),
        line(0.5, 0.55, 0.32, 0.45),
        line(0.5, 0.6, 0.68, 0.48),
      ];
    case 'cat':
    case 'chameleon':
      return [
        circle(0.45, 0.5, 0.14),
        line(0.38, 0.4, 0.34, 0.28),
        line(0.52, 0.4, 0.56, 0.28),
        circle(0.4, 0.48, 0.02, 6),
        circle(0.5, 0.48, 0.02, 6),
        arc(0.45, 0.55, 0.05, 0.2, Math.PI - 0.2),
        line(0.58, 0.55, 0.78, 0.62),
      ];
    case 'fish':
    case 'seahorse':
      return [
        ellipseApprox(0.45, 0.5, 0.2, 0.12),
        line(0.65, 0.5, 0.8, 0.38),
        line(0.65, 0.5, 0.8, 0.62),
        line(0.8, 0.38, 0.8, 0.62),
        circle(0.35, 0.46, 0.02, 6),
      ];
    case 'moon':
    case 'eclipse':
      return [arc(0.5, 0.5, 0.22, -1.2, 1.8), arc(0.58, 0.48, 0.18, -1.0, 1.6)];
    case 'star':
      return [star(0.5, 0.48, 0.08, 0.22)];
    case 'rainbow':
      return [
        arc(0.5, 0.7, 0.35, Math.PI, Math.PI * 2),
        arc(0.5, 0.7, 0.28, Math.PI, Math.PI * 2),
        arc(0.5, 0.7, 0.21, Math.PI, Math.PI * 2),
      ];
    case 'hamburger':
      return [
        arc(0.5, 0.38, 0.22, Math.PI, Math.PI * 2),
        line(0.28, 0.42, 0.72, 0.42),
        line(0.28, 0.5, 0.72, 0.5),
        line(0.28, 0.58, 0.72, 0.58),
        arc(0.5, 0.62, 0.22, 0, Math.PI),
      ];
    case 'sunglasses':
      return [
        circle(0.38, 0.5, 0.1),
        circle(0.62, 0.5, 0.1),
        line(0.48, 0.5, 0.52, 0.5),
        line(0.28, 0.5, 0.2, 0.45),
        line(0.72, 0.5, 0.8, 0.45),
      ];
    case 'zombie':
    case 'vampire':
    case 'wizard':
      return [
        circle(0.5, 0.35, 0.12),
        line(0.5, 0.47, 0.5, 0.72),
        line(0.5, 0.55, 0.35, 0.65),
        line(0.5, 0.55, 0.65, 0.65),
        line(0.5, 0.72, 0.4, 0.88),
        line(0.5, 0.72, 0.6, 0.88),
      ];
    default:
      return fallbackDoodle(word);
  }
}

function ellipseApprox(cx: number, cy: number, rx: number, ry: number, steps = 28): Poly {
  const pts: Poly = [];
  for (let i = 0; i <= steps; i += 1) {
    const a = (i / steps) * Math.PI * 2;
    pts.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry });
  }
  return pts;
}

function star(cx: number, cy: number, inner: number, outer: number): Poly {
  const pts: Poly = [];
  for (let i = 0; i < 10; i += 1) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? outer : inner;
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  pts.push(pts[0]!);
  return pts;
}

function fallbackDoodle(word: string): Poly[] {
  // Deterministic-ish doodle from word chars so each word feels distinct.
  let seed = 0;
  for (let i = 0; i < word.length; i += 1) seed = (seed + word.charCodeAt(i) * (i + 3)) % 997;
  const strokes: Poly[] = [];
  const blobs = 3 + (seed % 3);
  for (let b = 0; b < blobs; b += 1) {
    const cx = 0.3 + ((seed * (b + 1)) % 40) / 100;
    const cy = 0.3 + ((seed * (b + 5)) % 40) / 100;
    const r = 0.08 + ((seed + b * 7) % 10) / 100;
    strokes.push(circle(cx, cy, r, 18));
  }
  strokes.push(line(0.2, 0.75, 0.8, 0.75, 10));
  strokes.push(arc(0.5, 0.55, 0.25, 0.2, Math.PI - 0.2, 18));
  return strokes;
}

function polysToStrokes(polys: Poly[]): Stroke[] {
  const colors = ['#ff2bd6', '#2de2e6', '#8b5cff', '#ff8a3d', '#ffffff'];
  return polys.map((points, i) => ({
    id: randomUUID(),
    points,
    style: {
      color: colors[i % colors.length]!,
      size: 5 + (i % 3),
      tool: 'brush' as const,
    },
  }));
}

export type BotEmitters = {
  strokeStart: (stroke: Stroke) => void;
  strokePoint: (strokeId: string, point: StrokePoint) => void;
  strokeEnd: (strokeId: string) => void;
};

/** Streams bot strokes into the room over a few seconds. */
export function startBotDrawing(room: Room, word: string, emit: BotEmitters) {
  clearBotTimers(room);
  const strokes = polysToStrokes(recipeForWord(word));
  let delay = 400;

  for (const stroke of strokes) {
    const startDelay = delay;
    const first = stroke.points[0];
    if (!first) continue;

    room.botTimers.push(
      setTimeout(() => {
        if (room.phase !== 'playing' || !room.drawerId) return;
        const startStroke: Stroke = {
          ...stroke,
          points: [first],
        };
        room.strokes.push(startStroke);
        emit.strokeStart(startStroke);

        let pointDelay = 30;
        for (let i = 1; i < stroke.points.length; i += 1) {
          const point = stroke.points[i]!;
          const idx = i;
          room.botTimers.push(
            setTimeout(() => {
              if (room.phase !== 'playing') return;
              const live = room.strokes.find((s) => s.id === stroke.id);
              if (!live) return;
              live.points.push(point);
              emit.strokePoint(stroke.id, point);
              if (idx === stroke.points.length - 1) {
                emit.strokeEnd(stroke.id);
              }
            }, pointDelay),
          );
          pointDelay += 28;
        }
      }, startDelay),
    );

    delay += 350 + stroke.points.length * 28;
  }
}
