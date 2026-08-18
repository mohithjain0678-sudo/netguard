import { exec } from 'child_process';
import { promisify } from 'util';
import { lookup } from 'dns/promises';
import { NextTestType } from './selectNextTest';
import { runTraceroute, TracerouteHop } from './traceroute';
import { runSpeedTest } from './speedTest';

const execAsync = promisify(exec);

export interface DiagnosticMetrics {
  latency_ms?: number | null;
  packet_loss_pct?: number | null;
  dns_ms?: number | null;
  gateway_ip?: string | null;
  gateway_latency_ms?: number | null;
  gateway_packet_loss_pct?: number | null;
  wan_latency_ms?: number | null;
  baseline_latency_ms?: number | null;
  loaded_latency_ms?: number | null;
  bufferbloat_delta_ms?: number | null;
  download_mbps?: number | null;
  upload_mbps?: number | null;
  destination?: string | null;
  hops?: TracerouteHop[];
  total_hops?: number | null;
  duration_ms?: number | null;
  target?: string;
  [key: string]: unknown;
}

export interface DiagnosticResult {
  testType: NextTestType;
  result: string;
  timestamp: string;
  target?: string;
  isGatewayIssue?: boolean;
  metrics?: DiagnosticMetrics;
  status?: 'success' | 'warning' | 'failure' | 'not_available';
}

/**
 * Dynamically resolves the machine's active default IPv4 gateway.
 * Queries routing table first, then falls back to ipconfig parsing.
 */
async function getDefaultGateway(): Promise<string | null> {
  try {
    const { stdout } = await execAsync('route print 0.0.0.0');
    const match = stdout.match(
      /0\.0\.0\.0\s+0\.0\.0\.0\s+([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)/
    );
    if (match && match[1] && match[1] !== '0.0.0.0' && match[1] !== 'On-link') {
      return match[1].trim();
    }
  } catch {
    // Continue to fallback
  }

  try {
    const { stdout } = await execAsync('ipconfig');
    const match = stdout.match(
      /Default Gateway[ .:]+([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)/i
    );
    if (match && match[1]) {
      return match[1].trim();
    }
  } catch {
    // Fallback failed
  }

  return null;
}

/**
 * Parses standard Windows ping stdout for packet loss and average latency.
 */
function parsePingOutput(output: string): {
  packet_loss_pct: number | null;
  latency_ms: number | null;
} {
  let packet_loss_pct: number | null = null;
  const lossMatch =
    output.match(/Lost\s*=\s*\d+\s*\((\d+)%\s*loss\)/i) ||
    output.match(/\((\d+)%\s*loss\)/i);
  if (lossMatch) {
    packet_loss_pct = parseInt(lossMatch[1], 10);
  }

  let latency_ms: number | null = null;
  const avgMatch = output.match(/Average\s*=\s*(\d+)ms/i);
  if (avgMatch) {
    latency_ms = parseInt(avgMatch[1], 10);
  }

  return { packet_loss_pct, latency_ms };
}

/**
 * Executes a lightweight ICMP ping to a target host.
 */
async function execPing(
  host: string,
  count = 3
): Promise<{
  output: string;
  packet_loss_pct: number | null;
  latency_ms: number | null;
}> {
  let output = '';
  try {
    const { stdout } = await execAsync(`ping -n ${count} -w 1000 ${host}`);
    output = stdout;
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'stdout' in err) {
      output = String((err as { stdout?: string }).stdout || '');
    }
  }
  const parsed = parsePingOutput(output);
  return { output, ...parsed };
}

/**
 * Measures HTTP round-trip latency to a lightweight endpoint.
 */
async function measureHttpLatency(
  url = 'https://www.google.com/generate_204',
  timeoutMs = 2500
): Promise<number | null> {
  try {
    const start = performance.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok && res.status !== 204) return null;
    return Math.round(performance.now() - start);
  } catch {
    return null;
  }
}

/**
 * Diagnostic 1: gateway_check
 * Tests local LAN / default gateway reachability and latency.
 */
