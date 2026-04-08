export interface FlowSceneState {
  feedMode: "demo" | "live";
  executionMode: "paper" | "live";
  liveReady: boolean;
  selectedLabel?: string;
  topEdge: number;
  plannedStake: number;
  openTrades: number;
  stagedTrades: number;
  simulationReady: boolean;
}

interface NodeSpec {
  id: string;
  label: string;
  x: number;
  y: number;
  z: number;
}

interface EdgeSpec {
  from: string;
  to: string;
  weight: number;
}

const NODES: NodeSpec[] = [
  { id: "feed", label: "Feed", x: -210, y: -85, z: -120 },
  { id: "model", label: "Alpha", x: -65, y: -70, z: 80 },
  { id: "rank", label: "Rank", x: -85, y: 88, z: -20 },
  { id: "risk", label: "Risk", x: 55, y: -60, z: -55 },
  { id: "ticket", label: "Ticket", x: 55, y: 82, z: 55 },
  { id: "clob", label: "Polymarket", x: 220, y: -5, z: 45 },
  { id: "blotter", label: "Blotter", x: 210, y: 102, z: -65 },
  { id: "lab", label: "Sim Lab", x: -215, y: 98, z: 95 }
];

const EDGES: EdgeSpec[] = [
  { from: "feed", to: "model", weight: 1 },
  { from: "feed", to: "rank", weight: 0.8 },
  { from: "model", to: "rank", weight: 1 },
  { from: "rank", to: "risk", weight: 0.7 },
  { from: "rank", to: "ticket", weight: 1 },
  { from: "lab", to: "rank", weight: 0.65 },
  { from: "lab", to: "ticket", weight: 0.5 },
  { from: "risk", to: "ticket", weight: 0.85 },
  { from: "ticket", to: "clob", weight: 1 },
  { from: "ticket", to: "blotter", weight: 0.8 },
  { from: "clob", to: "blotter", weight: 1 }
];

function projectPoint(
  x: number,
  y: number,
  z: number,
  angle: number,
  width: number,
  height: number
): { x: number; y: number; scale: number } {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const rotatedX = x * cos - z * sin;
  const rotatedZ = x * sin + z * cos;
  const depth = rotatedZ + 340;
  const scale = 340 / depth;
  return {
    x: width / 2 + rotatedX * scale,
    y: height / 2 + y * scale,
    scale
  };
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

export function mountFlowScene(
  canvas: HTMLCanvasElement,
  getState: () => FlowSceneState
): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return () => undefined;
  }

  let frameId = 0;
  let running = true;

  const render = (time: number) => {
    if (!running) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(320, Math.round(rect.width || 320));
    const height = Math.max(280, Math.round(rect.height || 280));
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    const state = getState();
    const angle = time * 0.00018;
    const pulse = 0.5 + 0.5 * Math.sin(time * 0.0016);
    const liveAccent = state.liveReady && state.executionMode === "live";
    const background = ctx.createLinearGradient(0, 0, 0, height);
    background.addColorStop(0, "#0b1015");
    background.addColorStop(1, "#090c10");

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    for (let x = 22; x < width; x += 44) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 22; y < height; y += 44) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    const points = new Map(
      NODES.map((node) => [
        node.id,
        projectPoint(node.x, node.y, node.z, angle, width, height)
      ])
    );

    for (const edge of EDGES) {
      const from = points.get(edge.from);
      const to = points.get(edge.to);
      if (!from || !to) {
        continue;
      }
      const gradient = ctx.createLinearGradient(from.x, from.y, to.x, to.y);
      gradient.addColorStop(0, "rgba(255, 159, 10, 0.08)");
      gradient.addColorStop(0.5, liveAccent ? "rgba(103, 183, 255, 0.34)" : "rgba(255, 159, 10, 0.3)");
      gradient.addColorStop(1, "rgba(69, 212, 131, 0.14)");
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 1 + edge.weight * 1.2;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.bezierCurveTo(
        from.x + (to.x - from.x) * 0.3,
        from.y - 18 * edge.weight,
        from.x + (to.x - from.x) * 0.7,
        to.y + 18 * edge.weight,
        to.x,
        to.y
      );
      ctx.stroke();

      const progress = (time * 0.00022 * edge.weight + edge.weight * 0.13) % 1;
      const pulseX = from.x + (to.x - from.x) * progress;
      const pulseY = from.y + (to.y - from.y) * progress;
      ctx.fillStyle = liveAccent ? "#67b7ff" : "#ff9f0a";
      ctx.globalAlpha = 0.35 + pulse * 0.45;
      ctx.beginPath();
      ctx.arc(pulseX, pulseY, 2 + edge.weight * 1.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    const sortedNodes = [...NODES].sort(
      (left, right) => (points.get(left.id)?.scale ?? 1) - (points.get(right.id)?.scale ?? 1)
    );

    for (const node of sortedNodes) {
      const point = points.get(node.id);
      if (!point) {
        continue;
      }
      const radius = 15 * point.scale + (node.id === "clob" && liveAccent ? 3 : 0);
      const active =
        (node.id === "feed" && state.feedMode === "live") ||
        (node.id === "clob" && state.executionMode === "live") ||
        (node.id === "lab" && state.simulationReady) ||
        node.id === "ticket";

      ctx.fillStyle = active ? "rgba(255, 159, 10, 0.18)" : "rgba(255,255,255,0.05)";
      ctx.strokeStyle = active ? "#ff9f0a" : "rgba(255,255,255,0.2)";
      ctx.lineWidth = active ? 1.6 : 1;
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      const labelWidth = Math.max(54, ctx.measureText(node.label).width + 20);
      ctx.fillStyle = "rgba(7, 10, 14, 0.9)";
      ctx.strokeStyle = active ? "rgba(255, 159, 10, 0.35)" : "rgba(255,255,255,0.08)";
      drawRoundedRect(ctx, point.x - labelWidth / 2, point.y + radius + 8, labelWidth, 20, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = active ? "#fff3d6" : "#d6dde3";
      ctx.font = "11px IBM Plex Mono, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(node.label, point.x, point.y + radius + 18);
    }

    ctx.fillStyle = "#ff9f0a";
    ctx.font = "700 11px IBM Plex Mono, monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("3D execution flow", 16, 14);

    ctx.fillStyle = "#d6dde3";
    ctx.font = "11px IBM Plex Sans, sans-serif";
    ctx.fillText(
      `${state.selectedLabel ?? "No contract selected"} | top edge ${(state.topEdge * 100).toFixed(1)}%`,
      16,
      32
    );
    ctx.fillText(
      `${state.openTrades} open | ${state.stagedTrades} staged | planned ${Math.round(state.plannedStake)}`,
      16,
      48
    );

    frameId = window.requestAnimationFrame(render);
  };

  frameId = window.requestAnimationFrame(render);

  return () => {
    running = false;
    window.cancelAnimationFrame(frameId);
  };
}
