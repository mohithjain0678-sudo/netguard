import { exec } from 'child_process';
import { promisify } from 'util';
import { lookup } from 'dns/promises';
import { getWifiTelemetry, WifiTelemetry } from './wifiTelemetry';

const execAsync = promisify(exec);

export interface ProbeReadingPayload extends WifiTelemetry {
  latency_ms: number | null;
  packet_loss_pct: number | null;
  dns_ms: number | null;
  timestamp: string;
}

async function measureLatency(): Promise<number | null> {
  try {
    const start = performance.now();
    await fetch('https://www.google.com/generate_204', { cache: 'no-store' });
    const end = performance.now();
    return Math.round(end - start);
  } catch {
    return null;
  }
}

async function measurePacketLoss(): Promise<number | null> {
  try {
    let output = '';
    try {
      const { stdout } = await execAsync('ping -n 5 172.16.44.1');
      output = stdout;
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'stdout' in err) {
        output = String((err as { stdout?: string }).stdout || '');
      }
    }

    const percentMatch =
      output.match(/Lost\s*=\s*\d+\s*\((\d+)%\s*loss\)/i) ||
      output.match(/\((\d+)%\s*loss\)/i);
    if (percentMatch) {
      return parseInt(percentMatch[1], 10);
    }

    const sentMatch = output.match(/Sent\s*=\s*(\d+)/i);
    const lostMatch = output.match(/Lost\s*=\s*(\d+)/i);
    if (sentMatch && lostMatch) {
      const sent = parseInt(sentMatch[1], 10);
      const lost = parseInt(lostMatch[1], 10);
      if (sent > 0) {
        return Math.round((lost / sent) * 100);
      }
    }

    return null;
  } catch {
    return null;
  }
}

async function measureDnsTime(): Promise<number | null> {
  try {
    const start = performance.now();
    await lookup('google.com');
    const end = performance.now();
    return Math.round(end - start);
  } catch {
    return null;
  }
}

export async function runProbe(): Promise<ProbeReadingPayload> {
  const telemetry = await getWifiTelemetry();
  const latency_ms = await measureLatency();
  const packet_loss_pct = await measurePacketLoss();
  const dns_ms = await measureDnsTime();

  return {
    ...telemetry,
    latency_ms,
    packet_loss_pct,
    dns_ms,
    timestamp: new Date().toISOString(),
  };
}
