import mqtt, { MqttClient } from 'mqtt';
import { TelemetryReading } from '../types';

export class BrowserMqttManager {
  private client: MqttClient | null = null;
  private isConnecting = false;

  public connect(
    brokerUrl: string = 'wss://broker.hivemq.com:8884/mqtt',
    topic: string = 'esp32/vital-signs/data',
    onReading: (reading: TelemetryReading) => void,
    onStatusChange: (connected: boolean, error?: string) => void
  ) {
    this.disconnect();
    this.isConnecting = true;

    try {
      this.client = mqtt.connect(brokerUrl, {
        clientId: `vitals_web_${Math.random().toString(16).slice(2, 8)}`,
        reconnectPeriod: 5000,
        connectTimeout: 10000,
      });

      this.client.on('connect', () => {
        this.isConnecting = false;
        onStatusChange(true);
        this.client?.subscribe(topic, (err) => {
          if (err) {
            console.error('MQTT subscribe error:', err);
          }
        });
      });

      this.client.on('message', (_topic, message) => {
        try {
          const str = message.toString();
          // Can be JSON or raw string "BPM:72 SpO2:98 FILT:14.2"
          let bpm = 0;
          let spo2: number | null = null;
          let wave = 0.0;

          if (str.startsWith('{')) {
            const parsed = JSON.parse(str);
            bpm = Number(parsed.bpm) || 0;
            spo2 = parsed.spo2 !== undefined && parsed.spo2 !== null && parsed.spo2 !== 'None' ? Number(parsed.spo2) : null;
            wave = Number(parsed.wave ?? parsed.filt ?? parsed.ac_f) || 0.0;
          } else {
            const bpmMatch = str.match(/BPM[:\s=]+(\d+)/i);
            const spo2Match = str.match(/SpO2[:\s=]+(\d+|None|null)/i);
            const filtMatch = str.match(/(?:FILT|WAVE)[:\s=]+(-?[\d.]+)/i);

            if (bpmMatch) bpm = parseInt(bpmMatch[1], 10);
            if (spo2Match) {
              const val = spo2Match[1];
              spo2 = val === 'None' || val === 'null' ? null : parseInt(val, 10);
            }
            if (filtMatch) wave = parseFloat(filtMatch[1]);
          }

          const reading: TelemetryReading = {
            timestamp: Date.now(),
            bpm,
            spo2,
            wave,
            fingerDetected: (spo2 !== null && spo2 > 0) || bpm > 0 || Math.abs(wave) > 2,
            raw: str,
            source: 'MQTT',
          };
          onReading(reading);
        } catch (e) {
          console.error('Failed to parse MQTT message:', e);
        }
      });

      this.client.on('error', (err) => {
        console.error('MQTT error:', err);
        onStatusChange(false, err.message);
      });

      this.client.on('offline', () => {
        onStatusChange(false);
      });
    } catch (e: any) {
      this.isConnecting = false;
      onStatusChange(false, e?.message || 'Connection failed');
    }
  }

  public disconnect() {
    if (this.client) {
      try {
        this.client.end(true);
      } catch (e) {
        // ignore
      }
      this.client = null;
    }
    this.isConnecting = false;
  }
}
