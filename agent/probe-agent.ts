import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

import { supabase } from '../lib/supabaseClient';
import { runProbe } from '../lib/runProbe';
import { detectAnomaly, ProbeReading } from '../lib/anomalyDetector';
import { flightRecorder } from '../lib/flightRecorder';
import { selectNextTest } from '../lib/selectNextTest';
import { scoreConfidence } from '../lib/scoreConfidence';
import { generateExplanation } from '../lib/generateExplanation';

const history: ProbeReading[] = [];
let incidentOpen = false;
let currentIncidentId: string | number | null = null;
const failedInserts: any[] = [];

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

async function insertWithRetry<T>(
  operationName: string,
  fn: () => Promise<{ data: T | null; error: any }>,
  maxAttempts = 3,
  delayMs = 3000
): Promise<T | null> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const { data, error } = await fn();
      if (!error && data) {
        return data;
      }
      if (error) {
        console.warn(
          `[${operationName}] Attempt ${attempt}/${maxAttempts} failed: ${error.message}`
        );
      }
    } catch (err: any) {
      console.warn(
        `[${operationName}] Attempt ${attempt}/${maxAttempts} threw error: ${err.message}`
      );
    }

    if (attempt < maxAttempts) {
      console.log(
        `Retrying ${operationName} (attempt ${attempt + 1}/${maxAttempts}) in ${delayMs / 1000}s...`
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return null;
}

async function tick() {
  try {
    const reading = await runProbe();
    console.log(
      `[${new Date().toLocaleTimeString()}] Probe: RSSI=${reading.rssi}dBm | Latency=${reading.latency_ms ?? 'N/A'}ms | Loss=${reading.packet_loss_pct ?? 'N/A'}% | DNS=${reading.dns_ms ?? 'N/A'}ms | Ch=${reading.channel}`
    );

    flightRecorder.record(reading);

    const { error: readingError } = await supabase
      .from('readings')
      .insert([
        {
          rssi: reading.rssi,
          channel: reading.channel,
          band: reading.band,
          bssid: reading.bssid,
          latency_ms: reading.latency_ms,
          packet_loss_pct: reading.packet_loss_pct,
          dns_ms: reading.dns_ms,
          receive_rate_mbps: reading.receiveRateMbps,
          transmit_rate_mbps: reading.transmitRateMbps,
        },
      ]);

    if (readingError) {
      console.warn('Supabase reading insert notice:', readingError.message);
    }

    const { isAnomaly, evidence } = detectAnomaly(reading, history);

    if (isAnomaly) {
      console.warn('⚠️  ANOMALY DETECTED:', evidence.join(' | '));

      if (!incidentOpen) {
        incidentOpen = true;

        const selectedTest = selectNextTest(evidence);
        console.log(
          `🔍 Adaptive Diagnostics: Selected next test -> [${selectedTest}]`
        );

        const testResult = {
          testType: selectedTest,
          result: 'placeholder',
          timestamp: new Date().toISOString(),
        };

        const scored = scoreConfidence(reading, evidence, testResult);
        const snapshot = flightRecorder.snapshot();
        const now = new Date().toISOString();
        const startTime =
          snapshot.length > 0 ? snapshot[0].timestamp || now : now;

        const explanation = await generateExplanation({
          probableCause: scored.probableCause,
          confidence: scored.confidence,
          faultDomain: scored.faultDomain,
          supportingEvidence: scored.supportingEvidence,
          contradictingEvidence: scored.contradictingEvidence,
          flight_recorder: snapshot,
        });

        const incidentCapsule = {
          start_time: startTime,
          end_time: now,
          probable_cause: scored.probableCause,
          confidence: scored.confidence,
          fault_domain: scored.faultDomain,
          supporting_evidence: scored.supportingEvidence,
          contradicting_evidence: scored.contradictingEvidence,
          flight_recorder: snapshot,
          diagnostics: testResult,
          explanation,
          status: 'open',
          is_demo: false,
        };

        console.log('📦 Incident Capsule Created:');
        console.log(`   - Probable Cause: ${scored.probableCause}`);
        console.log(`   - Confidence: ${scored.confidence}%`);
        console.log(`   - Fault Domain: ${scored.faultDomain}`);
        console.log(
          `   - Supporting Evidence: ${scored.supportingEvidence.join('; ')}`
        );
        console.log(`   - Explanation: ${explanation}`);
        console.log(`   - Flight Recorder Samples: ${snapshot.length}`);

        const incidentData = await insertWithRetry(
          'Incidents Table',
          async () =>
            await supabase
              .from('incidents')
              .insert([incidentCapsule])
              .select(),
          3,
          3000
        );

        if (!incidentData || incidentData.length === 0) {
          console.error(
            'Incident capsule failed to persist after 3 attempts'
          );
          failedInserts.push(incidentCapsule);
        }

        const incidentId =
          incidentData && incidentData.length > 0 ? incidentData[0].id : null;
        currentIncidentId = incidentId;
        const recommendedAction = getRecommendedAction(scored.faultDomain);

        const ticketPayload = incidentId
          ? {
              incident_id: incidentId,
              status: 'open',
              recommended_action: recommendedAction,
            }
          : {
              status: 'open',
              recommended_action: recommendedAction,
            };

        const ticketData = await insertWithRetry(
          'Tickets Table',
          async () =>
            await supabase.from('tickets').insert([ticketPayload]).select(),
          3,
          3000
        );

        if (!ticketData || ticketData.length === 0) {
          console.error('Ticket failed to persist after 3 attempts');
          failedInserts.push(ticketPayload);
        } else {
          console.log(
            `🎫 Linked Ticket Created for Incident [${incidentId ?? 'N/A'}] | Action: "${recommendedAction}"`
          );
        }
      } else {
        console.log(
          `ℹ️  Incident already open (ID: ${currentIncidentId ?? 'active'}) — debouncing duplicate creation.`
        );
      }
    } else {
      if (incidentOpen) {
        console.log(
          `✅ Incident resolved (ID: ${currentIncidentId ?? 'active'}). Setting incidentOpen = false.`
        );
        incidentOpen = false;

        const resolveTime = new Date().toISOString();

        if (currentIncidentId) {
          const { error: resolveError } = await supabase
            .from('incidents')
            .update({ end_time: resolveTime, status: 'resolved' })
            .eq('id', currentIncidentId);

          if (resolveError) {
            console.warn(
              'Supabase incident update notice:',
              resolveError.message
            );
          }

          const { error: ticketResolveError } = await supabase
            .from('tickets')
            .update({ status: 'resolved' })
            .eq('incident_id', currentIncidentId);

          if (ticketResolveError) {
            console.warn(
              'Supabase ticket update notice:',
              ticketResolveError.message
            );
          }

          currentIncidentId = null;
        } else {
          const lastFailedIndex = failedInserts
            .slice()
            .reverse()
            .findIndex(
              (item) =>
                item &&
                typeof item === 'object' &&
                'flight_recorder' in item
            );

          if (lastFailedIndex !== -1) {
            const actualIndex = failedInserts.length - 1 - lastFailedIndex;
            const failedCapsule = failedInserts[actualIndex];
            failedCapsule.end_time = resolveTime;
            failedCapsule.status = 'resolved';

            const { data: recData, error: recError } = await supabase
              .from('incidents')
              .insert([failedCapsule])
              .select();

            if (!recError && recData && recData.length > 0) {
              const recIncidentId = recData[0].id;
              console.log(
                `🎉 Reconciliation succeeded: Unpersisted incident capsule saved to Supabase with ID [${recIncidentId}]`
              );

              const recAction = getRecommendedAction(
                failedCapsule.fault_domain
              );
              await supabase.from('tickets').insert([
                {
                  incident_id: recIncidentId,
                  status: 'resolved',
                  recommended_action: recAction,
                },
              ]);

              failedInserts.splice(actualIndex, 1);
            } else {
              console.warn(
                `⚠️  Reconciliation failed: Capsule remains stored in in-memory failedInserts queue (${recError?.message || 'unknown error'})`
              );
            }
          }
        }
      }
    }

    history.push(reading);
    if (history.length > 10) {
      history.shift();
    }
  } catch (error) {
    console.error('Error during probe cycle:', error);
  }
}

async function initAgent() {
  try {
    const { data: openIncidents, error } = await supabase
      .from('incidents')
      .select('id, created_at, status, is_demo')
      .eq('status', 'open')
      .eq('is_demo', false)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.warn('Startup state recovery notice:', error.message);
    } else if (openIncidents && openIncidents.length > 0) {
      incidentOpen = true;
      currentIncidentId = openIncidents[0].id;
      console.log(
        `🔄 State recovered: Active real incident [${currentIncidentId}] restored from Supabase.`
      );
    } else {
      console.log('✨ Clean startup: No active open real incidents found.');
    }
  } catch (err: any) {
    console.warn('Startup state recovery error:', err?.message);
  }

  console.log('🚀 NetGuard Probe Agent started. Polling every 20 seconds...');
  await tick();
  setInterval(tick, 20000);
}

initAgent();
