import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { Stroke, StrokePoint } from '@sinetch/shared';

const COLORS = ['#111111', '#ffffff', '#ff2bd6', '#2de2e6', '#8b5cff', '#ff8a3d', '#b8ff3d', '#ff5e7a', '#f5e6a8', '#3b82f6'];
const SIZES = [3, 6, 10, 16, 24];

function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke, width: number, height: number) {
  if (stroke.points.length === 0) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = stroke.style.size;
  if (stroke.style.tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = 'rgba(0,0,0,1)';
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = stroke.style.color;
  }
  const pts = stroke.points;
  ctx.beginPath();
  ctx.moveTo(pts[0]!.x * width, pts[0]!.y * height);
  if (pts.length === 1) {
    ctx.lineTo(pts[0]!.x * width + 0.01, pts[0]!.y * height);
  } else {
    for (let i = 1; i < pts.length - 1; i++) {
      const midX = ((pts[i]!.x + pts[i + 1]!.x) / 2) * width;
      const midY = ((pts[i]!.y + pts[i + 1]!.y) / 2) * height;
      ctx.quadraticCurveTo(pts[i]!.x * width, pts[i]!.y * height, midX, midY);
    }
    const last = pts[pts.length - 1]!;
    ctx.lineTo(last.x * width, last.y * height);
  }
  ctx.stroke();
  ctx.restore();
}

function redrawAll(canvas: HTMLCanvasElement, strokes: Stroke[]) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#fffef8';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (const stroke of strokes) drawStroke(ctx, stroke, canvas.width, canvas.height);
}

type Props = {
  strokes: Stroke[];
  canDraw: boolean;
  onStrokeStart: (stroke: Stroke) => void;
  onStrokePoint: (strokeId: string, point: StrokePoint) => void;
  onStrokeEnd: (strokeId: string) => void;
  onUndo: () => void;
  onClear: () => void;
};

export function DrawingCanvas({
  strokes,
  canDraw,
  onStrokeStart,
  onStrokePoint,
  onStrokeEnd,
  onUndo,
  onClear,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const drawingId = useRef<string | null>(null);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const [color, setColor] = useState(COLORS[2]!);
  const [size, setSize] = useState(6);
  const [tool, setTool] = useState<'brush' | 'eraser'>('brush');

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    const frame = frameRef.current;
    if (!canvas || !frame) return;
    const rect = frame.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    redrawAll(canvas, strokes);
  }, [strokes]);

  useEffect(() => {
    resize();
    const ro = new ResizeObserver(resize);
    if (frameRef.current) ro.observe(frameRef.current);
    return () => ro.disconnect();
  }, [resize]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) redrawAll(canvas, strokes);
  }, [strokes]);

  const toNorm = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (clientY - rect.top) / rect.height)),
    };
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!canDraw) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const point = toNorm(e.clientX, e.clientY);
    const id = crypto.randomUUID();
    drawingId.current = id;
    lastPoint.current = point;
    onStrokeStart({ id, points: [point], style: { color, size, tool } });
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!canDraw || !drawingId.current) return;
    const point = toNorm(e.clientX, e.clientY);
    const last = lastPoint.current;
    if (last) {
      const dx = point.x - last.x;
      const dy = point.y - last.y;
      const dist = Math.hypot(dx, dy);
      const steps = Math.min(8, Math.floor(dist * 80));
      for (let i = 1; i <= steps; i++) {
        const t = i / (steps + 1);
        onStrokePoint(drawingId.current, { x: last.x + dx * t, y: last.y + dy * t });
      }
    }
    onStrokePoint(drawingId.current, point);
    lastPoint.current = point;
  };

  const endStroke = () => {
    if (!drawingId.current) return;
    onStrokeEnd(drawingId.current);
    drawingId.current = null;
    lastPoint.current = null;
  };

  return (
    <div className="canvas-wrap" style={{ height: '100%' }}>
      <div className="canvas-frame" ref={frameRef} style={{ flex: 1, minHeight: 240 }}>
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endStroke}
          onPointerCancel={endStroke}
          style={{ cursor: canDraw ? 'crosshair' : 'default', width: '100%', height: '100%' }}
        />
      </div>
      {canDraw && (
        <div className="toolbar">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`swatch ${color === c && tool === 'brush' ? 'active' : ''}`}
              style={{ background: c }}
              onClick={() => {
                setColor(c);
                setTool('brush');
              }}
              aria-label={`Color ${c}`}
            />
          ))}
          <select value={size} onChange={(e) => setSize(Number(e.target.value))} aria-label="Brush size">
            {SIZES.map((s) => (
              <option key={s} value={s}>
                Size {s}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={`tool-btn ${tool === 'eraser' ? 'active' : ''}`}
            onClick={() => setTool('eraser')}
          >
            Eraser
          </button>
          <button type="button" className="tool-btn" onClick={onUndo}>
            Undo
          </button>
          <button type="button" className="tool-btn" onClick={onClear}>
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
