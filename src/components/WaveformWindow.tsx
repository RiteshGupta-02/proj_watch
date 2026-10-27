import React, { useEffect, useRef, useState } from 'react';
import { Activity, Pause, Play, Grid, Maximize2, Minimize2, RotateCcw } from 'lucide-react';

interface WaveformPoint {
  time: number;
  val: number;
}

interface WaveformWindowProps {
  currentWave: number;
  fingerDetected: boolean;
  isPaused?: boolean;
}

export const WaveformWindow: React.FC<WaveformWindowProps> = ({
  currentWave,
  fingerDetected,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const bufferRef = useRef<WaveformPoint[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [timeWindowSec, setTimeWindowSec] = useState<number>(5); // 2s, 5s, 10s
  const [showGrid, setShowGrid] = useState(true);
  const [isMaximized, setIsMaximized] = useState(false);
  const [yScale, setYScale] = useState<'auto' | '50' | '100'>('auto');

  // Push new data points into buffer
  useEffect(() => {
    if (isPaused) return;
    const now = performance.now();
    bufferRef.current.push({ time: now, val: currentWave });

    // Prune old points beyond 15 seconds
    const cutoff = now - 15000;
    while (bufferRef.current.length > 0 && bufferRef.current[0].time < cutoff) {
      bufferRef.current.shift();
    }
  }, [currentWave, isPaused]);

  // High-performance Canvas Render Loop
  useEffect(() => {
    let animId: number;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;

      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);

      // White background with faint medical grid
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);

      if (showGrid) {
        // Minor grid
        ctx.strokeStyle = '#f1f5f9';
        ctx.lineWidth = 1;
        const stepX = 20;
        const stepY = 20;

        ctx.beginPath();
        for (let x = 0; x <= w; x += stepX) {
          ctx.moveTo(x, 0);
          ctx.lineTo(x, h);
        }
        for (let y = 0; y <= h; y += stepY) {
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
        }
        ctx.stroke();

        // Major grid
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1.2;
        const majorStep = 100;
        ctx.beginPath();
        for (let x = 0; x <= w; x += majorStep) {
          ctx.moveTo(x, 0);
          ctx.lineTo(x, h);
        }
        for (let y = 0; y <= h; y += majorStep) {
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
        }
        ctx.stroke();
      }

      // Zero baseline
      const zeroY = h / 2;
      ctx.strokeStyle = '#cbd5e1';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, zeroY);
      ctx.lineTo(w, zeroY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Baseline label
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px monospace';
      ctx.fillText('0.0 FILT', 8, zeroY - 4);

      const buffer = bufferRef.current;
      if (buffer.length < 2) {
        // Awaiting data trace
        ctx.fillStyle = '#94a3b8';
        ctx.font = '12px monospace';
        ctx.fillText('Awaiting PPG wave stream from ESP32...', w / 2 - 120, h / 2);
        ctx.restore();
        animId = requestAnimationFrame(render);
        return;
      }

      // Determine time range and y-scale
      const now = performance.now();
      const windowMs = timeWindowSec * 1000;
      const startTime = now - windowMs;

      // Filter visible points
      const visible = buffer.filter((p) => p.time >= startTime);

      // Auto scale calculation
      let maxAbs = 25;
      if (yScale === 'auto') {
        for (const p of visible) {
          const abs = Math.abs(p.val);
          if (abs > maxAbs) maxAbs = abs;
        }
        maxAbs = Math.max(30, maxAbs * 1.25);
      } else {
        maxAbs = parseFloat(yScale);
      }

      // Draw Waveform line in Vivid Emerald Green (#059669 / #10b981)
      ctx.strokeStyle = '#059669';
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      let first = true;
      let lastX = 0;
      let lastY = zeroY;

      for (let i = 0; i < visible.length; i++) {
        const pt = visible[i];
        const x = ((pt.time - startTime) / windowMs) * w;
        // Y mapping: val = 0 is zeroY, positive goes UP (y decreases)
        const y = zeroY - (pt.val / maxAbs) * (h * 0.42);

        if (first) {
          ctx.moveTo(x, y);
          first = false;
        } else {
          ctx.lineTo(x, y);
        }
        lastX = x;
        lastY = y;
      }
      ctx.stroke();

      // Current pulse indicator point
      if (visible.length > 0 && lastX <= w) {
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#047857';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(lastX, lastY, 6, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Current scale range indicators
      ctx.fillStyle = '#64748b';
      ctx.font = '10px monospace';
      ctx.fillText(`+${maxAbs.toFixed(0)}`, w - 42, 16);
      ctx.fillText(`-${maxAbs.toFixed(0)}`, w - 42, h - 8);

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [timeWindowSec, showGrid, yScale, isPaused]);

  return (
    <div
      className={`border border-slate-300 bg-white flex flex-col ${
        isMaximized
          ? 'fixed inset-4 z-50 shadow-2xl'
          : 'h-full min-h-[320px]'
      }`}
    >
      {/* Sharp Window Title Bar */}
      <div className="bg-slate-100 border-b border-slate-300 px-3 py-2 flex items-center justify-between select-none">
        <div className="flex items-center gap-2">
          {/* Distinct Color Swatch */}
          <span className="w-3 h-3 bg-emerald-600 inline-block border border-emerald-800" />
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-slate-800">
            Window 1 // PPG Pulse Waveform (FILT)
          </span>
          <span className="text-[11px] font-mono px-1.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-300">
            COLOR: EMERALD
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Live FILT Readout */}
          <div className="font-mono text-xs font-bold text-slate-900 bg-white px-2 py-0.5 border border-slate-300 mr-2">
            FILT:{' '}
            <span className="text-emerald-700">
              {currentWave >= 0 ? `+${currentWave.toFixed(1)}` : currentWave.toFixed(1)}
            </span>
          </div>

          {/* Time window selector */}
          <div className="flex border border-slate-300 bg-white">
            {([2, 5, 10] as const).map((sec) => (
              <button
                key={sec}
                onClick={() => setTimeWindowSec(sec)}
                className={`px-2 py-0.5 text-[11px] font-mono uppercase font-semibold transition-colors ${
                  timeWindowSec === sec
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {sec}s
              </button>
            ))}
          </div>

          {/* Grid toggle */}
          <button
            onClick={() => setShowGrid(!showGrid)}
            title="Toggle Grid Lines"
            className={`p-1 border border-slate-300 transition-colors ${
              showGrid ? 'bg-slate-200 text-slate-900' : 'bg-white text-slate-500 hover:bg-slate-50'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
          </button>

          {/* Pause / Resume */}
          <button
            onClick={() => setIsPaused(!isPaused)}
            title={isPaused ? 'Resume trace' : 'Pause trace'}
            className={`p-1 border border-slate-300 transition-colors ${
              isPaused ? 'bg-amber-100 text-amber-900 border-amber-400' : 'bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
          </button>

          {/* Reset buffer */}
          <button
            onClick={() => {
              bufferRef.current = [];
            }}
            title="Clear buffer"
            className="p-1 border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Maximize */}
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            title={isMaximized ? 'Restore' : 'Maximize window'}
            className="p-1 border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
          >
            {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Canvas Area */}
      <div className="relative flex-1 bg-white overflow-hidden min-h-[200px]">
        <canvas ref={canvasRef} className="w-full h-full block" />

        {/* Status Overlay */}
        <div className="absolute bottom-2 left-2 flex items-center gap-2 pointer-events-none">
          <span className="font-mono text-[11px] text-slate-500 bg-white/90 px-1.5 py-0.5 border border-slate-200">
            {fingerDetected ? 'FINGER DETECTED' : 'NO FINGER CONTACT'}
          </span>
          <span className="font-mono text-[11px] text-slate-500 bg-white/90 px-1.5 py-0.5 border border-slate-200">
            SCALE: {timeWindowSec}s SPAN
          </span>
        </div>
      </div>
    </div>
  );
};