async function executeGatewayCheck(): Promise<DiagnosticResult> {
  const timestamp = new Date().toISOString();
  const gatewayIp = await getDefaultGateway();

  if (!gatewayIp) {
    return {
      testType: 'gateway_check',
      result:
        'Gateway check warning: Unable to dynamically determine default IPv4 gateway interface from routing table.',
      timestamp,
      target: 'gateway',
      isGatewayIssue: false,
      status: 'warning',
      metrics: { gateway_ip: null },
    };
  }

  const { packet_loss_pct, latency_ms } = await execPing(gatewayIp, 3);
  const isLossHigh = packet_loss_pct !== null && packet_loss_pct > 10;
  const isLatencyHigh = latency_ms !== null && latency_ms > 50;
  const isGatewayIssue = isLossHigh || isLatencyHigh;

  const resultMsg = isGatewayIssue
    ? `Gateway reachability degraded (${gatewayIp}): ${packet_loss_pct ?? 0}% packet loss, ${latency_ms ?? 'N/A'}ms latency. Local LAN/AP hop path shows distress.`
    : `Gateway reachability optimal (${gatewayIp}): ${packet_loss_pct ?? 0}% packet loss, ${latency_ms ?? 'N/A'}ms latency. Local LAN path is healthy.`;

  return {
    testType: 'gateway_check',
    result: resultMsg,
    timestamp,
    target: 'gateway',
    isGatewayIssue,
    status: isGatewayIssue ? 'failure' : 'success',
    metrics: {
      gateway_ip: gatewayIp,
      gateway_latency_ms: latency_ms,
      gateway_packet_loss_pct: packet_loss_pct,
      target: 'gateway',
    },
  };
}

/**
 * Diagnostic 2: dns_check
 * Tests hostname resolution time and reliability using OS DNS resolver.
 */
async function executeDnsCheck(): Promise<DiagnosticResult> {
  const timestamp = new Date().toISOString();
  const testHost = 'google.com';

  try {
    const start = performance.now();
    const record = await lookup(testHost);
    const dns_ms = Math.round(performance.now() - start);

    const isSlow = dns_ms > 120;
    const resultMsg = isSlow
      ? `DNS check warning: Resolved ${testHost} to ${record.address} in ${dns_ms}ms (elevated resolution latency).`
      : `DNS check optimal: Resolved ${testHost} to ${record.address} in ${dns_ms}ms. DNS resolver operational.`;

    return {
      testType: 'dns_check',
      result: resultMsg,
      timestamp,
      target: 'dns',
      isGatewayIssue: false,
      status: isSlow ? 'warning' : 'success',
      metrics: {
        dns_ms,
        target: 'dns',
      },
    };
  } catch (err: unknown) {
    const errMessage = err instanceof Error ? err.message : 'Lookup failed';
    return {
      testType: 'dns_check',
      result: `DNS check failure: Resolution for ${testHost} failed (${errMessage}). Local resolver returned SERVFAIL or timed out.`,
      timestamp,
      target: 'dns',
      isGatewayIssue: false,
      status: 'failure',
      metrics: {
        dns_ms: null,
        target: 'dns',
      },
    };
  }
}

/**
 * Diagnostic 3: bufferbloat_check
 * Measures queueing delay by comparing unloaded baseline RTT with loaded RTT.
 */
async function executeBufferbloatCheck(): Promise<DiagnosticResult> {
  const timestamp = new Date().toISOString();

  const baseline = await measureHttpLatency();
  if (baseline === null) {
    return {
      testType: 'bufferbloat_check',
      result:
        'Bufferbloat check inconclusive: Baseline WAN HTTP latency measurement timed out.',
      timestamp,
      target: 'bufferbloat',
      isGatewayIssue: false,
      status: 'warning',
      metrics: { baseline_latency_ms: null },
    };
  }

  // Generate lightweight concurrent requests while probing loaded latency
  const [loadedResult] = await Promise.all([
    measureHttpLatency(),
    measureHttpLatency(),
    measureHttpLatency(),
  ]);

  const loaded = loadedResult ?? baseline;
  const delta_ms = Math.round(loaded - baseline);
  const isBloatSevere = delta_ms > 120;

  const resultMsg = isBloatSevere
    ? `Bufferbloat check detected queueing delay: Baseline ${baseline}ms -> Loaded ${loaded}ms (+${delta_ms}ms bufferbloat under burst).`
    : `Bufferbloat check optimal: Baseline ${baseline}ms -> Loaded ${loaded}ms (+${Math.max(0, delta_ms)}ms queueing delta).`;

  return {
    testType: 'bufferbloat_check',
    result: resultMsg,
    timestamp,
    target: 'bufferbloat',
    isGatewayIssue: false,
    status: isBloatSevere ? 'warning' : 'success',
    metrics: {
      baseline_latency_ms: baseline,
      loaded_latency_ms: loaded,
      bufferbloat_delta_ms: delta_ms,
      target: 'bufferbloat',
    },
  };
}

