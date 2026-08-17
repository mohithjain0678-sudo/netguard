import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { runProbe } from '@/lib/runProbe';

export async function GET() {
  try {
    const readingPayload = await runProbe();

    const { data, error } = await supabase
      .from('readings')
      .insert([
        {
          rssi: readingPayload.rssi,
          channel: readingPayload.channel,
          band: readingPayload.band,
          bssid: readingPayload.bssid,
          latency_ms: readingPayload.latency_ms,
          packet_loss_pct: readingPayload.packet_loss_pct,
          dns_ms: readingPayload.dns_ms,
          receive_rate_mbps: readingPayload.receiveRateMbps,
          transmit_rate_mbps: readingPayload.transmitRateMbps,
        },
      ])
      .select();

    if (error) {
      return NextResponse.json({ data: [readingPayload], error: error.message });
    }

    return NextResponse.json({
      data: data && data.length > 0 ? data : [readingPayload],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
