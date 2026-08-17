'use client';

import React, { useState } from 'react';
import {
  useClientDashboard,
  ConnectionStatusType,
  IncidentRecord,
} from '@/hooks/useClientDashboard';
import { ProbeReading } from '@/lib/anomalyDetector';
import {
  Activity,
  Wifi,
  Radio,
  Signal,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  Ticket,
  Clock,
  ShieldCheck,
  Zap,
  HelpCircle,
  Server,
  Layers,
  Sparkles,
  TrendingUp,
} from 'lucide-react';

function getSignalQuality(rssi: number): { label: string; color: string } {
  if (rssi >= -60) return { label: 'Excellent', color: 'text-emerald-400' };
  if (rssi >= -70) return { label: 'Good', color: 'text-green-400' };
  if (rssi >= -80) return { label: 'Fair', color: 'text-amber-400' };
  return { label: 'Poor', color: 'text-rose-400' };
}

function getLatencyQuality(latency: number | null): {
  label: string;
  color: string;
} {
  if (latency === null) return { label: 'Unavailable', color: 'text-zinc-500' };
  if (latency <= 50) return { label: 'Fast', color: 'text-emerald-400' };
  if (latency <= 120) return { label: 'Normal', color: 'text-green-400' };
  if (latency <= 250) return { label: 'Elevated', color: 'text-amber-400' };
  return { label: 'High', color: 'text-rose-400' };
}

function getLossQuality(loss: number | null): { label: string; color: string } {
  if (loss === null) return { label: 'Unavailable', color: 'text-zinc-500' };
  if (loss === 0) return { label: 'Zero Loss', color: 'text-emerald-400' };
  if (loss < 5) return { label: 'Minor', color: 'text-amber-400' };
  return { label: 'Severe', color: 'text-rose-400' };
}

function getDnsQuality(dns: number | null): { label: string; color: string } {
  if (dns === null) return { label: 'Failed', color: 'text-rose-400' };
  if (dns <= 30) return { label: 'Optimal', color: 'text-emerald-400' };
  if (dns <= 100) return { label: 'Good', color: 'text-green-400' };
  return { label: 'Slow', color: 'text-amber-400' };
}

function getConfidenceBadge(confidence: number) {
  if (confidence >= 80) {
    return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
  }
  if (confidence >= 60) {
    return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
  }
  return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';
}

function getFaultDomainBadge(domain: string) {
  switch (domain) {
    case 'Local Wi-Fi':
      return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
    case 'DNS':
      return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
    case 'Gateway/LAN':
      return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    case 'ISP/Upstream':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    default:
      return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';
  }
}

function getTicketStatusBadge(status: string) {
  const s = status.toLowerCase();
  if (s === 'resolved' || s === 'closed') {
    return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
  }
  if (s === 'open' || s === 'active') {
    return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
  }
  if (s === 'in_progress' || s === 'in progress' || s === 'pending') {
    return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
  }
  return 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30';
}

function formatTelemetryTime(raw?: string): string {
  if (!raw) return '';
  try {
    const d = new Date(raw);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '';
  }
}

/* ─────────────────────────────────────────────────────────────
   GRAPH 1: NETWORK HEALTH (Latency & Packet Loss)
   ───────────────────────────────────────────────────────────── */
