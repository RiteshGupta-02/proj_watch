import { TelemetryReading } from '../types';

export class VitalSignsSimulator {
  private baseBpm = 74;
  private currentBpm = 74;
  private baseSpo2 = 98;
  private currentSpo2 = 98;
  private phase = 0;
  private fingerOn = true;
  private timer: any = null;
  private onDataCallback: ((data: TelemetryReading) => void) | null = null;

  constructor() {}

  public start(callback: (data: TelemetryReading) => void, frequencyHz: number = 20) {
    this.stop();
    this.onDataCallback = callback;
    const intervalMs = Math.round(1000 / frequencyHz);

    this.timer = setInterval(() => {
      this.tick(intervalMs / 1000);
    }, intervalMs);
  }

  public stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public toggleFinger(present?: boolean) {
    this.fingerOn = present !== undefined ? present : !this.fingerOn;
  }

  public isFingerPresent(): boolean {
    return this.fingerOn;
  }

  private tick(dt: number) {
    if (!this.onDataCallback) return;

    if (!this.fingerOn) {
      this.onDataCallback({
        timestamp: Date.now(),
        bpm: 0,
        spo2: null,
        wave: (Math.random() - 0.5) * 0.8,
        fingerDetected: false,
        raw: 'BPM:0 SpO2:None FILT:0.0',
        source: 'Simulator (No Finger)',
      });
      return;
    }

    // Gradual physiological drift
    this.currentBpm += (Math.random() - 0.5) * 0.4;
    this.currentBpm = Math.max(62, Math.min(88, this.currentBpm));

    if (Math.random() < 0.05) {
      this.currentSpo2 = Math.random() < 0.8 ? 98 : Math.random() < 0.5 ? 99 : 97;
    }

    // Waveform synthesis: standard PPG pulse waveform
    // Frequency corresponding to current BPM
    const pulseFreq = this.currentBpm / 60;
    this.phase += 2 * Math.PI * pulseFreq * dt;
    if (this.phase > 2 * Math.PI) {
      this.phase -= 2 * Math.PI;
    }

    const t = this.phase / (2 * Math.PI); // normalized 0 to 1
    let ppgWave = 0;

    // Physiological PPG model:
    // 1. Systolic peak around t = 0.15
    // 2. Dicrotic notch around t = 0.35
    // 3. Diastolic wave around t = 0.48
    if (t < 0.3) {
      ppgWave = Math.sin((t / 0.3) * Math.PI) * 45;
    } else if (t < 0.4) {
      // Dicrotic notch dip
      ppgWave = Math.sin(((t - 0.3) / 0.1) * Math.PI) * -8 + 12;
    } else if (t < 0.65) {
      // Secondary diastolic peak
      ppgWave = Math.sin(((t - 0.4) / 0.25) * Math.PI) * 16;
    } else {
      // Base relaxation
      ppgWave = Math.exp(-((t - 0.65) * 6)) * 4 - 3;
    }

    // Add slight sensor noise
    ppgWave += (Math.random() - 0.5) * 1.5;

    const reading: TelemetryReading = {
      timestamp: Date.now(),
      bpm: Math.round(this.currentBpm),
      spo2: this.currentSpo2,
      wave: Number(ppgWave.toFixed(2)),
      fingerDetected: true,
      raw: `BPM:${Math.round(this.currentBpm)} SpO2:${this.currentSpo2} FILT:${ppgWave.toFixed(1)}`,
      source: 'Simulator',
    };

    this.onDataCallback(reading);
  }
}
