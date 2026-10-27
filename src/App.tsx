import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Activity,
  Heart,
  Wifi,
  WifiOff,
  Radio,
  FileSpreadsheet,
  Terminal,
  RefreshCw,
  Send,
  HelpCircle,
  Clock,
  Layers,
} from 'lucide-react';
import { ConnectionSource, RecordedSession, TelemetryReading } from './types';
import { WaveformWindow } from './components/WaveformWindow';
import { MetricTrendWindow } from './components/MetricTrendWindow';
import { VitalsDisplay } from './components/VitalsDisplay';
import { RecordingPanel } from './components/RecordingPanel';
import { ConnectionBanner } from './components/ConnectionBanner';
import { SetupGuideModal } from './components/SetupGuideModal';
import { VitalSignsSimulator } from './utils/simulator';
import { BrowserMqttManager } from './utils/mqttClient';

const MAX_HISTORY = 1200; // Store up to ~4 minutes of history in memory

export default function App() {
  const [source, setSource] = useState<ConnectionSource>('bridge_sse');
  const [currentReading, setCurrentReading] = useState<TelemetryReading>({
    timestamp: Date.now(),
    bpm: 0,
    spo2: null,
    wave: 0.0,
    fingerDetected: false,
    raw: 'Ready. Awaiting ESP32 connection...',
  });

  const [readingsHistory, setReadingsHistory] = useState<TelemetryReading[]>([]);
  const [lastPacketTime, setLastPacketTime] = useState<number>(0);
  const [packetCount, setPacketCount] = useState<number>(0);
  const [packetRateHz, setPacketRateHz] = useState<number>(0);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [sessions, setSessions] = useState<RecordedSession[]>([]);
  const [isSimulatingFinger, setIsSimulatingFinger] = useState(true);

  // MQTT state
  const [mqttStatus, setMqttStatus] = useState<{ connected: boolean; error?: string }>({
    connected: false,
  });
  const mqttManagerRef = useRef<BrowserMqttManager | null>(null);

  // Simulator ref
  const simulatorRef = useRef<VitalSignsSimulator | null>(null);

  // Packet frequency calculation ref
  const recentTimestampsRef = useRef<number[]>([]);

  // Calculate if ESP32 is considered currently connected
  const isConnected = source === 'simulator'
    ? true
    : source === 'mqtt'
    ? mqttStatus.connected && (Date.now() - lastPacketTime < 4500)
    : Date.now() - lastPacketTime < 3800 && lastPacketTime > 0;

  // Load saved sessions from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('esp32_vitals_sessions');
      if (saved) {
        setSessions(JSON.parse(saved));
      }
    } catch (e) {
      // ignore
    }
  }, []);

  // Save sessions to localStorage
  const handleAddSession = (session: RecordedSession) => {
    setSessions((prev) => {
      const next = [session, ...prev];
      try {
        localStorage.setItem('esp32_vitals_sessions', JSON.stringify(next.slice(0, 20)));
      } catch (e) {}
      return next;
    });
  };

  const handleClearSessions = () => {
    setSessions([]);
    try {
      localStorage.removeItem('esp32_vitals_sessions');
    } catch (e) {}
  };

  // Telemetry handler
  const handleNewReading = useCallback((reading: TelemetryReading) => {
    const now = Date.now();
    setLastPacketTime(now);
    setPacketCount((c) => c + 1);
    setCurrentReading(reading);

    // Update history
    setReadingsHistory((prev) => {
      const next = [...prev, reading];
      if (next.length > MAX_HISTORY) {
        return next.slice(next.length - MAX_HISTORY);
      }
      return next;
    });

    // Update packet rate Hz
    recentTimestampsRef.current.push(now);
    const windowStart = now - 3000;
    recentTimestampsRef.current = recentTimestampsRef.current.filter((t) => t >= windowStart);
    if (recentTimestampsRef.current.length > 1) {
      const hz = recentTimestampsRef.current.length / 3;
      setPacketRateHz(hz);
    }
  }, []);

  // Periodic check to reset Hz if packets stop arriving
  useEffect(() => {
    const interval = setInterval(() => {
      if (Date.now() - lastPacketTime > 3500) {
        setPacketRateHz(0);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [lastPacketTime]);

  // Setup SSE connection when source is 'bridge_sse'
  useEffect(() => {
    if (source !== 'bridge_sse') return;

    let eventSource: EventSource | null = null;
    let retryTimeout: any = null;

    const connectSSE = () => {
      try {
        eventSource = new EventSource('/api/telemetry/stream');

        eventSource.addEventListener('init', (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data);
            if (data.latest && data.latest.timestamp > 0) {
              setCurrentReading(data.latest);
            }
            if (data.lastSeen > 0) {
              setLastPacketTime(data.lastSeen);
            }
            if (data.packetCount) {
              setPacketCount(data.packetCount);
            }
          } catch (err) {}
        });

        eventSource.addEventListener('telemetry', (e: MessageEvent) => {
          try {
            const data: TelemetryReading = JSON.parse(e.data);
            handleNewReading(data);
          } catch (err) {}
        });

        eventSource.onerror = () => {
          eventSource?.close();
          retryTimeout = setTimeout(connectSSE, 3000);
        };
      } catch (err) {
        retryTimeout = setTimeout(connectSSE, 3000);
      }
    };

    connectSSE();

    return () => {
      if (eventSource) eventSource.close();
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [source, handleNewReading]);

  // Setup Simulator when source is 'simulator'
  useEffect(() => {
    if (source === 'simulator') {
      const sim = new VitalSignsSimulator();
      simulatorRef.current = sim;
      sim.start((reading) => {
        handleNewReading(reading);
      }, 15); // 15 Hz smooth stream
      return () => {
        sim.stop();
        simulatorRef.current = null;
      };
    }
  }, [source, handleNewReading]);

  // Setup MQTT when source is 'mqtt'
  useEffect(() => {
    if (source === 'mqtt') {
      const mqtt = new BrowserMqttManager();
      mqttManagerRef.current = mqtt;
      mqtt.connect(
        'wss://broker.hivemq.com:8884/mqtt',
        'esp32/vital-signs/data',
        (reading) => handleNewReading(reading),
        (connected, error) => setMqttStatus({ connected, error })
      );
      return () => {
        mqtt.disconnect();
        mqttManagerRef.current = null;
      };
    } else {
      if (mqttManagerRef.current) {
        mqttManagerRef.current.disconnect();
        mqttManagerRef.current = null;
      }
    }
  }, [source, handleNewReading]);

  // Toggle simulated finger
  const handleToggleSimFinger = () => {
    if (simulatorRef.current) {
      simulatorRef.current.toggleFinger();
      setIsSimulatingFinger(simulatorRef.current.isFingerPresent());
    }
  };

  // Manual test trigger to send a packet
  const sendTestPacket = async () => {
    try {
      const mockBpm = Math.floor(68 + Math.random() * 15);
      const mockSpo2 = Math.floor(96 + Math.random() * 4);
      const mockFilt = Number(((Math.random() - 0.5) * 40).toFixed(1));
      const line = `BPM:${mockBpm} SpO2:${mockSpo2} FILT:${mockFilt}`;

      await fetch('/api/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: line,
      });
    } catch (e) {
      console.error('Failed to send test packet:', e);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-slate-800 selection:text-white">
      {/* 1. TOP CLINICAL APPLICATION HEADER */}
      <header className="border-b border-slate-300 bg-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-slate-900 text-white p-1.5 flex items-center justify-center">
              <Activity className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-mono text-sm font-black uppercase tracking-wider text-slate-900">
                  ESP32 Vital Signs Telemetry
                </h1>
                <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-700 px-1.5 py-0.2 border border-slate-300">
                  MAX30102 BIO-MONITOR
                </span>
              </div>
              <p className="text-[11px] font-mono text-slate-500">
                Continuous PPG Waveform, Heart Rate (BPM), and SpO2 Pulse Oximetry
              </p>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={sendTestPacket}
              title="Post a test reading to /api/telemetry to test ingest"
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono uppercase font-semibold border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 transition-colors"
            >
              <Send className="w-3 h-3 text-slate-500" />
              <span>TEST INGEST PACKET</span>
            </button>

            <button
              onClick={() => setIsGuideOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-mono uppercase font-bold border border-slate-900 bg-slate-900 hover:bg-slate-800 text-white transition-colors"
            >
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
              <span>SETUP GUIDE & PY SCRIPT</span>
            </button>
          </div>
        </div>
      </header>

      {/* MAIN DASHBOARD CONTENT */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-4 space-y-4">
        {/* 2. ESP32 CONNECTION STATUS BANNER */}
        <ConnectionBanner
          isConnected={isConnected}
          lastPacketTime={lastPacketTime}
          packetCount={packetCount}
          packetRateHz={packetRateHz}
          source={source}
          onSourceChange={setSource}
          onOpenGuide={() => setIsGuideOpen(true)}
          isSimulatingFinger={isSimulatingFinger}
          onToggleSimFinger={handleToggleSimFinger}
        />

        {/* 3. PROMINENT BOLD VITALS READOUT (BPM + SpO2 + FILT) */}
        <VitalsDisplay
          bpm={currentReading.bpm}
          spo2={currentReading.spo2}
          wave={currentReading.wave}
          fingerDetected={currentReading.fingerDetected}
          rawString={currentReading.raw}
          lastPacketTime={lastPacketTime}
        />

        {/* 4. DATA RECORDING & DURATION CONFIGURATION WITH CSV EXPORT */}
        <RecordingPanel
          currentReading={currentReading}
          sessions={sessions}
          onAddSession={handleAddSession}
          onClearSessions={handleClearSessions}
        />

        {/* 5. SEPARATE WINDOWS FOR THE THREE VITAL SIGNS PLOTS WITH DIFFERENT COLORS */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-300 pb-1">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-slate-700" />
              <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-800">
                Real-Time Telemetry Windows // 3 Distinct Color Channels
              </h2>
            </div>
            <span className="font-mono text-[11px] text-slate-500">
              BUFFER CAPACITY: {readingsHistory.length} / {MAX_HISTORY} SAMPLES
            </span>
          </div>

          {/* WINDOW 1: PPG PULSE WAVEFORM (FILT) - COLOR: EMERALD */}
          <div className="w-full">
            <WaveformWindow
              currentWave={currentReading.wave}
              fingerDetected={currentReading.fingerDetected}
            />
          </div>

          {/* WINDOW 2 & 3: BPM TREND (CRIMSON) & SpO2 TREND (AZURE) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* WINDOW 2: HEART RATE TREND (CRIMSON) */}
            <MetricTrendWindow
              title="HEART RATE TREND (BPM)"
              windowNumber={2}
              metricKey="bpm"
              colorName="CRIMSON RED"
              primaryColor="#dc2626"
              areaColor="#ef4444"
              unit="BPM"
              readings={readingsHistory}
              currentValue={currentReading.bpm}
              referenceZones={{
                threshold: 100,
                thresholdLabel: 'TACHYCARDIA LIMIT',
              }}
              yDomain={[40, 140]}
            />

            {/* WINDOW 3: BLOOD OXYGEN TREND (AZURE) */}
            <MetricTrendWindow
              title="BLOOD OXYGEN SATURATION (SpO2 %)"
              windowNumber={3}
              metricKey="spo2"
              colorName="AZURE BLUE"
              primaryColor="#0284c7"
              areaColor="#38bdf8"
              unit="%"
              readings={readingsHistory}
              currentValue={currentReading.spo2}
              referenceZones={{
                threshold: 90,
                thresholdLabel: 'HYPOXIA ALERT',
              }}
              yDomain={[80, 100]}
            />
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-300 bg-white py-3 mt-6">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-between text-xs font-mono text-slate-500 gap-2">
          <div className="flex items-center gap-3">
            <span>ESP32 + MAX30102 TELEMETRY SUITE</span>
            <span>•</span>
            <span>UDP DEST PORT: 5005</span>
            <span>•</span>
            <span>CSV EXPORT FORMAT: RFC-4180 COMPLIANT</span>
          </div>

          <div className="flex items-center gap-2">
            <span>THEME: WHITE / DARK GREY</span>
            <span>•</span>
            <span>SHARP CORNER UI</span>
          </div>
        </div>
      </footer>

      {/* SETUP GUIDE MODAL */}
      <SetupGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        appUrl={typeof window !== 'undefined' ? window.location.origin : ''}
      />
    </div>
  );
}
