import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { getWifiTelemetry } from '@/lib/wifiTelemetry';

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

export async function GET() {
  try {
    const telemetry = await getWifiTelemetry();
    const latency_ms = await measureLatency();

    const { data, error } = await supabase
      .from('readings')
      .insert([
        {
          rssi: telemetry.rssi,
          channel: telemetry.channel,
          band: telemetry.band,
          latency_ms,
        },
      ])
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