/**
 * Diagnostic 4: general_check
 * Aggregates local gateway, DNS, and WAN HTTP reachability.
 */
async function executeGeneralCheck(): Promise<DiagnosticResult> {
  const timestamp = new Date().toISOString();
  const gatewayIp = await getDefaultGateway();

  let gwLatency: number | null = null;
  let gwLoss: number | null = null;

  if (gatewayIp) {
    const gwPing = await execPing(gatewayIp, 2);
    gwLatency = gwPing.latency_ms;
    gwLoss = gwPing.packet_loss_pct;
  }

  let dnsLatency: number | null = null;
  try {
    const start = performance.now();
    await lookup('google.com');
    dnsLatency = Math.round(performance.now() - start);
  } catch {
    dnsLatency = null;
  }

  const wanLatency = await measureHttpLatency();

  const isGwDegraded =
    (gwLoss !== null && gwLoss > 0) ||
    (gwLatency !== null && gwLatency > 50);
  const isWanDegraded = wanLatency === null || wanLatency > 200;

  const resultMsg = `General diagnostic completed: Gateway (${gatewayIp || 'N/A'}) = ${gwLatency !== null ? `${gwLatency}ms` : 'N/A'} (${gwLoss ?? 0}% loss), DNS = ${dnsLatency !== null ? `${dnsLatency}ms` : 'Fail'}, WAN HTTP = ${wanLatency !== null ? `${wanLatency}ms` : 'Fail'}.`;

  return {
    testType: 'general_check',
    result: resultMsg,
    timestamp,
    target: isGwDegraded ? 'gateway' : 'general',
    isGatewayIssue: isGwDegraded && !isWanDegraded,
    status: isGwDegraded || isWanDegraded ? 'warning' : 'success',
    metrics: {
      gateway_ip: gatewayIp,
      gateway_latency_ms: gwLatency,
      gateway_packet_loss_pct: gwLoss,
      dns_ms: dnsLatency,
      wan_latency_ms: wanLatency,
      target: 'general',
    },
  };
}

/**
 * Diagnostic 5: traceroute
 * Executes real Windows tracert to map network path and isolate fault hop.
 */
async function executeTracerouteDiagnostic(
  target = '8.8.8.8'
): Promise<DiagnosticResult> {
  const timestamp = new Date().toISOString();

  try {
    const traceResult = await runTraceroute(target, 6, 800);

    if (traceResult.error || traceResult.hops.length === 0) {
      return {
        testType: 'traceroute',
        result: `Traceroute to ${target} failed or was blocked by firewall (${traceResult.error || 'No hop responses received'}).`,
        timestamp,
        target: 'wan_upstream',
        isGatewayIssue: false,
        status: 'warning',
        metrics: {
          destination: target,
          total_hops: 0,
          duration_ms: traceResult.duration_ms,
          hops: [],
          target: 'traceroute',
        },
      };
    }

    const hop1 = traceResult.hops[0];
    const isHop1Issue =
      hop1 &&
      (hop1.timedOut || (hop1.rtt_ms !== null && hop1.rtt_ms > 60));

    // Find the highest latency or failing hop
    const validHops = traceResult.hops.filter(
      (h) => !h.timedOut && h.rtt_ms !== null
    );
    const maxLatHop =
      validHops.length > 0
        ? validHops.reduce(
            (max, h) =>
              (h.rtt_ms ?? 0) > (max.rtt_ms ?? 0) ? h : max,
            validHops[0]
          )
        : null;

    let summaryText = '';
    if (isHop1Issue) {
      summaryText = `Degradation detected at Hop 1 (Local Gateway ${hop1.ip || 'LAN'}): ${hop1.rtt_ms !== null ? `${hop1.rtt_ms}ms` : 'Timeout'}. Local LAN path issue.`;
    } else if (maxLatHop && (maxLatHop.rtt_ms ?? 0) > 120) {
      summaryText = `Elevated latency isolated at Hop ${maxLatHop.hop} (${maxLatHop.ip || 'Transit'}): ${maxLatHop.rtt_ms}ms. Hop 1 (Gateway) is normal (${hop1?.rtt_ms ?? 0}ms). Upstream WAN/ISP routing distress.`;
    } else {
      summaryText = `Traceroute completed across ${traceResult.hops.length} hops in ${traceResult.duration_ms}ms. First hop (Gateway): ${hop1?.rtt_ms ?? 'N/A'}ms.`;
    }

    return {
      testType: 'traceroute',
      result: `Traceroute to ${target} (${traceResult.hops.length} hops): ${summaryText}`,
      timestamp,
      target: isHop1Issue ? 'gateway' : 'wan_upstream',
      isGatewayIssue: isHop1Issue,
      status: isHop1Issue || (maxLatHop && (maxLatHop.rtt_ms ?? 0) > 120) ? 'warning' : 'success',
      metrics: {
        destination: target,
        total_hops: traceResult.hops.length,
        duration_ms: traceResult.duration_ms,
        hops: traceResult.hops,
        target: 'traceroute',
      },
    };
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error ? err.message : 'Traceroute diagnostic error';
    return {
      testType: 'traceroute',
      result: `Traceroute diagnostic encountered an error: ${errorMsg}`,
      timestamp,
      target: 'wan_upstream',
      isGatewayIssue: false,
      status: 'failure',
      metrics: {
        destination: target,
        total_hops: 0,
        hops: [],
        target: 'traceroute',
      },
    };
  }
}

