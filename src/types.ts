export interface TelemetryReading {
  timestamp: number;
  bpm: number;
  spo2: number | null;
  wave: number;
  fingerDetected: boolean;
  raw?: string;
  source?: string;
}

export interface RecordedSession {
  id: string;
  name: string;
  startTime: number;
  endTime: number;
  durationSeconds: number;
  samples: TelemetryReading[];
  avgBpm: number;
  avgSpo2: number | null;
  minBpm: number;
  maxBpm: number;
  minSpo2: number | null;
  maxSpo2: number | null;
}

export type RecordingDurationPreset = 10 | 30 | 60 | 120 | 300 | 600 | 0; // 0 = manual/unlimited

export interface RecordingConfig {
  mode: 'preset' | 'custom' | 'manual';
  durationSeconds: number; // in seconds, 0 = unlimited
  autoExportOnFinish: boolean;
}

export type ConnectionSource = 'bridge_sse' | 'mqtt' | 'simulator';

export interface MqttConfig {
  brokerUrl: string;
  topic: string;
  clientId: string;
  username?: string;
  password?: string;
}
