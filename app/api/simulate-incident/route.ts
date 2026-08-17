import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { detectAnomaly, ProbeReading } from '@/lib/anomalyDetector';
import { selectNextTest } from '@/lib/selectNextTest';
import { scoreConfidence } from '@/lib/scoreConfidence';
import { generateExplanation } from '@/lib/generateExplanation';

function getRecommendedAction(faultDomain: string): string {
  switch (faultDomain) {
    case 'Local Wi-Fi':
      return 'Inspect AP signal levels, check for co-channel interference, or restart router';
    case 'DNS':
      return 'Verify local DNS server health or switch to fallback public DNS (1.1.1.1 / 8.8.8.8)';
    case 'Gateway/LAN':
      return 'Check gateway router load, local switch connectivity, and Ethernet cables';
    case 'ISP/Upstream':
      return 'Check ISP service status, modem uplink SNR, and upstream WAN circuit';
    default:
      return 'Investigate telemetry anomalies and monitor ongoing network metrics';
  }
}

export async function POST() {
  try {
    const now = new Date();

    // 1. Generate simulated baseline history (kept purely in-memory / flight recorder, NEVER touching real readings)
    const simulatedHistory: ProbeReading[] = [
      {
        rssi: -52,
        latency_ms: 22,
        packet_loss_pct: 0,
        dns_ms: 14,
        channel: 161,
        band: '5 GHz',
        bssid: 'f0:6f:ce:b0:d4:b6',
        signalPercent: 96,
        receiveRateMbps: 400,
        transmitRateMbps: 400,
        timestamp: new Date(now.getTime() - 80000).toISOString(),
      },
      {
        rssi: -54,
        latency_ms: 28,
        packet_loss_pct: 0,
        dns_ms: 18,
        channel: 161,
        band: '5 GHz',
        bssid: 'f0:6f:ce:b0:d4:b6',
        signalPercent: 92,
        receiveRateMbps: 400,
        transmitRateMbps: 400,
        timestamp: new Date(now.getTime() - 60000).toISOString(),
      },
      {
        rssi: -68,
        latency_ms: 145,
        packet_loss_pct: 4,
        dns_ms: 35,
        channel: 161,
        band: '5 GHz',
        bssid: 'f0:6f:ce:b0:d4:b6',
        signalPercent: 68,
        receiveRateMbps: 180,
        transmitRateMbps: 180,
        timestamp: new Date(now.getTime() - 40000).toISOString(),
      },
      {
        rssi: -78,
        latency_ms: 295,
        packet_loss_pct: 12,
        dns_ms: 85,
        channel: 161,
        band: '5 GHz',
        bssid: 'f0:6f:ce:b0:d4:b6',
        signalPercent: 44,
        receiveRateMbps: 86,
        transmitRateMbps: 86,
        timestamp: new Date(now.getTime() - 20000).toISOString(),
      },
    ];

    // 2. Simulated degraded telemetry reading
    const simulatedDegradedReading: ProbeReading = {
      rssi: -82,
      latency_ms: 385,
      packet_loss_pct: 18,
      dns_ms: 110,
      channel: 161,
      band: '5 GHz',
      bssid: 'f0:6f:ce:b0:d4:b6',
      signalPercent: 36,
      receiveRateMbps: 54,
      transmitRateMbps: 54,
      timestamp: now.toISOString(),
    };

    const simulatedFlightRecorder = [
      ...simulatedHistory,
      simulatedDegradedReading,
    ];

    // 3. Step: Anomaly Detection (using existing detector)
    const { isAnomaly, evidence } = detectAnomaly(
      simulatedDegradedReading,
      simulatedHistory
    );

    const effectiveEvidence =
      isAnomaly && evidence.length > 0
        ? evidence
        : [
            'Latency exceeds 250ms (measured: 385ms)',
            'Packet loss is 18% (threshold: >= 5%)',
            'RSSI dropped by 28.0 dBm compared to recent average (-54.0 dBm)',
          ];

    // 4. Step: Adaptive Diagnostic Selection (using existing selector)
    const selectedTest = selectNextTest(effectiveEvidence);
    const testResult = {
      testType: selectedTest,
      result: 'Simulated diagnostic identified severe queueing delay and RF path degradation',
      timestamp: now.toISOString(),
    };

    // 5. Step: Evidence Scoring & Confidence (using existing scorer)
    const scored = scoreConfidence(
      simulatedDegradedReading,
      effectiveEvidence,
      testResult
    );

    // 6. Step: Gemini AI Root Cause Explanation (using existing generator)
    const explanation = await generateExplanation({
      probableCause: scored.probableCause,
      confidence: scored.confidence,
      faultDomain: scored.faultDomain,
      supportingEvidence: scored.supportingEvidence,
      contradictingEvidence: scored.contradictingEvidence,
      flight_recorder: simulatedFlightRecorder,
    });

    const startTime = simulatedHistory[0].timestamp || now.toISOString();

    // 7. Step: Insert Incident Capsule with is_demo: true into Supabase
    const incidentCapsule = {
      start_time: startTime,
      end_time: now.toISOString(),
      probable_cause: scored.probableCause,
      confidence: scored.confidence,
      fault_domain: scored.faultDomain,
      supporting_evidence: scored.supportingEvidence,
      contradicting_evidence: scored.contradictingEvidence,
      flight_recorder: simulatedFlightRecorder,
      diagnostics: testResult,
      explanation,
      status: 'open',
      is_demo: true,
    };

    const { data: incidentData, error: incidentError } = await supabase
      .from('incidents')
      .insert([incidentCapsule])
      .select();

    if (incidentError || !incidentData || incidentData.length === 0) {
      return NextResponse.json(
        { error: incidentError?.message || 'Failed to save demo incident' },
        { status: 500 }
      );
    }

    const createdIncident = incidentData[0];
    const recommendedAction = getRecommendedAction(scored.faultDomain);

    // 8. Step: Insert linked Ticket into Supabase
    const ticketPayload = {
      incident_id: createdIncident.id,
      status: 'open',
      recommended_action: recommendedAction,
    };

    const { data: ticketData, error: ticketError } = await supabase
      .from('tickets')
      .insert([ticketPayload])
      .select();

    if (ticketError) {
      console.warn('Simulated ticket insert warning:', ticketError.message);
    }

    return NextResponse.json({
      success: true,
      incident: createdIncident,
      ticket: ticketData && ticketData.length > 0 ? ticketData[0] : null,
      message: 'Simulated incident successfully generated through existing diagnostic pipeline',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown simulation error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
