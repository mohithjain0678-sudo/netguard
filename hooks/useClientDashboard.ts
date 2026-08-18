'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { detectAnomaly, ProbeReading } from '@/lib/anomalyDetector';

export interface TicketRecord {
  id: number;
  incident_id?: number;
  status: string;
  recommended_action?: string;
  created_at?: string;
}

export interface DiagnosticData {
  testType?: string;
  result?: string;
  timestamp?: string;
  target?: string;
  isGatewayIssue?: boolean;
  status?: string;
  metrics?: {
    download_mbps?: number | null;
    upload_mbps?: number | null;
    latency_ms?: number | null;
    duration_ms?: number | null;
    destination?: string | null;
    total_hops?: number | null;
    hops?: Array<{
      hop: number;
      ip: string | null;
      rtt_ms: number | null;
      rtts_ms?: (number | null)[];
      timedOut: boolean;
      raw?: string;
    }>;
    baseline_latency_ms?: number | null;
    loaded_latency_ms?: number | null;
    bufferbloat_delta_ms?: number | null;
    gateway_ip?: string | null;
    gateway_latency_ms?: number | null;
    gateway_packet_loss_pct?: number | null;
    dns_ms?: number | null;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface IncidentRecord {
  id: number;
  created_at: string;
  start_time: string | null;
  end_time: string | null;
  probable_cause: string;
  confidence: number;
  fault_domain: string;
  supporting_evidence: string[] | null;
  contradicting_evidence: string[] | null;
  flight_recorder: ProbeReading[] | null;
  diagnostics: DiagnosticData | null;
  severity: string | null;
  explanation: string | null;
  status: string;
  is_demo?: boolean;
  ticket?: TicketRecord | null;
}

export type ConnectionStatusType = 'Healthy' | 'Degraded' | 'Anomaly';

export interface ClientDashboardData {
  latestReading: ProbeReading | null;
  history: ProbeReading[];
  connectionStatus: ConnectionStatusType;
  statusReason: string;
  incidents: IncidentRecord[];
  isLoading: boolean;
  isRefreshing: boolean;
  isSimulating: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refresh: () => Promise<void>;
  simulateIncident: () => Promise<boolean>;
}

function calculateConnectionStatus(
  latest: ProbeReading | null,
  history: ProbeReading[]
): { status: ConnectionStatusType; reason: string } {
  if (!latest) {
    return { status: 'Healthy', reason: 'Awaiting initial telemetry readings' };
  }

  // Check for severe anomaly based on real telemetry
  const { isAnomaly, evidence } = detectAnomaly(latest, history);
  if (isAnomaly) {
    const anomalyEvidence =
      evidence.length > 0
        ? evidence.join(' | ')
        : 'Telemetry anomaly detected';
    return {
      status: 'Anomaly',
      reason: anomalyEvidence,
    };
  }

  // Check for degraded performance thresholds
  const isRssiDegraded = latest.rssi < -75;
  const isLatencyDegraded =
    latest.latency_ms !== null && latest.latency_ms > 100;
  const isPacketLossDegraded =
    latest.packet_loss_pct !== null && latest.packet_loss_pct > 0;
  const isDnsDegraded = latest.dns_ms !== null && latest.dns_ms > 80;

  if (
    isRssiDegraded ||
    isLatencyDegraded ||
    isPacketLossDegraded ||
    isDnsDegraded
  ) {
    const reasons: string[] = [];
    if (isRssiDegraded) reasons.push(`Weak Wi-Fi signal (${latest.rssi} dBm)`);
    if (isLatencyDegraded)
      reasons.push(`Elevated latency (${latest.latency_ms} ms)`);
    if (isPacketLossDegraded)
      reasons.push(`Packet loss detected (${latest.packet_loss_pct}%)`);
    if (isDnsDegraded) reasons.push(`Slow DNS lookup (${latest.dns_ms} ms)`);
    return {
      status: 'Degraded',
      reason: reasons.join('; '),
    };
  }

  return {
    status: 'Healthy',
    reason: 'All connection metrics are within optimal thresholds',
  };
}

export function useClientDashboard(): ClientDashboardData {
  const [latestReading, setLatestReading] = useState<ProbeReading | null>(null);
  const [history, setHistory] = useState<ProbeReading[]>([]);
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatusType>('Healthy');
  const [statusReason, setStatusReason] = useState<string>(
    'Checking connection health...'
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async (isManual = false) => {
    if (isManual) {
      setIsRefreshing(true);
    }
    try {
      // 1. Query latest telemetry readings from Supabase
      const { data: readingsData, error: readingsError } = await supabase
        .from('readings')
        .select('*')
        .order('id', { ascending: false })
        .limit(30);

      if (readingsError) {
        throw new Error(`Failed to load readings: ${readingsError.message}`);
      }

      // 2. Query incidents from Supabase ordered by created_at descending (newest first)
      const { data: incidentsData, error: incidentsError } = await supabase
        .from('incidents')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (incidentsError) {
        throw new Error(`Failed to load incidents: ${incidentsError.message}`);
      }

      // 3. Query tickets from Supabase to associate with incidents
      const { data: ticketsData, error: ticketsError } = await supabase
        .from('tickets')
        .select('*')
        .order('id', { ascending: false })
        .limit(50);

      if (ticketsError) {
        console.warn('Tickets query warning:', ticketsError.message);
      }

      const ticketMap = new Map<number, TicketRecord>();
      if (ticketsData) {
        for (const t of ticketsData) {
          if (t.incident_id && !ticketMap.has(t.incident_id)) {
            ticketMap.set(t.incident_id, t);
          }
        }
      }

      const mappedIncidents: IncidentRecord[] = (incidentsData || [])
        .map((inc) => ({
          id: inc.id,
          created_at: inc.created_at,
          start_time: inc.start_time,
          end_time: inc.end_time,
          probable_cause: inc.probable_cause,
          confidence: inc.confidence,
          fault_domain: inc.fault_domain,
          supporting_evidence: inc.supporting_evidence,
          contradicting_evidence: inc.contradicting_evidence,
          flight_recorder: inc.flight_recorder,
          diagnostics: inc.diagnostics,
          severity: inc.severity,
          explanation: inc.explanation,
          status: inc.status,
          is_demo: Boolean(inc.is_demo),
          ticket: ticketMap.get(inc.id) || null,
        }))
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

      const mappedReadings: ProbeReading[] = (readingsData || []).map((r: any) => ({
        ...r,
        receiveRateMbps:
          r.receiveRateMbps ??
          (typeof r.receive_rate_mbps === 'number'
            ? r.receive_rate_mbps
            : r.receive_rate_mbps
              ? parseFloat(r.receive_rate_mbps)
              : undefined),
        transmitRateMbps:
          r.transmitRateMbps ??
          (typeof r.transmit_rate_mbps === 'number'
            ? r.transmit_rate_mbps
            : r.transmit_rate_mbps
              ? parseFloat(r.transmit_rate_mbps)
              : undefined),
      }));

      const sortedReadings = mappedReadings.slice().reverse();
      const latest = mappedReadings.length > 0 ? mappedReadings[0] : null;

      const { status, reason } = calculateConnectionStatus(
        latest,
        sortedReadings
      );

      setLatestReading(latest);
      setHistory(sortedReadings);
      setIncidents(mappedIncidents);
      setConnectionStatus(status);
      setStatusReason(reason);
      setError(null);
      setLastUpdated(new Date());
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Unable to retrieve telemetry data from Supabase';
      setError(message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData(false);
    const interval = setInterval(() => {
      fetchData(false);
    }, 15000);

    return () => clearInterval(interval);
  }, [fetchData]);

  const refresh = useCallback(async () => {
    await fetchData(true);
  }, [fetchData]);

  const simulateIncident = useCallback(async (): Promise<boolean> => {
    if (isSimulating) return false;
    setIsSimulating(true);
    try {
      const res = await fetch('/api/simulate-incident', {
        method: 'POST',
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Simulation trigger failed');
      }
      await fetchData(true);
      return true;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to simulate incident';
      console.error('Simulate incident error:', message);
      setError(message);
      return false;
    } finally {
      setIsSimulating(false);
    }
  }, [isSimulating, fetchData]);

  return {
    latestReading,
    history,
    connectionStatus,
    statusReason,
    incidents,
    isLoading,
    isRefreshing,
    isSimulating,
    error,
    lastUpdated,
    refresh,
    simulateIncident,
  };
}
