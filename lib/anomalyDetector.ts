export interface ProbeReading {
  rssi: number;
  latency_ms: number | null;
  packet_loss_pct: number | null;
  dns_ms: number | null;
  channel?: number;
  band?: string;
  bssid?: string;
  signalPercent?: number;
  radioType?: string;
  receiveRateMbps?: number;
  transmitRateMbps?: number;
  timestamp?: string;
}

export interface AnomalyResult {
  isAnomaly: boolean;
  evidence: string[];
}

export function detectAnomaly(
  reading: ProbeReading,
  recentHistory: ProbeReading[]
): AnomalyResult {
  const evidence: string[] = [];

  if (reading.latency_ms !== null && reading.latency_ms > 250) {
    evidence.push(`Latency exceeds 250ms (measured: ${reading.latency_ms}ms)`);
  }

  const last5 = recentHistory.slice(-5);
  const validLatencies = last5
    .map((r) => r.latency_ms)
    .filter((v): v is number => typeof v === 'number' && !isNaN(v));

  if (reading.latency_ms !== null && validLatencies.length > 0) {
    const avgLatency =
      validLatencies.reduce((sum, val) => sum + val, 0) / validLatencies.length;
    if (reading.latency_ms > 2 * avgLatency) {
      evidence.push(
        `Latency (${reading.latency_ms}ms) is more than 2x the recent average (${avgLatency.toFixed(1)}ms)`
      );
    }
  }

  if (reading.packet_loss_pct !== null && reading.packet_loss_pct >= 5) {
    evidence.push(
      `Packet loss is ${reading.packet_loss_pct}% (threshold: >= 5%)`
    );
  }

  const validRssis = recentHistory
    .map((r) => r.rssi)
    .filter((v): v is number => typeof v === 'number' && !isNaN(v));

  if (validRssis.length > 0) {
    const avgRssi =
      validRssis.reduce((sum, val) => sum + val, 0) / validRssis.length;
    if (avgRssi - reading.rssi >= 10) {
      evidence.push(
        `RSSI dropped by ${(avgRssi - reading.rssi).toFixed(1)} dBm compared to recent average (${avgRssi.toFixed(1)} dBm)`
      );
    }
  }

  if (reading.dns_ms === null) {
    evidence.push('DNS resolution failed');
  }

  return {
    isAnomaly: evidence.length > 0,
    evidence,
  };
}