function NetworkHealthGraph({ history }: { history: ProbeReading[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!history || history.length === 0) {
    return (
      <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-6 flex flex-col justify-between min-h-[300px]">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800/60">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-zinc-200">
              Network Health (Latency & Packet Loss)
            </h3>
          </div>
          <span className="text-[11px] text-zinc-500 font-mono">Live Stream</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center space-y-2 text-zinc-500 py-10">
          <div className="p-3 bg-zinc-800/50 rounded-full animate-pulse">
            <Clock className="w-6 h-6 text-zinc-400" />
          </div>
          <p className="text-xs font-medium text-zinc-400">Waiting for telemetry...</p>
          <p className="text-[11px] text-zinc-600">Probe agent updates approximately every 20 seconds</p>
        </div>
      </div>
    );
  }

  const N = history.length;
  const width = 560;
  const height = 210;
  const padLeft = 48;
  const padRight = 44;
  const padTop = 18;
  const padBottom = 28;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const validLatencies = history
    .map((r) => r.latency_ms)
    .filter((v): v is number => typeof v === 'number' && !isNaN(v));
  const validLosses = history
    .map((r) => r.packet_loss_pct)
    .filter((v): v is number => typeof v === 'number' && !isNaN(v));

  const peakLat = validLatencies.length > 0 ? Math.max(...validLatencies) : 50;
  const maxLat = Math.max(100, Math.ceil((peakLat * 1.25) / 50) * 50);

  const peakLoss = validLosses.length > 0 ? Math.max(...validLosses) : 5;
  const maxLoss = Math.max(10, Math.ceil((peakLoss * 1.25) / 5) * 5);

  const getX = (i: number) =>
    N > 1 ? padLeft + (i / (N - 1)) * plotW : padLeft + plotW / 2;

  const getYLat = (val: number | null) =>
    val === null ? null : padTop + (1 - Math.min(val, maxLat) / maxLat) * plotH;

  const getYLoss = (val: number | null) =>
    val === null ? null : padTop + (1 - Math.min(val, maxLoss) / maxLoss) * plotH;

  // Latency points
  const latPoints: { x: number; y: number; val: number }[] = [];
  history.forEach((r, i) => {
    const y = getYLat(r.latency_ms);
    if (y !== null && r.latency_ms !== null) {
      latPoints.push({ x: getX(i), y, val: r.latency_ms });
    }
  });

  // Packet Loss points
  const lossPoints: { x: number; y: number; val: number }[] = [];
  history.forEach((r, i) => {
    const y = getYLoss(r.packet_loss_pct);
    if (y !== null && r.packet_loss_pct !== null) {
      lossPoints.push({ x: getX(i), y, val: r.packet_loss_pct });
    }
  });

  const latLinePath =
    latPoints.length > 0
      ? latPoints.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
      : '';

  const latAreaPath =
    latPoints.length > 0
      ? `${latLinePath} L ${latPoints[latPoints.length - 1].x.toFixed(1)} ${(padTop + plotH).toFixed(1)} L ${latPoints[0].x.toFixed(1)} ${(padTop + plotH).toFixed(1)} Z`
      : '';

  const lossLinePath =
    lossPoints.length > 0
      ? lossPoints.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
      : '';

  const latestReading = history[history.length - 1];
  const activeReading = hoveredIdx !== null ? history[hoveredIdx] : latestReading;
  const activeHoverIdx = hoveredIdx !== null ? hoveredIdx : history.length - 1;

  // X-axis tick indices
  const tickIndices: number[] = [];
  if (N <= 4) {
    for (let i = 0; i < N; i++) tickIndices.push(i);
  } else {
    tickIndices.push(0);
    tickIndices.push(Math.floor(N / 3));
    tickIndices.push(Math.floor((2 * N) / 3));
    tickIndices.push(N - 1);
  }

  return (
    <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-5 space-y-4 hover:border-zinc-700/80 transition flex flex-col justify-between shadow-sm">
      {/* Header & Legends */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zinc-800/60">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white tracking-tight">
              Network Health
            </h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-zinc-800 text-zinc-300 border border-zinc-700/60">
              {N} sample{N === 1 ? '' : 's'} (20s stream)
            </span>
          </div>
          <p className="text-[11px] text-zinc-400">
            Real-time RTT latency (ms) & packet loss (%)
          </p>
        </div>

        {/* Live Values / Legends */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block shadow-sm shadow-emerald-500/50" />
            <span className="text-zinc-400 text-[11px]">Latency:</span>
            <span className="font-bold text-emerald-400">
              {activeReading?.latency_ms !== null && activeReading?.latency_ms !== undefined
                ? `${activeReading.latency_ms} ms`
                : '—'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-400 inline-block shadow-sm shadow-rose-500/50" />
            <span className="text-zinc-400 text-[11px]">Loss:</span>
            <span className="font-bold text-rose-400">
              {activeReading?.packet_loss_pct !== null && activeReading?.packet_loss_pct !== undefined
                ? `${activeReading.packet_loss_pct}%`
                : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* SVG Chart */}
      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-44 select-none"
          onMouseLeave={() => setHoveredIdx(null)}
        >
          <defs>
            <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid Lines & Left/Right Axis Labels */}
          {[0, 0.33, 0.66, 1].map((pct, idx) => {
            const y = padTop + (1 - pct) * plotH;
            const latVal = Math.round(pct * maxLat);
            const lossVal = Math.round(pct * maxLoss);
            return (
              <g key={idx}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={padLeft + plotW}
                  y2={y}
                  stroke="#27272a"
                  strokeDasharray="3 3"
                  strokeWidth="1"
                />
                {/* Left Axis: Latency (ms) */}
                <text
                  x={padLeft - 6}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-zinc-500 text-[9px] font-mono"
                >
                  {latVal}ms
                </text>
                {/* Right Axis: Loss (%) */}
                <text
                  x={padLeft + plotW + 6}
                  y={y + 3}
                  textAnchor="start"
                  className="fill-zinc-500 text-[9px] font-mono"
                >
                  {lossVal}%
                </text>
              </g>
            );
          })}

          {/* Latency Area Fill */}
          {latAreaPath && <path d={latAreaPath} fill="url(#latencyGradient)" />}

          {/* Latency Line */}
          {latLinePath && (
            <path
              d={latLinePath}
              fill="none"
              stroke="#10b981"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Packet Loss Line */}
          {lossLinePath && (
            <path
              d={lossLinePath}
              fill="none"
              stroke="#f43f5e"
              strokeWidth="2"
              strokeDasharray="4 2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Data Points */}
          {latPoints.map((p, idx) => (
            <circle
              key={`lat-${idx}`}
              cx={p.x}
              cy={p.y}
              r={activeHoverIdx === idx ? 4.5 : 2.5}
              className={`transition-all ${activeHoverIdx === idx ? 'fill-emerald-300 stroke-zinc-950 stroke-2' : 'fill-emerald-400'}`}
            />
          ))}

          {lossPoints.map((p, idx) => (
            <circle
              key={`loss-${idx}`}
              cx={p.x}
              cy={p.y}
              r={activeHoverIdx === idx ? 4.5 : 2.5}
              className={`transition-all ${activeHoverIdx === idx ? 'fill-rose-300 stroke-zinc-950 stroke-2' : 'fill-rose-400'}`}
            />
          ))}

          {/* Hover Crosshair */}
          {hoveredIdx !== null && (
            <line
              x1={getX(hoveredIdx)}
              y1={padTop}
              x2={getX(hoveredIdx)}
              y2={padTop + plotH}
              stroke="#71717a"
              strokeWidth="1"
              strokeDasharray="2 2"
            />
          )}

          {/* X-Axis Bottom Timestamps */}
          {tickIndices.map((idx) => {
            const rawTs = (history[idx] as any)?.created_at || history[idx]?.timestamp;
            const label = formatTelemetryTime(rawTs);
            const x = getX(idx);
            return (
              <text
                key={idx}
                x={x}
                y={padTop + plotH + 18}
                textAnchor={idx === 0 ? 'start' : idx === N - 1 ? 'end' : 'middle'}
                className="fill-zinc-500 text-[9px] font-mono"
              >
                {label}
              </text>
            );
          })}

          {/* Interactive Hover Areas */}
          {history.map((_, idx) => {
            const x = getX(idx);
            const segW = plotW / Math.max(1, N - 1);
            return (
              <rect
                key={`hover-${idx}`}
                x={Math.max(padLeft, x - segW / 2)}
                y={padTop}
                width={Math.min(plotW, segW)}
                height={plotH}
                fill="transparent"
                className="cursor-crosshair"
                onMouseEnter={() => setHoveredIdx(idx)}
              />
            );
          })}
        </svg>
      </div>

      {/* Footer Timestamp Indicator */}
      <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono pt-1">
        <span>Start: {formatTelemetryTime((history[0] as any)?.created_at || history[0]?.timestamp)}</span>
        <span className="hidden sm:inline">Hover points for interval inspection</span>
        <span>Latest: {formatTelemetryTime((latestReading as any)?.created_at || latestReading?.timestamp)}</span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   GRAPH 2: WI-FI SIGNAL HEALTH (RSSI & PHY Rate)
   ───────────────────────────────────────────────────────────── */
function WifiSignalHealthGraph({ history }: { history: ProbeReading[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!history || history.length === 0) {
    return (
      <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-6 flex flex-col justify-between min-h-[300px]">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800/60">
          <div className="flex items-center gap-2">
            <Signal className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-semibold text-zinc-200">
              Wi-Fi Signal Health (RSSI & PHY Rate)
            </h3>
          </div>
          <span className="text-[11px] text-zinc-500 font-mono">Live Stream</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center space-y-2 text-zinc-500 py-10">
          <div className="p-3 bg-zinc-800/50 rounded-full animate-pulse">
            <Radio className="w-6 h-6 text-zinc-400" />
          </div>
          <p className="text-xs font-medium text-zinc-400">Waiting for telemetry...</p>
          <p className="text-[11px] text-zinc-600">Probe agent updates approximately every 20 seconds</p>
        </div>
      </div>
    );
  }

  const N = history.length;
  const width = 560;
  const height = 210;
  const padLeft = 48;
  const padRight = 44;
  const padTop = 18;
  const padBottom = 28;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  // RSSI scale: -100 dBm (bottom) to -30 dBm (top)
  const minRssi = -100;
  const maxRssi = -30;

  const validRates = history
    .map((r) => r.receiveRateMbps ?? r.transmitRateMbps)
    .filter((v): v is number => typeof v === 'number' && !isNaN(v));
  const hasRates = validRates.length > 0;
  const peakRate = hasRates ? Math.max(...validRates) : 100;
  const maxRate = Math.max(100, Math.ceil((peakRate * 1.2) / 50) * 50);

  const getX = (i: number) =>
    N > 1 ? padLeft + (i / (N - 1)) * plotW : padLeft + plotW / 2;

  const getYRssi = (val: number | null) => {
    if (val === null) return null;
    const clamped = Math.max(minRssi, Math.min(maxRssi, val));
    return padTop + ((maxRssi - clamped) / (maxRssi - minRssi)) * plotH;
  };

  const getYRate = (val: number | null) =>
    val === null || !hasRates
      ? null
      : padTop + (1 - Math.min(val, maxRate) / maxRate) * plotH;

  // RSSI points
  const rssiPoints: { x: number; y: number; val: number }[] = [];
  history.forEach((r, i) => {
    const y = getYRssi(r.rssi);
    if (y !== null) {
      rssiPoints.push({ x: getX(i), y, val: r.rssi });
    }
  });

  // PHY rate points if available
  const ratePoints: { x: number; y: number; val: number }[] = [];
  if (hasRates) {
    history.forEach((r, i) => {
      const rateVal = r.receiveRateMbps ?? r.transmitRateMbps ?? null;
      const y = getYRate(rateVal);
      if (y !== null && rateVal !== null) {
        ratePoints.push({ x: getX(i), y, val: rateVal });
      }
    });
  }

  const rssiLinePath =
    rssiPoints.length > 0
      ? rssiPoints.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
      : '';

  const rssiAreaPath =
    rssiPoints.length > 0
      ? `${rssiLinePath} L ${rssiPoints[rssiPoints.length - 1].x.toFixed(1)} ${(padTop + plotH).toFixed(1)} L ${rssiPoints[0].x.toFixed(1)} ${(padTop + plotH).toFixed(1)} Z`
      : '';

  const rateLinePath =
    ratePoints.length > 0
      ? ratePoints.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
      : '';

  const latestReading = history[history.length - 1];
  const activeReading = hoveredIdx !== null ? history[hoveredIdx] : latestReading;
  const activeHoverIdx = hoveredIdx !== null ? hoveredIdx : history.length - 1;

  const tickIndices: number[] = [];
  if (N <= 4) {
    for (let i = 0; i < N; i++) tickIndices.push(i);
  } else {
    tickIndices.push(0);
    tickIndices.push(Math.floor(N / 3));
    tickIndices.push(Math.floor((2 * N) / 3));
    tickIndices.push(N - 1);
  }

  const activeRate = activeReading?.receiveRateMbps ?? activeReading?.transmitRateMbps ?? null;

  return (
    <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-5 space-y-4 hover:border-zinc-700/80 transition flex flex-col justify-between shadow-sm">
      {/* Header & Legends */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zinc-800/60">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Signal className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white tracking-tight">
              Wi-Fi Signal Health
            </h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-zinc-800 text-zinc-300 border border-zinc-700/60">
              {N} sample{N === 1 ? '' : 's'} (20s stream)
            </span>
          </div>
          <p className="text-[11px] text-zinc-400">
            RF signal power (dBm) & link PHY rate (Mbps)
          </p>
        </div>

        {/* Live Values / Legends */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block shadow-sm shadow-cyan-500/50" />
            <span className="text-zinc-400 text-[11px]">RSSI:</span>
            <span className="font-bold text-cyan-400">
              {activeReading?.rssi !== null && activeReading?.rssi !== undefined
                ? `${activeReading.rssi} dBm`
                : '—'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-400 inline-block shadow-sm shadow-purple-500/50" />
            <span className="text-zinc-400 text-[11px]">PHY Rate:</span>
            <span className="font-bold text-purple-400">
              {hasRates && activeRate !== null ? `${activeRate} Mbps` : 'N/A'}
            </span>
          </div>
        </div>
      </div>

      {/* SVG Chart */}
      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-44 select-none"
          onMouseLeave={() => setHoveredIdx(null)}
        >
          <defs>
            <linearGradient id="rssiGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid Lines & Left/Right Axis Labels */}
          {[-30, -50, -70, -90, -100].map((rssiVal, idx) => {
            const y = getYRssi(rssiVal)!;
            const pct = (maxRssi - rssiVal) / (maxRssi - minRssi);
            const rateVal = hasRates ? Math.round((1 - pct) * maxRate) : null;
            return (
              <g key={idx}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={padLeft + plotW}
                  y2={y}
                  stroke="#27272a"
                  strokeDasharray="3 3"
                  strokeWidth="1"
                />
                {/* Left Axis: RSSI (dBm) */}
                <text
                  x={padLeft - 6}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-zinc-500 text-[9px] font-mono"
                >
                  {rssiVal}dBm
                </text>
                {/* Right Axis: PHY Rate (Mbps) */}
                <text
                  x={padLeft + plotW + 6}
                  y={y + 3}
                  textAnchor="start"
                  className="fill-zinc-500 text-[9px] font-mono"
                >
                  {hasRates ? `${rateVal}M` : '—'}
                </text>
              </g>
            );
          })}

          {/* RSSI Area Fill */}
          {rssiAreaPath && <path d={rssiAreaPath} fill="url(#rssiGradient)" />}

          {/* RSSI Line */}
          {rssiLinePath && (
            <path
              d={rssiLinePath}
              fill="none"
              stroke="#06b6d4"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* PHY Rate Line (if available) */}
          {rateLinePath && (
            <path
              d={rateLinePath}
              fill="none"
              stroke="#c084fc"
              strokeWidth="2"
              strokeDasharray="4 2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Data Points */}
          {rssiPoints.map((p, idx) => (
            <circle
              key={`rssi-${idx}`}
              cx={p.x}
              cy={p.y}
              r={activeHoverIdx === idx ? 4.5 : 2.5}
              className={`transition-all ${activeHoverIdx === idx ? 'fill-cyan-300 stroke-zinc-950 stroke-2' : 'fill-cyan-400'}`}
            />
          ))}

          {ratePoints.map((p, idx) => (
            <circle
              key={`rate-${idx}`}
              cx={p.x}
              cy={p.y}
              r={activeHoverIdx === idx ? 4.5 : 2.5}
              className={`transition-all ${activeHoverIdx === idx ? 'fill-purple-300 stroke-zinc-950 stroke-2' : 'fill-purple-400'}`}
            />
          ))}

          {/* Hover Crosshair */}
          {hoveredIdx !== null && (
            <line
              x1={getX(hoveredIdx)}
              y1={padTop}
              x2={getX(hoveredIdx)}
              y2={padTop + plotH}
              stroke="#71717a"
              strokeWidth="1"
              strokeDasharray="2 2"
            />
          )}

          {/* X-Axis Bottom Timestamps */}
          {tickIndices.map((idx) => {
            const rawTs = (history[idx] as any)?.created_at || history[idx]?.timestamp;
            const label = formatTelemetryTime(rawTs);
            const x = getX(idx);
            return (
              <text
                key={idx}
                x={x}
                y={padTop + plotH + 18}
                textAnchor={idx === 0 ? 'start' : idx === N - 1 ? 'end' : 'middle'}
                className="fill-zinc-500 text-[9px] font-mono"
              >
                {label}
              </text>
            );
          })}

          {/* Interactive Hover Areas */}
          {history.map((_, idx) => {
            const x = getX(idx);
            const segW = plotW / Math.max(1, N - 1);
            return (
              <rect
                key={`hover-${idx}`}
                x={Math.max(padLeft, x - segW / 2)}
                y={padTop}
                width={Math.min(plotW, segW)}
                height={plotH}
                fill="transparent"
                className="cursor-crosshair"
                onMouseEnter={() => setHoveredIdx(idx)}
              />
            );
          })}
        </svg>
      </div>

      {/* Footer Channel / Band / Timestamp Indicator */}
      <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono pt-1">
        <span>Channel: {activeReading?.channel ?? latestReading?.channel ?? '—'}</span>
        <span>Band: {activeReading?.band ?? latestReading?.band ?? '5 GHz'}</span>
        <span>Latest: {formatTelemetryTime((latestReading as any)?.created_at || latestReading?.timestamp)}</span>
      </div>
    </div>
  );
}

export function ClientDashboard() {
  const {
    latestReading,
    history,
    connectionStatus,
    statusReason,
    incidents,
    isLoading,
    isRefreshing,
    error,
    lastUpdated,
    refresh,
  } = useClientDashboard();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 md:p-8 font-sans">
        <div className="max-w-6xl mx-auto space-y-8 animate-pulse">
          {/* Header Skeleton */}
          <div className="h-16 bg-zinc-900 rounded-xl border border-zinc-800" />
          {/* Status Banner Skeleton */}
          <div className="h-28 bg-zinc-900 rounded-xl border border-zinc-800" />
          {/* Health Grid Skeleton */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="h-32 bg-zinc-900 rounded-xl border border-zinc-800"
              />
            ))}
          </div>
          {/* Telemetry Graphs Skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-72 bg-zinc-900 rounded-2xl border border-zinc-800" />
            <div className="h-72 bg-zinc-900 rounded-2xl border border-zinc-800" />
          </div>
          {/* Incidents Skeleton */}
          <div className="h-64 bg-zinc-900 rounded-xl border border-zinc-800" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 md:p-8 font-sans selection:bg-emerald-500 selection:text-black">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Top Navigation / Portal Header */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800/80">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
                <Wifi className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-white tracking-tight">
                    NetGuard
                  </h1>
                  <span className="px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full">
                    Client Portal
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Real-time network telemetry, connection health & incident
                  diagnostics
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-[11px] text-zinc-400">Live Supabase Sync</p>
              <p className="text-xs font-mono text-zinc-300">
                {lastUpdated ? lastUpdated.toLocaleTimeString() : 'Connecting...'}
              </p>
            </div>

            <button
              onClick={() => refresh()}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 px-3 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700/60 rounded-lg text-xs font-medium transition disabled:opacity-50 cursor-pointer shadow-sm"
              title="Refresh telemetry"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`}
              />
              {isRefreshing ? 'Syncing...' : 'Refresh'}
            </button>
          </div>
        </header>

        {/* Error Alert if any */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-200 flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
              <div>
                <p className="font-medium text-sm">Telemetry Connection Error</p>
                <p className="text-xs text-rose-300 mt-0.5">{error}</p>
              </div>
            </div>
            <button
              onClick={() => refresh()}
              className="px-3 py-1 bg-rose-800/40 hover:bg-rose-800/60 text-rose-200 text-xs font-medium rounded-lg border border-rose-700/50 transition cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* Section 2: Connection Status Banner */}
        <section>
          <div
            className={`relative overflow-hidden rounded-2xl border p-6 transition-all ${
              connectionStatus === 'Healthy'
                ? 'bg-gradient-to-r from-emerald-950/40 via-zinc-900 to-zinc-900 border-emerald-500/30'
                : connectionStatus === 'Degraded'
                  ? 'bg-gradient-to-r from-amber-950/40 via-zinc-900 to-zinc-900 border-amber-500/30'
                  : 'bg-gradient-to-r from-rose-950/40 via-zinc-900 to-zinc-900 border-rose-500/30'
            }`}
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div
                  className={`p-3.5 rounded-xl border shrink-0 ${
                    connectionStatus === 'Healthy'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : connectionStatus === 'Degraded'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                  }`}
                >
                  {connectionStatus === 'Healthy' && (
                    <CheckCircle2 className="w-7 h-7" />
                  )}
                  {connectionStatus === 'Degraded' && (
                    <AlertTriangle className="w-7 h-7" />
                  )}
                  {connectionStatus === 'Anomaly' && (
                    <AlertCircle className="w-7 h-7" />
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs uppercase tracking-wider font-semibold text-zinc-400">
                      Overall Connection Status
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                        connectionStatus === 'Healthy'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : connectionStatus === 'Degraded'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          connectionStatus === 'Healthy'
                            ? 'bg-emerald-400'
                            : connectionStatus === 'Degraded'
                              ? 'bg-amber-400'
                              : 'bg-rose-400'
                        }`}
                      />
                      {connectionStatus}
                    </span>
                  </div>

                  <h2 className="text-xl font-bold text-white tracking-tight">
                    {connectionStatus === 'Healthy' && 'Network Operating Normally'}
                    {connectionStatus === 'Degraded' &&
                      'Sub-optimal Network Performance'}
                    {connectionStatus === 'Anomaly' &&
                      'Network Anomaly / Disruption Detected'}
                  </h2>

                  <p className="text-sm text-zinc-400 max-w-2xl">{statusReason}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 md:self-center">
                <div className="px-4 py-2 bg-zinc-950/60 border border-zinc-800 rounded-xl text-right">
                  <p className="text-[10px] text-zinc-400 uppercase tracking-wider font-medium">
                    Telemetry Stream
                  </p>
                  <p className="text-xs font-mono font-semibold text-emerald-400 flex items-center gap-1.5 mt-0.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                    Active Online
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 1: Current Connection Health Grid */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <h2 className="text-base font-semibold text-zinc-200">
                Connection Health Telemetry
              </h2>
            </div>
            <span className="text-xs text-zinc-400">
              Live link metrics updated from probe agent
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {/* 1. RSSI */}
            <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-xl p-4 flex flex-col justify-between hover:border-zinc-700 transition">
              <div className="flex items-center justify-between text-zinc-400">
                <span className="text-xs font-medium uppercase tracking-wider">
                  RSSI
                </span>
                <Signal className="w-4 h-4 text-zinc-400" />
              </div>
              <div className="mt-3">
                <p className="text-2xl font-bold font-mono text-white">
                  {latestReading ? `${latestReading.rssi}` : '—'}
                  <span className="text-xs font-normal text-zinc-400 ml-1">
                    dBm
                  </span>
                </p>
                <p
                  className={`text-[11px] font-medium mt-1 ${
                    latestReading
                      ? getSignalQuality(latestReading.rssi).color
                      : 'text-zinc-500'
                  }`}
                >
                  {latestReading
                    ? getSignalQuality(latestReading.rssi).label
                    : 'Awaiting data'}
                </p>
              </div>
            </div>

            {/* 2. Latency */}
            <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-xl p-4 flex flex-col justify-between hover:border-zinc-700 transition">
              <div className="flex items-center justify-between text-zinc-400">
                <span className="text-xs font-medium uppercase tracking-wider">
                  Latency
                </span>
                <Clock className="w-4 h-4 text-zinc-400" />
              </div>
              <div className="mt-3">
                <p className="text-2xl font-bold font-mono text-white">
                  {latestReading && latestReading.latency_ms !== null
                    ? `${latestReading.latency_ms}`
                    : '—'}
                  <span className="text-xs font-normal text-zinc-400 ml-1">
                    ms
                  </span>
                </p>
                <p
                  className={`text-[11px] font-medium mt-1 ${
                    latestReading
                      ? getLatencyQuality(latestReading.latency_ms).color
                      : 'text-zinc-500'
                  }`}
                >
                  {latestReading
                    ? getLatencyQuality(latestReading.latency_ms).label
                    : 'Awaiting data'}
                </p>
              </div>
            </div>

            {/* 3. Packet Loss */}
            <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-xl p-4 flex flex-col justify-between hover:border-zinc-700 transition">
              <div className="flex items-center justify-between text-zinc-400">
                <span className="text-xs font-medium uppercase tracking-wider">
                  Packet Loss
                </span>
                <Zap className="w-4 h-4 text-zinc-400" />
              </div>
              <div className="mt-3">
                <p className="text-2xl font-bold font-mono text-white">
                  {latestReading && latestReading.packet_loss_pct !== null
                    ? `${latestReading.packet_loss_pct}`
                    : '—'}
                  <span className="text-xs font-normal text-zinc-400 ml-1">
                    %
                  </span>
                </p>
                <p
                  className={`text-[11px] font-medium mt-1 ${
                    latestReading
                      ? getLossQuality(latestReading.packet_loss_pct).color
                      : 'text-zinc-500'
                  }`}
                >
                  {latestReading
                    ? getLossQuality(latestReading.packet_loss_pct).label
                    : 'Awaiting data'}
                </p>
              </div>
            </div>

            {/* 4. DNS Latency */}
            <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-xl p-4 flex flex-col justify-between hover:border-zinc-700 transition">
              <div className="flex items-center justify-between text-zinc-400">
                <span className="text-xs font-medium uppercase tracking-wider">
                  DNS Latency
                </span>
                <Server className="w-4 h-4 text-zinc-400" />
              </div>
              <div className="mt-3">
                <p className="text-2xl font-bold font-mono text-white">
                  {latestReading && latestReading.dns_ms !== null
                    ? `${latestReading.dns_ms}`
                    : '—'}
                  <span className="text-xs font-normal text-zinc-400 ml-1">
                    ms
                  </span>
                </p>
                <p
                  className={`text-[11px] font-medium mt-1 ${
                    latestReading
                      ? getDnsQuality(latestReading.dns_ms).color
                      : 'text-zinc-500'
                  }`}
                >
                  {latestReading
                    ? getDnsQuality(latestReading.dns_ms).label
                    : 'Awaiting data'}
                </p>
              </div>
            </div>

            {/* 5. Wi-Fi Band */}
            <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-xl p-4 flex flex-col justify-between hover:border-zinc-700 transition">
              <div className="flex items-center justify-between text-zinc-400">
                <span className="text-xs font-medium uppercase tracking-wider">
                  Wi-Fi Band
                </span>
                <Radio className="w-4 h-4 text-zinc-400" />
              </div>
              <div className="mt-3">
                <p className="text-2xl font-bold font-mono text-white truncate">
                  {latestReading?.band || '5 GHz'}
                </p>
                <p className="text-[11px] font-medium text-cyan-400 mt-1">
                  {latestReading?.bssid
                    ? `AP: ${latestReading.bssid.slice(0, 8)}...`
                    : 'Standard Band'}
                </p>
              </div>
            </div>

            {/* 6. Wi-Fi Channel */}
            <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-xl p-4 flex flex-col justify-between hover:border-zinc-700 transition">
              <div className="flex items-center justify-between text-zinc-400">
                <span className="text-xs font-medium uppercase tracking-wider">
                  Wi-Fi Channel
                </span>
                <Layers className="w-4 h-4 text-zinc-400" />
              </div>
              <div className="mt-3">
                <p className="text-2xl font-bold font-mono text-white">
                  {latestReading?.channel ?? '—'}
                </p>
                <p className="text-[11px] font-medium text-emerald-400 mt-1">
                  Primary Channel
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section: Real-Time Telemetry Trends (20s Stream) */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <h2 className="text-base font-semibold text-zinc-200">
                Live Telemetry Trends (20s Stream)
              </h2>
            </div>
            <span className="text-xs text-zinc-400">
              Continuously updating 20–30 reading historical progression
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <NetworkHealthGraph history={history} />
            <WifiSignalHealthGraph history={history} />
          </div>
        </section>

        {/* Section 3: Recent Incidents */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <h2 className="text-base font-semibold text-zinc-200">
                Recent Network Incidents & Diagnostics
              </h2>
            </div>
            <span className="text-xs text-zinc-400 font-mono">
              {incidents.length} record{incidents.length === 1 ? '' : 's'} logged
            </span>
          </div>

          {incidents.length === 0 ? (
            <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-12 text-center space-y-3">
              <div className="inline-flex p-3 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <h3 className="text-base font-medium text-zinc-200">
                No Incidents Detected
              </h3>
              <p className="text-xs text-zinc-400 max-w-md mx-auto">
                No network anomalies or fault conditions have been recorded.
                Your link telemetry is operating within healthy parameters.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {incidents.map((incident: IncidentRecord) => (
                <div
                  key={incident.id}
                  className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700/80 transition space-y-4"
                >
                  {/* Top Bar of Incident Card */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-zinc-800/60">
                    <div className="flex items-center gap-2.5">
                      <span className="px-2.5 py-0.5 rounded-md bg-zinc-800 text-zinc-200 text-xs font-mono font-semibold border border-zinc-700">
                        Incident #{incident.id}
                      </span>

                      {incident.is_demo && (
                        <span className="px-2.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/30">
                          Demo / Simulated
                        </span>
                      )}

                      <span
                        className={`px-2.5 py-0.5 rounded-md text-xs font-medium border ${getFaultDomainBadge(
                          incident.fault_domain
                        )}`}
                      >
                        {incident.fault_domain}
                      </span>

                      <span
                        className={`px-2.5 py-0.5 rounded-md text-xs font-medium border ${getConfidenceBadge(
                          incident.confidence
                        )}`}
                      >
                        {incident.confidence}% Confidence
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-zinc-400">
                      <div className="flex items-center gap-1 font-mono">
                        <Clock className="w-3.5 h-3.5 text-zinc-500" />
                        <span>
                          {incident.start_time
                            ? new Date(incident.start_time).toLocaleString()
                            : new Date(incident.created_at).toLocaleString()}
                        </span>
                      </div>

                      {/* Ticket Link / Status */}
                      {incident.ticket ? (
                        <div className="flex items-center gap-1.5">
                          <Ticket className="w-3.5 h-3.5 text-zinc-400" />
                          <span className="font-mono text-zinc-300">
                            Ticket #{incident.ticket.id}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${getTicketStatusBadge(
                              incident.ticket.status
                            )}`}
                          >
                            {incident.ticket.status}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-zinc-500">
                          <Ticket className="w-3.5 h-3.5" />
                          <span>No Linked Ticket</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Probable Cause & Status */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="md:col-span-3 space-y-1">
                      <span className="text-[11px] uppercase tracking-wider font-semibold text-zinc-400">
                        Probable Cause
                      </span>
                      <p className="text-base font-semibold text-white">
                        {incident.probable_cause}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[11px] uppercase tracking-wider font-semibold text-zinc-400">
                        Incident Status
                      </span>
                      <div>
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize border ${
                            incident.status === 'resolved'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          }`}
                        >
                          {incident.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Gemini / AI Diagnostic Explanation */}
                  <div className="rounded-lg bg-zinc-950/80 border border-zinc-800/80 p-4 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Diagnostic Explanation</span>
                    </div>
                    <p className="text-xs leading-relaxed text-zinc-300 font-sans">
                      {incident.explanation ||
                        `The detected issue is ${incident.probable_cause} with ${incident.confidence}% confidence. The affected fault domain is ${incident.fault_domain}. This assessment is based on the available telemetry and diagnostic evidence.`}
                    </p>
                  </div>

                  {/* Supporting Evidence tags if available */}
                  {incident.supporting_evidence &&
                    incident.supporting_evidence.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <span className="text-[11px] text-zinc-400 font-medium">
                          Supporting Evidence:
                        </span>
                        {incident.supporting_evidence.map((ev, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 text-[11px] rounded bg-zinc-800/80 text-zinc-300 border border-zinc-700/50"
                          >
                            {ev}
                          </span>
                        ))}
                      </div>
                    )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
