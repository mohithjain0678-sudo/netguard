import { ProbeReading } from './anomalyDetector';

export class FlightRecorder {
  private buffer: ProbeReading[] = [];
  private readonly maxSamples: number;

  constructor(maxSamples = 15) {
    this.maxSamples = maxSamples;
  }

  public record(reading: ProbeReading): void {
    this.buffer.push(reading);
    if (this.buffer.length > this.maxSamples) {
      this.buffer.shift();
    }
  }

  public snapshot(): ProbeReading[] {
    return [...this.buffer];
  }

  public clear(): void {
    this.buffer = [];
  }

  public get size(): number {
    return this.buffer.length;
  }
}

export const flightRecorder = new FlightRecorder(15);
