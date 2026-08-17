import { ProbeReading } from './anomalyDetector';

export interface ConfidenceScoreResult {
  probableCause: string;
  confidence: number;
  faultDomain: string;
  supportingEvidence: string[];
  contradictingEvidence: string[];
}

export function scoreConfidence(
  reading: ProbeReading,
  evidence: string[],
  testResult?: any
): ConfidenceScoreResult {
  const isRssiLow =
    reading.rssi < -75 || evidence.some((e) => /rssi|signal/i.test(e));
  const isPacketLossLow = (reading.packet_loss_pct ?? 0) < 5;
  const isPacketLossHigh = (reading.packet_loss_pct ?? 0) >= 5;
  const isLatencyHigh =
    (reading.latency_ms ?? 0) > 150 || evidence.some((e) => /latency/i.test(e));
  const isLatencyNormal = (reading.latency_ms ?? 0) <= 150;
  const isDnsFailed =
    reading.dns_ms === null || evidence.some((e) => /dns/i.test(e));

  if (isRssiLow && isPacketLossHigh) {
    return {
      probableCause: 'Wi-Fi signal loss / disconnection',
      faultDomain: 'Local Wi-Fi',
      confidence: 92,
      supportingEvidence: evidence.filter((e) =>
        /rssi|signal|packet loss/i.test(e)
      ),
      contradictingEvidence: [],
    };
  }

  if (isRssiLow && isPacketLossLow) {
    return {
      probableCause: 'Local Wi-Fi signal degradation',
      faultDomain: 'Local Wi-Fi',
      confidence: 85,
      supportingEvidence: evidence.filter((e) => /rssi|signal/i.test(e)),
      contradictingEvidence: [
        `Packet loss is low (${reading.packet_loss_pct ?? 0}%)`,
      ],
    };
  }

  if (isDnsFailed && isLatencyNormal && isPacketLossLow) {
    return {
      probableCause: 'DNS resolution issue',
      faultDomain: 'DNS',
      confidence: 90,
      supportingEvidence: evidence.filter((e) => /dns/i.test(e)),
      contradictingEvidence: [
        `Latency is normal (${reading.latency_ms ?? 'N/A'}ms)`,
        `Packet loss is normal (${reading.packet_loss_pct ?? 0}%)`,
      ],
    };
  }

  if (isPacketLossHigh && isLatencyHigh && !isRssiLow) {
    const isGateway =
      testResult?.target === 'gateway' || testResult?.isGatewayIssue;
    return {
      probableCause: 'Gateway/LAN or ISP upstream issue',
      faultDomain: isGateway ? 'Gateway/LAN' : 'ISP/Upstream',
      confidence: 80,
      supportingEvidence: evidence.filter((e) =>
        /latency|packet loss/i.test(e)
      ),
      contradictingEvidence: [
        `Signal strength is sufficient (${reading.rssi} dBm)`,
      ],
    };
  }

  if (isLatencyHigh && isPacketLossLow && !isRssiLow) {
    return {
      probableCause: 'Network congestion or upstream latency spike',
      faultDomain: 'Gateway/LAN',
      confidence: 65,
      supportingEvidence: evidence.filter((e) => /latency/i.test(e)),
      contradictingEvidence: [
        `Signal strength is sufficient (${reading.rssi} dBm)`,
        `Packet loss is low (${reading.packet_loss_pct ?? 0}%)`,
      ],
    };
  }

  return {
    probableCause: 'Unknown — insufficient evidence',
    faultDomain: 'Unknown',
    confidence: 35,
    supportingEvidence: [...evidence],
    contradictingEvidence: [],
  };
}
