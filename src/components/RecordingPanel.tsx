import React, { useEffect, useState } from 'react';
import { Circle, Download, Square, Clock, ListFilter, Trash2, CheckCircle2 } from 'lucide-react';
import { RecordedSession, RecordingConfig, TelemetryReading } from '../types';
import { exportSessionToCSV } from '../utils/csvExporter';

interface RecordingPanelProps {
  currentReading: TelemetryReading;
  sessions: RecordedSession[];
  onAddSession: (session: RecordedSession) => void;
  onClearSessions: () => void;
}

export const RecordingPanel: React.FC<RecordingPanelProps> = ({
  currentReading,
  sessions,
  onAddSession,
  onClearSessions,
}) => {
  const [config, setConfig] = useState<RecordingConfig>({
    mode: 'preset',
    durationSeconds: 30, // Default 30s preset
    autoExportOnFinish: true,
  });

  const [customInputSeconds, setCustomInputSeconds] = useState<string>('45');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null);
  const [recordedSamples, setRecordedSamples] = useState<TelemetryReading[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showHistory, setShowHistory] = useState(false);

  // Active recording clock & sample capture
  useEffect(() => {
    let interval: any;
    if (isRecording && recordingStartTime) {
      interval = setInterval(() => {
        const sec = Math.floor((Date.now() - recordingStartTime) / 1000);
        setElapsedSeconds(sec);

        // Check if duration limit reached
        if (config.durationSeconds > 0 && sec >= config.durationSeconds) {
          stopRecording();
        }
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isRecording, recordingStartTime, config.durationSeconds]);

  // Capture telemetry points while recording
  useEffect(() => {
    if (isRecording) {
      setRecordedSamples((prev) => [...prev, currentReading]);
    }
  }, [currentReading, isRecording]);

  const startRecording = () => {
    setRecordedSamples([currentReading]);
    setRecordingStartTime(Date.now());
    setElapsedSeconds(0);
    setIsRecording(true);
  };

  const stopRecording = () => {
    if (!isRecording || !recordingStartTime) return;
    setIsRecording(false);

    const endTime = Date.now();
    const duration = Math.max(1, Math.round((endTime - recordingStartTime) / 1000));
    const samples = [...recordedSamples];

    if (samples.length === 0) return;

    // Calculate summary statistics
    const validBpms = samples.map((s) => s.bpm).filter((v) => v > 0);
    const validSpo2s = samples.map((s) => s.spo2).filter((v): v is number => v !== null && v > 0);

    const avgBpm = validBpms.length > 0 ? Math.round(validBpms.reduce((a, b) => a + b, 0) / validBpms.length) : 0;
    const minBpm = validBpms.length > 0 ? Math.min(...validBpms) : 0;
    const maxBpm = validBpms.length > 0 ? Math.max(...validBpms) : 0;

    const avgSpo2 = validSpo2s.length > 0 ? Math.round(validSpo2s.reduce((a, b) => a + b, 0) / validSpo2s.length) : null;
    const minSpo2 = validSpo2s.length > 0 ? Math.min(...validSpo2s) : null;
    const maxSpo2 = validSpo2s.length > 0 ? Math.max(...validSpo2s) : null;

    const session: RecordedSession = {
      id: `session_${Date.now()}`,
      name: `Vital Signs Test (${duration}s)`,
      startTime: recordingStartTime,
      endTime,
      durationSeconds: duration,
      samples,
      avgBpm,
      minBpm,
      maxBpm,
      avgSpo2,
      minSpo2,
      maxSpo2,
    };

    onAddSession(session);

    if (config.autoExportOnFinish) {
      exportSessionToCSV(session);
    }
  };

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="border border-slate-300 bg-white p-4">
      {/* Panel Header */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-200 pb-2 mb-3 gap-2">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-700" />
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-slate-800">
            Telemetry Recording & CSV Export Suite
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Auto Export Checkbox */}
          <label className="flex items-center gap-1.5 text-xs font-mono text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={config.autoExportOnFinish}
              onChange={(e) => setConfig({ ...config, autoExportOnFinish: e.target.checked })}
              className="accent-slate-800 rounded-none w-3.5 h-3.5"
            />
            <span>AUTO-EXPORT CSV ON FINISH</span>
          </label>

          {/* Past Sessions Toggle */}
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-1 px-2 py-1 text-xs font-mono uppercase border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors"
          >
            <ListFilter className="w-3 h-3" />
            <span>RECORDINGS ({sessions.length})</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
        {/* Duration Configuration */}
        <div className="lg:col-span-7 flex flex-col gap-2">
          <div className="text-[11px] font-mono text-slate-500 uppercase tracking-wider">
            Set Recording Duration:
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {/* Quick Presets */}
            {[
              { label: '10s', sec: 10 },
              { label: '30s', sec: 30 },
              { label: '1 min', sec: 60 },
              { label: '2 min', sec: 120 },
              { label: '5 min', sec: 300 },
              { label: 'Manual (Stop anytime)', sec: 0 },
            ].map((preset) => (
              <button
                key={preset.sec}
                disabled={isRecording}
                onClick={() => setConfig({ ...config, mode: preset.sec === 0 ? 'manual' : 'preset', durationSeconds: preset.sec })}
                className={`px-2.5 py-1.5 text-xs font-mono uppercase font-semibold border transition-colors ${
                  config.durationSeconds === preset.sec
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                } disabled:opacity-50`}
              >
                {preset.label}
              </button>
            ))}

            {/* Custom Seconds Input */}
            <div className="flex items-center border border-slate-300 bg-white">
              <span className="px-2 text-[11px] font-mono text-slate-500 uppercase">Custom:</span>
              <input
                type="number"
                min="1"
                max="7200"
                disabled={isRecording}
                value={customInputSeconds}
                onChange={(e) => {
                  setCustomInputSeconds(e.target.value);
                  const parsed = parseInt(e.target.value, 10);
                  if (!isNaN(parsed) && parsed > 0) {
                    setConfig({ ...config, mode: 'custom', durationSeconds: parsed });
                  }
                }}
                className="w-16 px-1.5 py-1 text-xs font-mono text-slate-900 text-center border-l border-r border-slate-300 focus:outline-none"
              />
              <span className="px-2 text-[11px] font-mono text-slate-500">sec</span>
            </div>
          </div>
        </div>

        {/* Live Recording Status & Primary Action Button */}
        <div className="lg:col-span-5 flex items-center justify-end gap-3 border-t lg:border-t-0 lg:border-l border-slate-200 pt-3 lg:pt-0 lg:pl-4">
          {/* Active Timer & Samples Indicator */}
          {isRecording ? (
            <div className="flex flex-col items-end font-mono">
              <div className="flex items-center gap-1.5 text-rose-600 font-bold text-sm">
                <Circle className="w-3 h-3 fill-rose-600 animate-ping" />
                <span>
                  REC [{formatTime(elapsedSeconds)} /{' '}
                  {config.durationSeconds > 0 ? formatTime(config.durationSeconds) : '∞'}]
                </span>
              </div>
              <div className="text-[11px] text-slate-500">
                {recordedSamples.length} samples collected
              </div>
            </div>
          ) : (
            <div className="text-right font-mono text-xs text-slate-500 hidden sm:block">
              <div>TARGET DURATION: {config.durationSeconds > 0 ? `${config.durationSeconds}s` : 'Continuous'}</div>
              <div>READY TO RECORD</div>
            </div>
          )}

          {/* Big Sharp Corner Button */}
          {isRecording ? (
            <button
              onClick={stopRecording}
              className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-mono text-xs uppercase font-bold tracking-wider transition-colors border border-rose-700"
            >
              <Square className="w-4 h-4 fill-white" />
              <span>STOP & SAVE CSV</span>
            </button>
          ) : (
            <button
              onClick={startRecording}
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white font-mono text-xs uppercase font-bold tracking-wider transition-colors border border-slate-900"
            >
              <Circle className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
              <span>START RECORDING</span>
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar when recording with duration */}
      {isRecording && config.durationSeconds > 0 && (
        <div className="mt-3 w-full bg-slate-100 border border-slate-300 h-2 overflow-hidden">
          <div
            className="bg-rose-600 h-full transition-all duration-200"
            style={{ width: `${Math.min(100, (elapsedSeconds / config.durationSeconds) * 100)}%` }}
          />
        </div>
      )}

      {/* History Drawer */}
      {showHistory && (
        <div className="mt-4 pt-3 border-t border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-xs font-bold uppercase text-slate-700">
              Recorded Sessions History ({sessions.length})
            </span>
            {sessions.length > 0 && (
              <button
                onClick={onClearSessions}
                className="text-[11px] font-mono text-slate-500 hover:text-rose-600 flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" /> Clear History
              </button>
            )}
          </div>

          {sessions.length === 0 ? (
            <div className="py-4 text-center font-mono text-xs text-slate-400 bg-slate-50 border border-slate-200">
              No recorded sessions yet. Click "Start Recording" above to capture telemetry data.
            </div>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between p-2 bg-slate-50 border border-slate-200 text-xs font-mono"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-slate-500">{new Date(s.startTime).toLocaleTimeString()}</span>
                    <span className="font-bold text-slate-800">{s.durationSeconds}s DURATION</span>
                    <span className="text-slate-600">{s.samples.length} SAMPLES</span>
                    <span className="text-rose-700 font-semibold">AVG BPM: {s.avgBpm || '--'}</span>
                    <span className="text-sky-700 font-semibold">AVG SpO2: {s.avgSpo2 ? `${s.avgSpo2}%` : '--'}</span>
                  </div>

                  <button
                    onClick={() => exportSessionToCSV(s)}
                    className="flex items-center gap-1 px-2 py-1 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 text-[11px] font-semibold transition-colors"
                  >
                    <Download className="w-3 h-3" />
                    <span>EXPORT CSV</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
