import { RecordedSession, TelemetryReading } from '../types';

export function convertReadingsToCSV(samples: TelemetryReading[], sessionName?: string): string {
  const headers = [
    'Index',
    'Timestamp_Unix_MS',
    'ISO_DateTime',
    'Elapsed_Seconds',
    'Heart_Rate_BPM',
    'SpO2_Percent',
    'PPG_Wave_FILT',
    'Finger_Detected',
    'Status',
  ];

  if (samples.length === 0) {
    return headers.join(',') + '\n';
  }

  const startTime = samples[0].timestamp;

  const rows = samples.map((sample, idx) => {
    const elapsedSec = ((sample.timestamp - startTime) / 1000).toFixed(3);
    const isoDate = new Date(sample.timestamp).toISOString();
    const spo2Str = sample.spo2 !== null && sample.spo2 !== undefined ? sample.spo2.toString() : 'None';
    const status = !sample.fingerDetected
      ? 'NO_FINGER'
      : sample.spo2 !== null && sample.spo2 < 90
      ? 'LOW_SPO2'
      : sample.bpm > 100
      ? 'TACHYCARDIA'
      : sample.bpm < 60 && sample.bpm > 0
      ? 'BRADYCARDIA'
      : 'NORMAL';

    return [
      idx + 1,
      sample.timestamp,
      `"${isoDate}"`,
      elapsedSec,
      sample.bpm,
      spo2Str,
      sample.wave.toFixed(2),
      sample.fingerDetected ? 'TRUE' : 'FALSE',
      `"${status}"`,
    ].join(',');
  });

  const metadataHeader = [
    `# ESP32 MAX30102 Vital Signs Recording`,
    `# Session: ${sessionName || 'Telemetry Export'}`,
    `# Export Date: ${new Date().toISOString()}`,
    `# Total Samples: ${samples.length}`,
    `# Sample Rate Avg: ${(samples.length / Math.max(1, (samples[samples.length - 1].timestamp - startTime) / 1000)).toFixed(1)} Hz`,
    '',
  ].join('\n');

  return metadataHeader + headers.join(',') + '\n' + rows.join('\n');
}

export function downloadCSV(csvContent: string, filename: string) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportSessionToCSV(session: RecordedSession) {
  const dateStr = new Date(session.startTime).toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `esp32_vitals_${dateStr}_${session.durationSeconds}s.csv`;
  const csv = convertReadingsToCSV(session.samples, session.name);
  downloadCSV(csv, filename);
}
