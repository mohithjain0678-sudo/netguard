export type NextTestType =
  | 'dns_check'
  | 'gateway_check'
  | 'bufferbloat_check'
  | 'general_check';

export function selectNextTest(evidence: string[]): NextTestType {
  const text = evidence.join(' ').toLowerCase();

  if (text.includes('dns')) {
    return 'dns_check';
  }

  if (text.includes('rssi') || text.includes('signal')) {
    return 'gateway_check';
  }

  if (text.includes('latency')) {
    return 'bufferbloat_check';
  }

  return 'general_check';
}
