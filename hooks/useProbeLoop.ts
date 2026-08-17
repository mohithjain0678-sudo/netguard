'use client';

import { useState, useEffect, useRef } from 'react';
import { detectAnomaly, ProbeReading } from '@/lib/anomalyDetector';

export function useProbeLoop() {
  const [latestReading, setLatestReading] = useState<ProbeReading | null>(null);
  const [history, setHistory] = useState<ProbeReading[]>([]);
  const historyRef = useRef<ProbeReading[]>([]);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    let isMounted = true;

    const fetchProbe = async () => {
      try {
        const response = await fetch('/api/probe');
        if (!response.ok) return;
        const result = await response.json();
        const reading: ProbeReading | null = Array.isArray(result.data)
          ? result.data[0]
          : result.data || result.reading || null;

        if (reading && isMounted) {
          const currentHistory = historyRef.current;
          const { isAnomaly, evidence } = detectAnomaly(reading, currentHistory);

          if (isAnomaly) {
            console.log('ANOMALY DETECTED:', evidence);
          }

          setLatestReading(reading);
          setHistory((prev) => [...prev.slice(-49), reading]);
        }
      } catch (error) {
        console.error('Failed to fetch probe:', error);
      }
    };

    fetchProbe();
    const intervalId = setInterval(fetchProbe, 20000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, []);

  return { latestReading, history };
}
