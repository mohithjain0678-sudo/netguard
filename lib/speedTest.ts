export interface SpeedTestResult {
  download_mbps: number | null;
  upload_mbps: number | null;
  latency_ms: number | null;
  duration_ms: number;
  completed: boolean;
  error?: string;
}

/**
 * Executes a lightweight, real-payload network speed test measuring:
 * - Latency (RTT)
 * - Actual download throughput (Mbps) from transferred byte payload
 * - Actual upload throughput (Mbps) from transmitted byte payload
 *
 * Designed to be bounded, lightweight (under 3MB total payload, ~1s duration),
 * and executed adaptively upon diagnostic dispatch without saturating user bandwidth.
 */
export async function runSpeedTest(
  downloadBytes = 2 * 1024 * 1024, // 2 MB
  uploadBytes = 512 * 1024, // 512 KB
  timeoutMs = 4000
): Promise<SpeedTestResult> {
  const startTotal = performance.now();
  let latency_ms: number | null = null;
  let download_mbps: number | null = null;
  let upload_mbps: number | null = null;
  let error: string | undefined;

  // 1. Latency Measurement (0-byte probe)
  try {
    const latStart = performance.now();
    const res = await fetch('https://speed.cloudflare.com/__down?bytes=0', {
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res.ok) {
      latency_ms = Math.round(performance.now() - latStart);
    }
  } catch {
    // Fallback latency check
    try {
      const latStart = performance.now();
      const res = await fetch('https://www.google.com/generate_204', {
        cache: 'no-store',
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok || res.status === 204) {
        latency_ms = Math.round(performance.now() - latStart);
      }
    } catch {
      // Latency remains null
    }
  }

  // 2. Download Throughput Measurement (actual byte payload timed)
  try {
    const downStart = performance.now();
    const res = await fetch(
      `https://speed.cloudflare.com/__down?bytes=${downloadBytes}`,
      {
        cache: 'no-store',
        signal: AbortSignal.timeout(timeoutMs),
      }
    );
    if (res.ok) {
      const buffer = await res.arrayBuffer();
      const durationSec = (performance.now() - downStart) / 1000;
      if (durationSec > 0 && buffer.byteLength > 0) {
        download_mbps = parseFloat(
          ((buffer.byteLength * 8) / (durationSec * 1000000)).toFixed(2)
        );
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Download timed out';
    error = `Download measurement failed: ${msg}`;
  }

  // 3. Upload Throughput Measurement (actual transmitted byte payload timed)
  try {
    const payload = new Uint8Array(uploadBytes);
    const upStart = performance.now();
    const res = await fetch('https://speed.cloudflare.com/__up', {
      method: 'POST',
      body: payload,
      headers: { 'Content-Type': 'application/octet-stream' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res.ok) {
      const durationSec = (performance.now() - upStart) / 1000;
      if (durationSec > 0) {
        upload_mbps = parseFloat(
          ((uploadBytes * 8) / (durationSec * 1000000)).toFixed(2)
        );
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Upload timed out';
    error = error
      ? `${error}; Upload measurement failed: ${msg}`
      : `Upload measurement failed: ${msg}`;
  }

  const duration_ms = Math.round(performance.now() - startTotal);
  const completed = download_mbps !== null || upload_mbps !== null;

  return {
    download_mbps,
    upload_mbps,
    latency_ms,
    duration_ms,
    completed,
    error,
  };
}
