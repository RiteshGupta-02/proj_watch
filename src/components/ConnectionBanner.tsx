import React from 'react';
import { Wifi, WifiOff, Terminal, Cpu, Play, Pause, Radio } from 'lucide-react';
import { ConnectionSource } from '../types';

interface ConnectionBannerProps {
  isConnected: boolean;
  lastPacketTime: number;
  packetCount: number;
  packetRateHz: number;
  source: ConnectionSource;
  onSourceChange: (source: ConnectionSource) => void;
  onOpenGuide: () => void;
  isSimulatingFinger: boolean;
  onToggleSimFinger: () => void;
}

export const ConnectionBanner: React.FC<ConnectionBannerProps> = ({
  isConnected,
  lastPacketTime,
  packetCount,
  packetRateHz,
  source,
  onSourceChange,
  onOpenGuide,
  isSimulatingFinger,
  onToggleSimFinger,
}) => {
  return (
    <div className="border border-slate-300 bg-white p-3 flex flex-wrap items-center justify-between gap-3">
      {/* Left: Connection State Badge */}
      <div className="flex items-center gap-3">
        <div
          className={`flex items-center gap-2 px-3 py-1.5 border font-mono text-xs font-bold uppercase tracking-wider ${
            isConnected
              ? 'bg-emerald-50 text-emerald-800 border-emerald-400'
              : 'bg-rose-50 text-rose-800 border-rose-300'
          }`}
        >
          {isConnected ? (
            <>
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600"></span>
              </span>
              <Wifi className="w-3.5 h-3.5 text-emerald-700" />
              <span>ESP32 CONNECTED</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5 text-rose-600" />
              <span>ESP32 DISCONNECTED / AWAITING DATA</span>
            </>
          )}
        </div>

        {/* Live Diagnostics */}
        <div className="hidden sm:flex items-center gap-3 text-xs font-mono text-slate-600">
          <span>
            FREQ: <strong className="text-slate-800">{packetRateHz.toFixed(1)} Hz</strong>
          </span>
          <span>•</span>
          <span>
            PACKETS: <strong className="text-slate-800">{packetCount}</strong>
          </span>
          {lastPacketTime > 0 && (
            <>
              <span>•</span>
              <span className="text-slate-500">
                LAST: {Math.max(0, Math.round((Date.now() - lastPacketTime) / 1000))}s ago
              </span>
            </>
          )}
        </div>
      </div>

      {/* Right: Source Switcher & Setup Guide Trigger */}
      <div className="flex items-center gap-2">
        {/* Source Mode Selectors */}
        <div className="flex border border-slate-300 bg-white">
          <button
            onClick={() => onSourceChange('bridge_sse')}
            className={`px-2.5 py-1 text-xs font-mono uppercase font-semibold transition-colors flex items-center gap-1 ${
              source === 'bridge_sse'
                ? 'bg-slate-900 text-white'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Radio className="w-3 h-3" />
            <span>ESP32 / UDP BRIDGE</span>
          </button>

          <button
            onClick={() => onSourceChange('mqtt')}
            className={`px-2.5 py-1 text-xs font-mono uppercase font-semibold transition-colors flex items-center gap-1 ${
              source === 'mqtt'
                ? 'bg-slate-900 text-white'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <span>MQTT</span>
          </button>

          <button
            onClick={() => onSourceChange('simulator')}
            className={`px-2.5 py-1 text-xs font-mono uppercase font-semibold transition-colors flex items-center gap-1 ${
              source === 'simulator'
                ? 'bg-emerald-800 text-white'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Cpu className="w-3 h-3" />
            <span>SIMULATOR</span>
          </button>
        </div>

        {/* Simulator finger toggle when simulator is active */}
        {source === 'simulator' && (
          <button
            onClick={onToggleSimFinger}
            className={`px-2 py-1 text-xs font-mono uppercase border font-semibold transition-colors ${
              isSimulatingFinger
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
            }`}
          >
            {isSimulatingFinger ? 'SIM: FINGER ON' : 'SIM: FINGER LIFTED'}
          </button>
        )}

        {/* Guide button */}
        <button
          onClick={onOpenGuide}
          className="flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-slate-100 active:bg-slate-200 border border-slate-300 text-slate-800 font-mono text-xs uppercase font-bold tracking-wider transition-colors"
        >
          <Terminal className="w-3.5 h-3.5 text-slate-700" />
          <span>PYTHON SCRIPT & SETUP</span>
        </button>
      </div>
    </div>
  );
};
