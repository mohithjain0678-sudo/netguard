'use client';

import React, { useState } from 'react';
import { User, ShieldAlert, Activity, Play, Sparkles, Check } from 'lucide-react';

export type ActiveRole = 'client' | 'isp';

interface RoleSwitcherNavProps {
  currentRole: ActiveRole;
  onRoleChange: (role: ActiveRole) => void;
  onSimulateIncident?: () => Promise<boolean>;
  isSimulating?: boolean;
}

export function RoleSwitcherNav({
  currentRole,
  onRoleChange,
  onSimulateIncident,
  isSimulating = false,
}: RoleSwitcherNavProps) {
  const [justSimulated, setJustSimulated] = useState(false);

  const handleSimulate = async () => {
    if (!onSimulateIncident || isSimulating) return;
    const ok = await onSimulateIncident();
    if (ok) {
      setJustSimulated(true);
      setTimeout(() => setJustSimulated(false), 3000);
    }
  };

  return (
    <nav className="bg-zinc-900/90 border-b border-zinc-800 px-4 py-3 sticky top-0 z-50 backdrop-blur-md">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20 flex items-center justify-center">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <span className="font-bold text-white tracking-wide text-sm flex items-center gap-1.5">
              NetGuard AI Telemetry Platform
            </span>
            <span className="text-[11px] text-zinc-400 block sm:inline sm:ml-2">
              Adaptive Diagnostics & Incident Automation
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Simulate Incident Button */}
          {onSimulateIncident && (
            <button
              onClick={handleSimulate}
              disabled={isSimulating}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer shadow-sm ${
                isSimulating
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 cursor-wait opacity-80'
                  : justSimulated
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-orange-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25 hover:border-amber-500/50'
              }`}
              title="Trigger simulated network degradation scenario through diagnostic pipeline"
            >
              {isSimulating ? (
                <>
                  <Sparkles className="w-3.5 h-3.5 animate-spin text-amber-400" />
                  <span>Simulating Incident...</span>
                </>
              ) : justSimulated ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Demo Incident Created!</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  <span>Simulate Incident</span>
                </>
              )}
            </button>
          )}

          {/* Role Switcher Pills */}
          <div className="flex items-center p-1 bg-zinc-950 rounded-xl border border-zinc-800 text-xs font-medium">
            <button
              onClick={() => onRoleChange('client')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition cursor-pointer ${
                currentRole === 'client'
                  ? 'bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Client Dashboard</span>
            </button>

            <button
              onClick={() => onRoleChange('isp')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition cursor-pointer ${
                currentRole === 'isp'
                  ? 'bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/30 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>ISP Support Console</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
