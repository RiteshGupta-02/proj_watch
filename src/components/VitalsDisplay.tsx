import React from 'react';
import { Heart, Activity, CheckCircle2, AlertTriangle, Fingerprint } from 'lucide-react';

interface VitalsDisplayProps {
  bpm: number;
  spo2: number | null;
  wave: number;
  fingerDetected: boolean;
  rawString?: string;
  lastPacketTime?: number;
}

export const VitalsDisplay: React.FC<VitalsDisplayProps> = ({
  bpm,
  spo2,
  wave,
  fingerDetected,
  rawString,
  lastPacketTime,
}) => {
  // Clinical status determinations
  const getBpmStatus = (val: number) => {
    if (!fingerDetected || val === 0) return { label: 'NO SIGNAL', color: 'text-slate-500', bg: 'bg-slate-100' };
    if (val < 50) return { label: 'BRADYCARDIA (LOW)', color: 'text-amber-800', bg: 'bg-amber-50' };
    if (val > 100) return { label: 'TACHYCARDIA (ELEVATED)', color: 'text-rose-800', bg: 'bg-rose-50' };
    return { label: 'NORMAL (60-100 BPM)', color: 'text-emerald-800', bg: 'bg-emerald-50' };
  };

  const getSpo2Status = (val: number | null) => {
    if (!fingerDetected || val === null || val === 0) {
      return { label: 'NO FINGER', color: 'text-slate-500', bg: 'bg-slate-100' };
    }
    if (val >= 95) return { label: 'OPTIMAL (≥95%)', color: 'text-emerald-800', bg: 'bg-emerald-50' };
    if (val >= 90) return { label: 'BORDERLINE (90-94%)', color: 'text-amber-800', bg: 'bg-amber-50' };
    return { label: 'HYPOXEMIA ALERT (<90%)', color: 'text-rose-800', bg: 'bg-rose-50' };
  };

  const bpmStatus = getBpmStatus(bpm);
  const spo2Status = getSpo2Status(spo2);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {/* 1. HEART RATE (BPM) - PROMINENT BOLD */}
      <div className="border border-slate-300 bg-white p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-3">
          <div className="flex items-center gap-2">
            <Heart className={`w-5 h-5 text-rose-600 ${fingerDetected && bpm > 0 ? 'animate-pulse' : ''}`} />
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-slate-700">
              Heart Rate // BPM
            </span>
          </div>
          <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 border border-slate-300 ${bpmStatus.bg} ${bpmStatus.color}`}>
            {bpmStatus.label}
          </span>
        </div>

        {/* Huge Prominent Bold Value */}
        <div className="flex items-baseline justify-between my-1">
          <div className="flex items-baseline gap-1">
            <span className="text-7xl font-mono font-black tracking-tight text-slate-900 leading-none">
              {fingerDetected && bpm > 0 ? bpm : '--'}
            </span>
            <span className="font-mono text-sm font-bold text-slate-500">BPM</span>
          </div>

          <div className="text-right font-mono text-[11px] text-slate-500">
            <div>RANGE: 60 - 100</div>
            <div className="text-rose-600 font-bold">COLOR: CRIMSON</div>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-2 mt-2 flex items-center justify-between text-xs font-mono text-slate-500">
          <span>TARGET: RESTING ADULT</span>
          <span>{fingerDetected && bpm > 0 ? 'PULSE DETECTED' : 'AWAITING PULSE'}</span>
        </div>
      </div>

      {/* 2. BLOOD OXYGEN (SpO2 %) - PROMINENT BOLD */}
      <div className="border border-slate-300 bg-white p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-sky-600" />
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-slate-700">
              Blood Oxygen // SpO2
            </span>
          </div>
          <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 border border-slate-300 ${spo2Status.bg} ${spo2Status.color}`}>
            {spo2Status.label}
          </span>
        </div>

        {/* Huge Prominent Bold Value */}
        <div className="flex items-baseline justify-between my-1">
          <div className="flex items-baseline gap-1">
            <span className="text-7xl font-mono font-black tracking-tight text-slate-900 leading-none">
              {fingerDetected && spo2 !== null && spo2 > 0 ? spo2 : '--'}
            </span>
            <span className="font-mono text-sm font-bold text-slate-500">%</span>
          </div>

          <div className="text-right font-mono text-[11px] text-slate-500">
            <div>TARGET: ≥ 95%</div>
            <div className="text-sky-600 font-bold">COLOR: AZURE</div>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-2 mt-2 flex items-center justify-between text-xs font-mono text-slate-500">
          <span>OXYGEN SATURATION</span>
          <span>MAX30102 RED/IR RATIO</span>
        </div>
      </div>

      {/* 3. SENSOR TELEMETRY & HARDWARE DIAGNOSTICS */}
      <div className="border border-slate-300 bg-white p-4 flex flex-col justify-between md:col-span-2 lg:col-span-1">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-2">
          <div className="flex items-center gap-2">
            <Fingerprint className="w-5 h-5 text-slate-700" />
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-slate-700">
              Sensor Contact & Stream
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {fingerDetected ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-800 bg-emerald-50 px-2 py-0.5 border border-emerald-300 font-semibold">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> CONTACT ACTIVE
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono text-amber-800 bg-amber-50 px-2 py-0.5 border border-amber-300 font-semibold">
                <AlertTriangle className="w-3 h-3 text-amber-600" /> PLACE FINGER
              </span>
            )}
          </div>
        </div>

        <div className="space-y-1.5 my-1 font-mono text-xs">
          <div className="flex items-center justify-between py-1 border-b border-slate-100">
            <span className="text-slate-500">PPG AC FILTERED (FILT):</span>
            <span className="font-bold text-emerald-700">{wave >= 0 ? `+${wave.toFixed(1)}` : wave.toFixed(1)}</span>
          </div>
          <div className="flex items-center justify-between py-1 border-b border-slate-100">
            <span className="text-slate-500">LAST PACKET LATENCY:</span>
            <span className="text-slate-800 font-semibold">
              {lastPacketTime ? `${Math.max(0, Date.now() - lastPacketTime)} ms` : '--'}
            </span>
          </div>
          <div className="py-1">
            <span className="text-slate-500 text-[10px] block mb-0.5">RAW ESP32 PACKET:</span>
            <code className="block bg-slate-50 border border-slate-200 px-2 py-1 text-[11px] text-slate-800 truncate">
              {rawString || 'Waiting for first UDP/MQTT packet...'}
            </code>
          </div>
        </div>
      </div>
    </div>
  );
};
