export type NextTestType =
  | 'dns_check'
  | 'gateway_check'
  | 'bufferbloat_check'
  | 'traceroute'
  | 'speed_test'
  | 'general_check';

export function selectNextTest(evidence: string[]): NextTestType {
  const text = evidence.join(' ').toLowerCase();

  if (text.includes('dns')) {
    return 'dns_check';
  }

  if (text.includes('rssi') || text.includes('signal')) {
    return 'gateway_check';
  }

  if (
    text.includes('throughput') ||
    text.includes('bandwidth') ||
    text.includes('speed')
  ) {
    return 'speed_test';
  }

  if (
    text.includes('2x') ||
    text.includes('recent average') ||
    text.includes('bufferbloat')
  ) {
    return 'bufferbloat_check';
  }

  if (text.includes('latency') || text.includes('packet loss')) {
    return 'traceroute';
  }

  return 'general_check';
}
