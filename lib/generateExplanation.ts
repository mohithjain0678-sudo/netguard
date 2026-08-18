export interface IncidentCapsule {
  probableCause?: string;
  probable_cause?: string;
  confidence?: number;
  faultDomain?: string;
  fault_domain?: string;
  supportingEvidence?: string[];
  supporting_evidence?: string[];
  contradictingEvidence?: string[];
  contradicting_evidence?: string[];
  flight_recorder?: unknown[];
  [key: string]: unknown;
}

export async function generateExplanation(
  capsule: IncidentCapsule
): Promise<string> {
  const probableCause =
    capsule.probableCause ?? capsule.probable_cause ?? 'Unknown issue';
  const confidence = capsule.confidence ?? 0;
  const faultDomain =
    capsule.faultDomain ?? capsule.fault_domain ?? 'Unknown';
  const supportingEvidence =
    capsule.supportingEvidence ?? capsule.supporting_evidence ?? [];
  const contradictingEvidence =
    capsule.contradictingEvidence ?? capsule.contradicting_evidence ?? [];
  const flightRecorder = capsule.flight_recorder ?? [];
  const diagnostics = capsule.diagnostics ?? null;

  const fallback = `The detected issue is ${probableCause} with ${confidence}% confidence. The affected fault domain is ${faultDomain}. This assessment is based on the available telemetry and diagnostic evidence.`;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('Gemini call failed, using rule-based fallback');
    return fallback;
  }

  const prompt = `You are a network diagnostics assistant for NetGuard. Explain the following incident concisely based strictly on the provided evidence.

Incident Capsule Evidence:
- Probable Cause: ${probableCause}
- Confidence: ${confidence}%
- Fault Domain: ${faultDomain}
- Supporting Evidence: ${supportingEvidence.length > 0 ? supportingEvidence.join('; ') : 'None'}
- Contradicting Evidence: ${contradictingEvidence.length > 0 ? contradictingEvidence.join('; ') : 'None'}
- Diagnostic Test Results: ${diagnostics ? JSON.stringify(diagnostics) : 'None'}
- Flight Recorder Telemetry: ${JSON.stringify(flightRecorder)}

Instructions:
1. Explain the probable cause in plain English.
2. Interpret the evidence.
3. Explain the confidence level.
4. Stay under 4 sentences.
5. Never invent measurements, numbers, causes, or evidence that are not present in the capsule.`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      console.warn('Gemini call failed, using rule-based fallback');
      return fallback;
    }

    const data = await response.json();
    const explanationText =
      data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!explanationText || typeof explanationText !== 'string' || !explanationText.trim()) {
      console.warn('Gemini call failed, using rule-based fallback');
      return fallback;
    }

    return explanationText.trim();
  } catch {
    console.warn('Gemini call failed, using rule-based fallback');
    return fallback;
  }
}