/**
 * Diagnostic 6: speed_test
 * Executes real network payload download/upload throughput measurement.
 */
async function executeSpeedTestDiagnostic(): Promise<DiagnosticResult> {
  const timestamp = new Date().toISOString();
  try {
    const speedResult = await runSpeedTest(2 * 1024 * 1024, 512 * 1024, 4000);

    if (!speedResult.completed) {
      return {
        testType: 'speed_test',
        result: `Speed test diagnostic failed (${speedResult.error || 'Connection timed out'}).`,
        timestamp,
        target: 'bandwidth',
        isGatewayIssue: false,
        status: 'warning',
        metrics: {
          download_mbps: null,
          upload_mbps: null,
          latency_ms: speedResult.latency_ms,
          duration_ms: speedResult.duration_ms,
          target: 'speed_test',
        },
      };
    }

    const isSlow =
      (speedResult.download_mbps !== null && speedResult.download_mbps < 15) ||
      (speedResult.upload_mbps !== null && speedResult.upload_mbps < 5);

    const resultMsg = `Real speed test completed in ${speedResult.duration_ms}ms: Download = ${speedResult.download_mbps !== null ? `${speedResult.download_mbps} Mbps` : 'N/A'}, Upload = ${speedResult.upload_mbps !== null ? `${speedResult.upload_mbps} Mbps` : 'N/A'}, Latency = ${speedResult.latency_ms !== null ? `${speedResult.latency_ms}ms` : 'N/A'}. ${isSlow ? 'Measured throughput shows substantial bandwidth degradation.' : 'Measured throughput indicates healthy link performance.'}`;

    return {
      testType: 'speed_test',
      result: resultMsg,
      timestamp,
      target: 'bandwidth',
      isGatewayIssue: false,
      status: isSlow ? 'warning' : 'success',
      metrics: {
        download_mbps: speedResult.download_mbps,
        upload_mbps: speedResult.upload_mbps,
        latency_ms: speedResult.latency_ms,
        duration_ms: speedResult.duration_ms,
        target: 'speed_test',
      },
    };
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error ? err.message : 'Speed test execution error';
    return {
      testType: 'speed_test',
      result: `Speed test diagnostic error: ${errorMsg}`,
      timestamp,
      target: 'bandwidth',
      isGatewayIssue: false,
      status: 'failure',
      metrics: {
        download_mbps: null,
        upload_mbps: null,
        target: 'speed_test',
      },
    };
  }
}

/**
 * Main adaptive diagnostic dispatcher.
 * Dispatches the selected diagnostic test safely without throwing.
 */
export async function executeDiagnostic(
  testType: NextTestType
): Promise<DiagnosticResult> {
  try {
    switch (testType) {
      case 'gateway_check':
        return await executeGatewayCheck();
      case 'dns_check':
        return await executeDnsCheck();
      case 'bufferbloat_check':
        return await executeBufferbloatCheck();
      case 'traceroute':
        return await executeTracerouteDiagnostic();
      case 'speed_test':
        return await executeSpeedTestDiagnostic();
      case 'general_check':
      default:
        return await executeGeneralCheck();
    }
  } catch (err: unknown) {
    const errMessage =
      err instanceof Error ? err.message : 'Unknown diagnostic error';
    return {
      testType,
      result: `Diagnostic execution encountered an error: ${errMessage}`,
      timestamp: new Date().toISOString(),
      status: 'failure',
      metrics: {},
    };
  }
}
