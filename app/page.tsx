'use client';

import React, { useState } from 'react';
import { RoleSwitcherNav, ActiveRole } from '@/components/RoleSwitcherNav';
import { ClientDashboard } from '@/components/ClientDashboard';
import { IspSupportConsole } from '@/components/IspSupportConsole';
import { useClientDashboard } from '@/hooks/useClientDashboard';

export default function Home() {
  const [activeRole, setActiveRole] = useState<ActiveRole>('client');
  const { simulateIncident, isSimulating } = useClientDashboard();

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      <RoleSwitcherNav
        currentRole={activeRole}
        onRoleChange={(role) => setActiveRole(role)}
        onSimulateIncident={simulateIncident}
        isSimulating={isSimulating}
      />
      <main className="flex-1">
        {activeRole === 'client' ? (
          <ClientDashboard />
        ) : (
          <IspSupportConsole />
        )}
      </main>
    </div>
  );
}
