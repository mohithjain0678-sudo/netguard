import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface WifiTelemetry {
  signalPercent: number;
  rssi: number;
  channel: number;
  band: string;
  radioType: string;
  receiveRateMbps: number;
  transmitRateMbps: number;
}

export async function getWifiTelemetry(): Promise<WifiTelemetry> {
  const { stdout } = await execAsync('netsh wlan show interfaces');

  const getMatch = (regex: RegExp): string => {
    const match = stdout.match(regex);
    return match ? match[1].trim() : '';
  };

  const signalStr = getMatch(/Signal\s*:\s*(\d+)%/i);
  const signalPercent = signalStr ? parseInt(signalStr, 10) : 0;
  const rssi = signalPercent / 2 - 100;
  const channel = parseInt(getMatch(/Channel\s*:\s*(\d+)/i) || '0', 10);
  const band = getMatch(/Band\s*:\s*(.+)/i);
  const radioType = getMatch(/Radio type\s*:\s*(.+)/i);
  const receiveRateMbps = parseFloat(getMatch(/Receive rate \(Mbps\)\s*:\s*([\d.]+)/i) || '0');
  const transmitRateMbps = parseFloat(getMatch(/Transmit rate \(Mbps\)\s*:\s*([\d.]+)/i) || '0');

  return {
    signalPercent,
    rssi,
    channel,
    band,
    radioType,
    receiveRateMbps,
    transmitRateMbps,
  };
}
