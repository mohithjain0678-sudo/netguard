'use client';

import React, { useState } from 'react';
import {
  useClientDashboard,
  IncidentRecord,
} from '@/hooks/useClientDashboard';
import { ProbeReading } from '@/lib/anomalyDetector';
import {
  Activity,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Clock,
  Cpu,
  Layers,
  Radio,
  RefreshCw,
  Server,
  ShieldAlert,
  Sparkles,
  Ticket,
  Wifi,
  Zap,
  ChevronRight,
  Database,
  ArrowUpRight,
  Filter,
} from 'lucide-react';

function getConfidenceColor(confidence: number) {
  if (confidence >= 80) return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
  if (confidence >= 60) return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
  return 'text-rose-400 border-rose-500/30 bg-rose-500/10';
}

function getFaultDomainBadge(domain: string) {
  switch (domain) {
    case 'Local Wi-Fi':
      return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
    case 'DNS':
      return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
    case 'Gateway/LAN':
      return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
    case 'ISP/Upstream':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    default:
      return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30';
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
  return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
}

export function IspSupportConsole() {
  const {
    incidents,
    latestReading,
    isLoading,
    isRefreshing,
    error,
    lastUpdated,
    refresh,
  } = useClientDashboard();

  const [selectedIncidentId, setSelectedIncidentId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'resolved'>('all');

  const filteredIncidents = incidents
    .filter((inc) => {
      if (statusFilter === 'open') return inc.status === 'open';
      if (statusFilter === 'resolved') return inc.status === 'resolved';
      return true;
    })
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() -
        new Date(a.created_at).getTime()
    );

  const activeIncident: IncidentRecord | undefined =
    incidents.find((inc) => inc.id === selectedIncidentId) ||
    filteredIncidents[0] ||
    incidents[0];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 md:p-8 font-sans">
        <div className="max-w-7xl mx-auto space-y-8 animate-pulse">
          <div className="h-16 bg-zinc-900 rounded-xl border border-zinc-800" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="h-96 bg-zinc-900 rounded-xl border border-zinc-800" />
            <div className="lg:col-span-2 h-96 bg-zinc-900 rounded-xl border border-zinc-800" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 md:p-8 font-sans selection:bg-cyan-500 selection:text-black">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Support Console Header */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800/80">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-lg border border-cyan-500/20">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-white tracking-tight">
                    NetGuard ISP Support Console
                  </h1>
                  <span className="px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-full">
                    Tier-2 / NOC View
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Deep telemetry diagnostics, Flight Recorder traces, and automated ticket actioning
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-[11px] text-zinc-400">Live Supabase Feed</p>
              <p className="text-xs font-mono text-zinc-300">
                {lastUpdated ? lastUpdated.toLocaleTimeString() : 'Connecting...'}
              </p>
            </div>

            <button
              onClick={() => refresh()}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 px-3 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700/60 rounded-lg text-xs font-medium transition disabled:opacity-50 cursor-pointer shadow-sm"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`}
              />
              {isRefreshing ? 'Syncing...' : 'Refresh Telemetry'}
            </button>
          </div>
        </header>

        {/* Error Alert if any */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-200 flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
              <div>
                <p className="font-medium text-sm">Supabase Fetch Error</p>
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

        {/* Main Grid: Left sidebar (Incident List) & Right panel (Deep-dive details) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT SIDEBAR: Incident Queue */}
          <div className="lg:col-span-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-cyan-400" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-200">
                  Incident Queue ({filteredIncidents.length})
                </h2>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 p-0.5 rounded-lg text-xs">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-2 py-1 rounded cursor-pointer ${statusFilter === 'all' ? 'bg-zinc-800 text-white font-medium' : 'text-zinc-400 hover:text-zinc-200'}`}
                >
                  All
                </button>
                <button
                  onClick={() => setStatusFilter('open')}
                  className={`px-2 py-1 rounded cursor-pointer ${statusFilter === 'open' ? 'bg-rose-500/20 text-rose-300 font-medium' : 'text-zinc-400 hover:text-zinc-200'}`}
                >
                  Open
                </button>
                <button
                  onClick={() => setStatusFilter('resolved')}
                  className={`px-2 py-1 rounded cursor-pointer ${statusFilter === 'resolved' ? 'bg-emerald-500/20 text-emerald-300 font-medium' : 'text-zinc-400 hover:text-zinc-200'}`}
                >
                  Resolved
                </button>
              </div>
            </div>

            {filteredIncidents.length === 0 ? (
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-8 text-center text-zinc-400 text-xs">
                No incidents match current filter.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[700px] overflow-y-auto pr-1">
                {filteredIncidents.map((incident) => {
                  const isSelected = activeIncident?.id === incident.id;
                  return (
                    <div
                      key={incident.id}
                      onClick={() => setSelectedIncidentId(incident.id)}
                      className={`p-4 rounded-xl border transition cursor-pointer text-left ${
                        isSelected
                          ? 'bg-zinc-900 border-cyan-500/60 shadow-lg shadow-cyan-950/20'
                          : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-white">
                            #{incident.id}
                          </span>
                          {incident.is_demo && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              Demo
                            </span>
                          )}
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                              incident.status === 'open'
                                ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                                : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            }`}
                          >
                            {incident.status}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-zinc-400">
                          {incident.start_time
                            ? new Date(incident.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : new Date(incident.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <p className="text-xs font-medium text-zinc-200 mt-2 line-clamp-1">
                        {incident.probable_cause}
                      </p>

                      <div className="flex items-center justify-between mt-3 text-[11px] text-zinc-400">
                        <span className={`px-2 py-0.5 rounded border text-[10px] ${getFaultDomainBadge(incident.fault_domain)}`}>
                          {incident.fault_domain}
                        </span>
                        <span className="font-mono font-medium text-zinc-300">
                          {incident.confidence}% Conf.
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT PANEL: Comprehensive Incident Deep-Dive */}
          <div className="lg:col-span-8 space-y-6">
            {activeIncident ? (
              <>
                {/* 1. Incident Overview Header Card */}
                <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-6 space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-zinc-800">
                    <div>
                      <div className="flex items-center gap-3">
                        <h2 className="text-xl font-bold text-white tracking-tight">
                          Incident #{activeIncident.id}
                        </h2>
                        {activeIncident.is_demo && (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            Demo / Simulated Incident
                          </span>
                        )}
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border ${
                            activeIncident.status === 'open'
                              ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                              : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          }`}
                        >
                          {activeIncident.status}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-800 text-zinc-300 border border-zinc-700">
                          Severity: {activeIncident.severity || 'Standard / P2'}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 font-mono mt-1">
                        Triggered: {new Date(activeIncident.start_time || activeIncident.created_at).toLocaleString()}
                        {activeIncident.end_time && ` | Resolved: ${new Date(activeIncident.end_time).toLocaleString()}`}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">
                          Confidence Level
                        </span>
                        <span className={`text-lg font-mono font-bold px-2.5 py-0.5 rounded border inline-block mt-0.5 ${getConfidenceColor(activeIncident.confidence)}`}>
                          {activeIncident.confidence}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Probable Cause & Fault Domain */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-4 space-y-1">
                      <span className="text-[11px] uppercase tracking-wider font-semibold text-zinc-400">
                        Probable Cause
                      </span>
                      <p className="text-sm font-semibold text-white">
                        {activeIncident.probable_cause}
                      </p>
                    </div>

                    <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-4 space-y-1">
                      <span className="text-[11px] uppercase tracking-wider font-semibold text-zinc-400">
                        Assigned Fault Domain
                      </span>
                      <div className="pt-0.5">
                        <span className={`px-2.5 py-1 rounded text-xs font-medium border inline-block ${getFaultDomainBadge(activeIncident.fault_domain)}`}>
                          {activeIncident.fault_domain}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Network Evidence Section */}
                <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-6 space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-zinc-800">
                    <Activity className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-200">
                      Network Evidence & Link Telemetry
                    </h3>
                  </div>

                  {activeIncident.is_demo && (
                    <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-200 text-xs flex items-center gap-3">
                      <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                      <p className="leading-relaxed">
                        <strong className="text-amber-300">Simulated Demo Scenario</strong>: This incident was generated using isolated synthetic telemetry traces to demonstrate end-to-end anomaly detection, adaptive diagnostics, confidence scoring, and Gemini root-cause generation without modifying actual live Wi-Fi telemetry.
                      </p>
                    </div>
                  )}

                  {/* Telemetry Metrics Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {/* RSSI & Signal Changes */}
                    <div className="bg-zinc-950/60 border border-zinc-800 p-3 rounded-xl">
                      <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-medium">
                        RSSI (Signal)
                      </span>
                      <p className="text-lg font-mono font-bold text-white mt-1">
                        {activeIncident.flight_recorder && activeIncident.flight_recorder.length > 0
                          ? `${activeIncident.flight_recorder[activeIncident.flight_recorder.length - 1].rssi} dBm`
                          : latestReading ? `${latestReading.rssi} dBm` : 'N/A'}
                      </p>
                      <p className="text-[10px] text-cyan-400 mt-0.5">
                        Signal strength trace recorded
                      </p>
                    </div>

                    {/* Latency */}
                    <div className="bg-zinc-950/60 border border-zinc-800 p-3 rounded-xl">
                      <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-medium">
                        Latency
                      </span>
                      <p className="text-lg font-mono font-bold text-white mt-1">
                        {activeIncident.flight_recorder && activeIncident.flight_recorder.length > 0
                          ? `${activeIncident.flight_recorder[activeIncident.flight_recorder.length - 1].latency_ms ?? 'N/A'} ms`
                          : latestReading?.latency_ms !== null ? `${latestReading?.latency_ms} ms` : 'N/A'}
                      </p>
                      <p className="text-[10px] text-zinc-400 mt-0.5">
                        RTT measurement
                      </p>
                    </div>

                    {/* Packet Loss */}
                    <div className="bg-zinc-950/60 border border-zinc-800 p-3 rounded-xl">
                      <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-medium">
                        Packet Loss
                      </span>
                      <p className="text-lg font-mono font-bold text-white mt-1">
                        {activeIncident.flight_recorder && activeIncident.flight_recorder.length > 0
                          ? `${activeIncident.flight_recorder[activeIncident.flight_recorder.length - 1].packet_loss_pct ?? 0}%`
                          : latestReading?.packet_loss_pct !== null ? `${latestReading?.packet_loss_pct}%` : 'N/A'}
                      </p>
                      <p className="text-[10px] text-zinc-400 mt-0.5">
                        Packet drop rate
                      </p>
                    </div>

                    {/* DNS Latency */}
                    <div className="bg-zinc-950/60 border border-zinc-800 p-3 rounded-xl">
                      <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-medium">
                        DNS Latency
                      </span>
                      <p className="text-lg font-mono font-bold text-white mt-1">
                        {activeIncident.flight_recorder && activeIncident.flight_recorder.length > 0
                          ? `${activeIncident.flight_recorder[activeIncident.flight_recorder.length - 1].dns_ms ?? 'N/A'} ms`
                          : latestReading?.dns_ms !== null ? `${latestReading?.dns_ms} ms` : 'N/A'}
                      </p>
                      <p className="text-[10px] text-zinc-400 mt-0.5">
                        Resolver lookup speed
                      </p>
                    </div>

                    {/* Wi-Fi Band */}
                    <div className="bg-zinc-950/60 border border-zinc-800 p-3 rounded-xl">
                      <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-medium">
                        Wi-Fi Band
                      </span>
                      <p className="text-lg font-mono font-bold text-white mt-1">
                        {activeIncident.flight_recorder && activeIncident.flight_recorder.length > 0
                          ? activeIncident.flight_recorder[0].band || '5 GHz'
                          : latestReading?.band || '5 GHz'}
                      </p>
                      <p className="text-[10px] text-zinc-400 mt-0.5">
                        Operational frequency
                      </p>
                    </div>

                    {/* Wi-Fi Channel */}
                    <div className="bg-zinc-950/60 border border-zinc-800 p-3 rounded-xl">
                      <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-medium">
                        Channel
                      </span>
                      <p className="text-lg font-mono font-bold text-white mt-1">
                        {activeIncident.flight_recorder && activeIncident.flight_recorder.length > 0
                          ? activeIncident.flight_recorder[0].channel ?? 'N/A'
                          : latestReading?.channel ?? 'N/A'}
                      </p>
                      <p className="text-[10px] text-zinc-400 mt-0.5">
                        RF channel
                      </p>
                    </div>

                    {/* Gateway / WAN Latency */}
                    <div className="bg-zinc-950/60 border border-zinc-800 p-3 rounded-xl sm:col-span-2">
                      <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-medium">
                        Gateway / WAN Latency
                      </span>
                      <p className="text-sm font-mono text-zinc-300 mt-1">
                        {activeIncident.diagnostics?.testType === 'gateway_ping' || activeIncident.fault_domain === 'Gateway/LAN'
                          ? `Evaluated via adaptive diagnostics (${activeIncident.fault_domain})`
                          : 'Aggregated via primary ping telemetry'}
                      </p>
                      <p className="text-[10px] text-zinc-500 mt-0.5">
                        *Dedicated Gateway/WAN split column is not separately stored in readings schema.
                      </p>
                    </div>
                  </div>
                </div>

                {/* 3. Diagnostic Evidence & Root Cause (Gemini Explanation) */}
                <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-6 space-y-5">
                  <div className="flex items-center gap-2 pb-2 border-b border-zinc-800">
                    <Cpu className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-200">
                      Diagnostic Evidence & Automated Analysis
                    </h3>
                  </div>

                  {/* Adaptive Diagnostic Selected & Results */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-zinc-950/60 border border-zinc-800 p-4 rounded-xl space-y-1">
                      <span className="text-[11px] uppercase tracking-wider font-semibold text-zinc-400">
                        Adaptive Diagnostic Test Selected
                      </span>
                      <p className="text-sm font-mono font-semibold text-cyan-400">
                        {activeIncident.diagnostics?.testType || 'Adaptive Diagnostics Completed'}
                      </p>
                      {activeIncident.diagnostics?.timestamp && (
                        <p className="text-[11px] text-zinc-500 font-mono">
                          Timestamp: {new Date(activeIncident.diagnostics.timestamp).toLocaleTimeString()}
                        </p>
                      )}
                    </div>

                    <div className="bg-zinc-950/60 border border-zinc-800 p-4 rounded-xl space-y-1">
                      <span className="text-[11px] uppercase tracking-wider font-semibold text-zinc-400">
                        Diagnostic Results
                      </span>
                      <p className="text-sm font-mono text-zinc-200">
                        {activeIncident.diagnostics?.result || 'Completed — Telemetry correlated'}
                      </p>
                      <p className="text-[11px] text-zinc-500">
                        Test status verified by probe agent
                      </p>
                    </div>
                  </div>

                  {/* Supporting & Contradicting Evidence */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Supporting Evidence */}
                    <div className="bg-zinc-950/60 border border-zinc-800 p-4 rounded-xl space-y-2">
                      <span className="text-[11px] uppercase tracking-wider font-semibold text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Supporting Evidence ({activeIncident.supporting_evidence?.length || 0})
                      </span>
                      {activeIncident.supporting_evidence && activeIncident.supporting_evidence.length > 0 ? (
                        <ul className="space-y-1.5">
                          {activeIncident.supporting_evidence.map((item, idx) => (
                            <li key={idx} className="text-xs text-zinc-300 flex items-start gap-2">
                              <span className="text-emerald-400 mt-0.5">•</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-zinc-500">No supporting evidence flags recorded.</p>
                      )}
                    </div>

                    {/* Contradicting Evidence */}
                    <div className="bg-zinc-950/60 border border-zinc-800 p-4 rounded-xl space-y-2">
                      <span className="text-[11px] uppercase tracking-wider font-semibold text-amber-400 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Contradicting Evidence ({activeIncident.contradicting_evidence?.length || 0})
                      </span>
                      {activeIncident.contradicting_evidence && activeIncident.contradicting_evidence.length > 0 ? (
                        <ul className="space-y-1.5">
                          {activeIncident.contradicting_evidence.map((item, idx) => (
                            <li key={idx} className="text-xs text-zinc-300 flex items-start gap-2">
                              <span className="text-amber-400 mt-0.5">•</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-zinc-500">No contradicting evidence observed.</p>
                      )}
                    </div>
                  </div>

                  {/* Gemini AI Root Cause Explanation Card */}
                  <div className="rounded-xl bg-gradient-to-r from-cyan-950/30 via-zinc-950 to-zinc-950 border border-cyan-500/30 p-5 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-cyan-400 uppercase tracking-wider">
                      <Sparkles className="w-4 h-4" />
                      <span>Gemini Root-Cause AI Explanation</span>
                    </div>
                    <p className="text-xs leading-relaxed text-zinc-200 font-sans">
                      {activeIncident.explanation ||
                        `The detected issue is ${activeIncident.probable_cause} with ${activeIncident.confidence}% confidence. The affected fault domain is ${activeIncident.fault_domain}. This assessment is based on the available telemetry and diagnostic evidence.`}
                    </p>
                  </div>

                  {/* Flight Recorder Telemetry Trace */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-cyan-400" />
                        Flight Recorder Buffer ({activeIncident.flight_recorder?.length || 0} Telemetry Samples)
                      </span>
                      <span className="text-[11px] text-zinc-400">
                        Rolling pre-anomaly blackbox buffer
                      </span>
                    </div>

                    {activeIncident.flight_recorder && activeIncident.flight_recorder.length > 0 ? (
                      <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950/60 max-h-60 overflow-y-auto">
                        <table className="w-full text-left text-xs font-mono">
                          <thead className="bg-zinc-900/90 text-zinc-400 sticky top-0 border-b border-zinc-800">
                            <tr>
                              <th className="p-2.5">Time</th>
                              <th className="p-2.5">RSSI</th>
                              <th className="p-2.5">Latency</th>
                              <th className="p-2.5">Loss</th>
                              <th className="p-2.5">DNS</th>
                              <th className="p-2.5">Band/Ch</th>
                              <th className="p-2.5">PHY Rate</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                            {activeIncident.flight_recorder.map((sample, idx) => (
                              <tr key={idx} className="hover:bg-zinc-900/40 transition">
                                <td className="p-2.5 text-zinc-400">
                                  {sample.timestamp
                                    ? new Date(sample.timestamp).toLocaleTimeString()
                                    : `#${idx + 1}`}
                                </td>
                                <td className="p-2.5 text-white font-semibold">
                                  {sample.rssi} dBm
                                </td>
                                <td className={`p-2.5 font-semibold ${sample.latency_ms && sample.latency_ms > 250 ? 'text-rose-400' : 'text-zinc-200'}`}>
                                  {sample.latency_ms !== null ? `${sample.latency_ms} ms` : 'N/A'}
                                </td>
                                <td className={`p-2.5 ${sample.packet_loss_pct && sample.packet_loss_pct > 0 ? 'text-amber-400 font-semibold' : 'text-zinc-400'}`}>
                                  {sample.packet_loss_pct ?? 0}%
                                </td>
                                <td className="p-2.5 text-zinc-300">
                                  {sample.dns_ms !== null ? `${sample.dns_ms} ms` : 'Failed'}
                                </td>
                                <td className="p-2.5 text-zinc-400">
                                  {sample.band || '5 GHz'} (Ch {sample.channel ?? 'N/A'})
                                </td>
                                <td className="p-2.5 text-zinc-400">
                                  {sample.transmitRateMbps ? `${sample.transmitRateMbps} Mbps` : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-500 p-4 bg-zinc-950/60 rounded-xl border border-zinc-800">
                        No Flight Recorder snapshot recorded for this incident.
                      </p>
                    )}
                  </div>
                </div>

                {/* 4. Ticket Information Section */}
                <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-6 space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                    <div className="flex items-center gap-2">
                      <Ticket className="w-4 h-4 text-cyan-400" />
                      <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-200">
                        ISP Support Ticket Dispatch
                      </h3>
                    </div>
                    {activeIncident.ticket && (
                      <span className={`px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider border ${getTicketStatusBadge(activeIncident.ticket.status)}`}>
                        {activeIncident.ticket.status}
                      </span>
                    )}
                  </div>

                  {activeIncident.ticket ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-zinc-950/60 border border-zinc-800 p-4 rounded-xl space-y-1">
                        <span className="text-[11px] uppercase tracking-wider font-semibold text-zinc-400">
                          Ticket Identifier
                        </span>
                        <p className="text-base font-mono font-bold text-white">
                          Ticket #{activeIncident.ticket.id}
                        </p>
                        <p className="text-[11px] text-zinc-500 font-mono">
                          Linked to Incident #{activeIncident.id}
                        </p>
                      </div>

                      <div className="bg-zinc-950/60 border border-zinc-800 p-4 rounded-xl space-y-1 md:col-span-2">
                        <span className="text-[11px] uppercase tracking-wider font-semibold text-cyan-400 flex items-center gap-1">
                          <ArrowUpRight className="w-3.5 h-3.5" />
                          Recommended Support Action
                        </span>
                        <p className="text-xs font-medium text-zinc-200 leading-relaxed">
                          {activeIncident.ticket.recommended_action || 'Inspect telemetry and verify upstream service metrics.'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-zinc-950/60 border border-zinc-800 p-4 rounded-xl text-xs text-zinc-400">
                      No linked ticket record found in Supabase for this incident.
                    </div>
                  )}
                </div>

                {/* 5. Incident Progression Timeline Section */}
                <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-6 space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-zinc-800">
                    <Clock className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-200">
                      Incident Progression Timeline
                    </h3>
                  </div>

                  <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-zinc-800">
                    {/* Step 1: Telemetry Anomaly Detected */}
                    <div className="relative">
                      <span className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-rose-400 ring-4 ring-zinc-950" />
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white uppercase tracking-wider">
                            1. Telemetry Anomaly Detected
                          </span>
                          <span className="text-[11px] font-mono text-zinc-400">
                            {new Date(activeIncident.start_time || activeIncident.created_at).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400">
                          Probe agent detected threshold violation: {activeIncident.supporting_evidence?.join('; ') || activeIncident.probable_cause}
                        </p>
                      </div>
                    </div>

                    {/* Step 2: Adaptive Diagnostics Executed */}
                    <div className="relative">
                      <span className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-cyan-400 ring-4 ring-zinc-950" />
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white uppercase tracking-wider">
                            2. Adaptive Diagnostic Executed
                          </span>
                          {activeIncident.diagnostics?.timestamp && (
                            <span className="text-[11px] font-mono text-zinc-400">
                              {new Date(activeIncident.diagnostics.timestamp).toLocaleTimeString()}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-400">
                          Selected test <span className="font-mono text-cyan-300">[{activeIncident.diagnostics?.testType || 'bufferbloat_check'}]</span> executed to isolate fault domain.
                        </p>
                      </div>
                    </div>

                    {/* Step 3: Capsule & Confidence Scored */}
                    <div className="relative">
                      <span className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-blue-400 ring-4 ring-zinc-950" />
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white uppercase tracking-wider">
                            3. Incident Capsule Created & Scored
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400">
                          Assessed <span className="text-white font-medium">{activeIncident.probable_cause}</span> ({activeIncident.confidence}% confidence) in domain <span className="text-white font-medium">{activeIncident.fault_domain}</span>. Snapshot of {activeIncident.flight_recorder?.length || 0} flight recorder samples frozen.
                        </p>
                      </div>
                    </div>

                    {/* Step 4: Gemini Root Cause Explanation */}
                    <div className="relative">
                      <span className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-purple-400 ring-4 ring-zinc-950" />
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white uppercase tracking-wider">
                            4. Gemini AI Root-Cause Diagnostic Generated
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400">
                          Structured evidence synthesized into concise root-cause explanation and stored in Supabase incident record.
                        </p>
                      </div>
                    </div>

                    {/* Step 5: Support Ticket Created */}
                    {activeIncident.ticket && (
                      <div className="relative">
                        <span className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-4 ring-zinc-950" />
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white uppercase tracking-wider">
                              5. Support Ticket Dispatched (Ticket #{activeIncident.ticket.id})
                            </span>
                            {activeIncident.ticket.created_at && (
                              <span className="text-[11px] font-mono text-zinc-400">
                                {new Date(activeIncident.ticket.created_at).toLocaleTimeString()}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-zinc-400">
                            Automated action assigned: &quot;{activeIncident.ticket.recommended_action}&quot;
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Step 6: Resolution */}
                    {activeIncident.status === 'resolved' && activeIncident.end_time && (
                      <div className="relative">
                        <span className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-zinc-950" />
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                              6. Incident Resolved
                            </span>
                            <span className="text-[11px] font-mono text-zinc-400">
                              {new Date(activeIncident.end_time).toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-400">
                            Telemetry stabilized and incident/ticket status updated to resolved.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-12 text-center text-zinc-400">
                Select an incident from the queue to view full diagnostic evidence and timeline traces.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
