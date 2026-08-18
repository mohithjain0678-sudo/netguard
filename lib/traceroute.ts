import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface TracerouteHop {
  hop: number;
  ip: string | null;
  rtt_ms: number | null;
  rtts_ms: (number | null)[];
  timedOut: boolean;
  raw: string;
}

export interface TracerouteResult {
  target: string;
  hops: TracerouteHop[];
  completed: boolean;
  duration_ms: number;
  error?: string;
}

/**
 * Parses a single line from Windows tracert output.
 * Examples:
 *   "  1     5 ms     3 ms     5 ms  172.16.44.1"
 *   "  1    <1 ms    <1 ms    <1 ms  172.16.44.1"
 *   "  2     *        *        *     Request timed out."
 *   "  3    12 ms     *       14 ms  142.250.232.1"
 */
export function parseTracertLine(line: string): TracerouteHop | null {
  const trimmed = line.trim();
  const hopMatch = trimmed.match(/^(\d+)\s+(.+)$/);
  if (!hopMatch) return null;

  const hop = parseInt(hopMatch[1], 10);
  const rest = hopMatch[2];

  const isFullTimeout =
    /Request timed out/i.test(rest) ||
    /^(\*\s+)+\*(\s+Request timed out)?$/i.test(rest);

  const rttMatches = rest.match(/(<1\s*ms|\d+\s*ms|\*)/gi) || [];
  const rtts_ms: (number | null)[] = rttMatches.slice(0, 3).map((token) => {
    if (token === '*') return null;
    if (/<1/i.test(token)) return 1;
    const num = parseInt(token.replace(/ms/i, '').trim(), 10);
    return isNaN(num) ? null : num;
  });

  const validRtts = rtts_ms.filter((v): v is number => typeof v === 'number');
  const avgRtt =
    validRtts.length > 0
      ? Math.round(
          validRtts.reduce((a, b) => a + b, 0) / validRtts.length
        )
      : null;

  let ip: string | null = null;
  if (!isFullTimeout) {
    const ipMatch = rest.match(/([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)/);
    if (ipMatch) {
      ip = ipMatch[1];
    } else {
      const tokens = rest.trim().split(/\s+/);
      const lastToken = tokens[tokens.length - 1];
      if (lastToken && lastToken !== '*' && !/ms$/i.test(lastToken)) {
        ip = lastToken;
      }
    }
  }

  return {
    hop,
    ip,
    rtt_ms: avgRtt,
    rtts_ms,
    timedOut: isFullTimeout || validRtts.length === 0,
    raw: trimmed,
  };
}

/**
 * Runs Windows tracert with bounded hops and timeout.
 */
export async function runTraceroute(
  target = '8.8.8.8',
  maxHops = 6,
  timeoutPerProbeMs = 800
): Promise<TracerouteResult> {
  const startTime = performance.now();
  const hops: TracerouteHop[] = [];

  try {
    const cmd = `tracert -d -h ${maxHops} -w ${timeoutPerProbeMs} ${target}`;
    let stdout = '';

    try {
      const res = await execAsync(cmd, { timeout: 8000 });
      stdout = res.stdout;
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'stdout' in err) {
        stdout = String((err as { stdout?: string }).stdout || '');
      } else {
        throw err;
      }
    }

    const lines = stdout.split(/\r?\n/);
    for (const line of lines) {
      const parsedHop = parseTracertLine(line);
      if (parsedHop) {
        hops.push(parsedHop);
      }
    }

    const duration_ms = Math.round(performance.now() - startTime);
    return {
      target,
      hops,
      completed: true,
      duration_ms,
    };
  } catch (err: unknown) {
    const duration_ms = Math.round(performance.now() - startTime);
    const errorMsg =
      err instanceof Error ? err.message : 'Traceroute execution error';
    return {
      target,
      hops,
      completed: false,
      duration_ms,
      error: errorMsg,
    };
  }
}
