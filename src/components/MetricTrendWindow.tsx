import React, { useMemo, useState } from 'react';
import { Grid, Maximize2, Minimize2, TrendingUp } from 'lucide-react';
import { TelemetryReading } from '../types';

interface MetricTrendWindowProps {
  title: string;
  windowNumber: number;
  metricKey: 'bpm' | 'spo2';
  colorName: string;
  primaryColor: string; // Hex color for line
  areaColor: string; // Hex color for area fill
  unit: string;
  readings: TelemetryReading[];
  currentValue: number | null;
  referenceZones?: {
    minNormal?: number;
    maxNormal?: number;
    threshold?: number;
    thresholdLabel?: string;
  };
  yDomain?: [number, number]; // Fixed y min and max
}

export const MetricTrendWindow: React.FC<MetricTrendWindowProps> = ({
  title,
  windowNumber,
  metricKey,
  colorName,
  primaryColor,
  areaColor,
  unit,
  readings,
  currentValue,
  referenceZones,
  yDomain,
}) => {
  const [timeSpanSec, setTimeSpanSec] = useState<number>(60); // 30, 60, 120, 300
  const [showGrid, setShowGrid] = useState(true);
  const [isMaximized, setIsMaximized] = useState(false);

  // Filter readings within the selected time window
  const filteredData = useMemo(() => {
    if (readings.length === 0) return [];
    const latestTime = readings[readings.length - 1].timestamp;
    const cutoff = latestTime - timeSpanSec * 1000;
    return readings
      .filter((r) => r.timestamp >= cutoff)
      .map((r) => ({
        time: r.timestamp,
        val: metricKey === 'bpm' ? r.bpm : r.spo2,
      }))
      .filter((d): d is { time: number; val: number } => d.val !== null && d.val !== undefined && d.val > 0);
  }, [readings, timeSpanSec, metricKey]);

  // Compute stats
  const stats = useMemo(() => {
    if (filteredData.length === 0) {
      return { min: 0, max: 0, avg: 0 };
    }
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    for (const d of filteredData) {
      if (d.val < min) min = d.val;
      if (d.val > max) max = d.val;
      sum += d.val;
    }
    return {
      min,
      max,
      avg: Math.round(sum / filteredData.length),
    };
  }, [filteredData]);

  // Compute coordinate mapping for SVG plot
  const { pathD, areaD, yMin, yMax, points } = useMemo(() => {
    const width = 600;
    const height = 180;
    const padTop = 20;
    const padBottom = 26;
    const padLeft = 46;
    const padRight = 16;

    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    if (filteredData.length === 0) {
      return { pathD: '', areaD: '', yMin: 0, yMax: 100, points: [] };
    }

    let min = yDomain ? yDomain[0] : Math.min(...filteredData.map((d) => d.val));
    let max = yDomain ? yDomain[1] : Math.max(...filteredData.map((d) => d.val));

    if (!yDomain) {
      // Add headroom
      const span = Math.max(10, max - min);
      min = Math.floor(min - span * 0.15);
      max = Math.ceil(max + span * 0.15);
    }

    const tStart = filteredData[0].time;
    const tEnd = filteredData[filteredData.length - 1].time;
    const tSpan = Math.max(1000, tEnd - tStart);

    const pts = filteredData.map((d) => {
      const x = padLeft + ((d.time - tStart) / tSpan) * plotW;
      const yValClamped = Math.max(min, Math.min(max, d.val));
      const y = padTop + (1 - (yValClamped - min) / (max - min || 1)) * plotH;
      return { x, y, val: d.val, time: d.time };
    });

    if (pts.length === 1) {
      const p = pts[0];
      return {
        pathD: `M ${padLeft} ${p.y} L ${padLeft + plotW} ${p.y}`,
        areaD: `M ${padLeft} ${p.y} L ${padLeft + plotW} ${p.y} L ${padLeft + plotW} ${padTop + plotH} L ${padLeft} ${padTop + plotH} Z`,
        yMin: min,
        yMax: max,
        points: pts,
      };
    }

    const pathString = pts.reduce((acc, p, i) => {
      return `${acc} ${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
    }, '');

    const areaString = `${pathString} L ${pts[pts.length - 1].x.toFixed(1)} ${padTop + plotH} L ${pts[0].x.toFixed(1)} ${padTop + plotH} Z`;

    return { pathD: pathString, areaD: areaString, yMin: min, yMax: max, points: pts };
  }, [filteredData, yDomain]);

  return (
    <div
      className={`border border-slate-300 bg-white flex flex-col ${
        isMaximized
          ? 'fixed inset-4 z-50 shadow-2xl'
          : 'h-full min-h-[300px]'
      }`}
    >
      {/* Window Header */}
      <div className="bg-slate-100 border-b border-slate-300 px-3 py-2 flex items-center justify-between select-none">
        <div className="flex items-center gap-2">
          {/* Distinct Color Swatch */}
          <span
            className="w-3 h-3 inline-block border"
            style={{ backgroundColor: primaryColor, borderColor: primaryColor }}
          />
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-slate-800">
            Window {windowNumber} // {title}
          </span>
          <span
            className="text-[11px] font-mono px-1.5 py-0.5 border"
            style={{
              backgroundColor: `${primaryColor}10`,
              color: primaryColor,
              borderColor: `${primaryColor}40`,
            }}
          >
            COLOR: {colorName}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Current Prominent Readout */}
          <div className="font-mono text-xs font-bold text-slate-900 bg-white px-2 py-0.5 border border-slate-300 mr-2 flex items-center gap-1.5">
            <span>NOW:</span>
            <span style={{ color: primaryColor }} className="text-sm font-bold">
              {currentValue !== null && currentValue !== undefined && currentValue > 0
                ? `${currentValue} ${unit}`
                : '--'}
            </span>
          </div>

          {/* Time Span Selector */}
          <div className="flex border border-slate-300 bg-white">
            {([30, 60, 120, 300] as const).map((sec) => (
              <button
                key={sec}
                onClick={() => setTimeSpanSec(sec)}
                className={`px-1.5 py-0.5 text-[11px] font-mono uppercase font-semibold transition-colors ${
                  timeSpanSec === sec
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {sec >= 60 ? `${sec / 60}m` : `${sec}s`}
              </button>
            ))}
          </div>

          {/* Grid Toggle */}
          <button
            onClick={() => setShowGrid(!showGrid)}
            title="Toggle Grid Lines"
            className={`p-1 border border-slate-300 transition-colors ${
              showGrid ? 'bg-slate-200 text-slate-900' : 'bg-white text-slate-500 hover:bg-slate-50'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
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

      {/* SVG Chart Area */}
      <div className="relative flex-1 bg-white p-2 flex flex-col justify-between min-h-[190px]">
        {filteredData.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 font-mono text-xs">
            <TrendingUp className="w-6 h-6 mb-2 opacity-40" />
            <span>Awaiting telemetry stream to plot {title.toLowerCase()} trend...</span>
            <span className="text-[11px] text-slate-400 mt-1">Ensure finger is placed on MAX30102 sensor</span>
          </div>
        ) : (
          <svg viewBox="0 0 600 180" className="w-full h-full overflow-visible" preserveAspectRatio="none">
            {/* Grid Lines */}
            {showGrid && (
              <g stroke="#f1f5f9" strokeWidth="1">
                <line x1="46" y1="20" x2="584" y2="20" />
                <line x1="46" y1="58" x2="584" y2="58" />
                <line x1="46" y1="96" x2="584" y2="96" />
                <line x1="46" y1="134" x2="584" y2="134" />
                <line x1="46" y1="154" x2="584" y2="154" />

                <line x1="150" y1="20" x2="150" y2="154" />
                <line x1="260" y1="20" x2="260" y2="154" />
                <line x1="370" y1="20" x2="370" y2="154" />
                <line x1="480" y1="20" x2="480" y2="154" />
              </g>
            )}

            {/* Reference Normal Range Zone (if defined) */}
            {referenceZones && (
              <>
                {referenceZones.threshold && (
                  <g>
                    <line
                      x1="46"
                      y1={
                        20 +
                        (1 - (referenceZones.threshold - yMin) / (yMax - yMin || 1)) * 134
                      }
                      x2="584"
                      y2={
                        20 +
                        (1 - (referenceZones.threshold - yMin) / (yMax - yMin || 1)) * 134
                      }
                      stroke="#f59e0b"
                      strokeWidth="1.2"
                      strokeDasharray="4 4"
                    />
                    <text
                      x="50"
                      y={
                        16 +
                        (1 - (referenceZones.threshold - yMin) / (yMax - yMin || 1)) * 134
                      }
                      fill="#b45309"
                      fontSize="9"
                      fontFamily="monospace"
                    >
                      {referenceZones.thresholdLabel || 'REF LIMIT'} ({referenceZones.threshold} {unit})
                    </text>
                  </g>
                )}
              </>
            )}

            {/* Area Fill */}
            {areaD && <path d={areaD} fill={areaColor} opacity="0.12" />}

            {/* Trend Polyline */}
            {pathD && (
              <path
                d={pathD}
                fill="none"
                stroke={primaryColor}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Latest reading pulse circle */}
            {points.length > 0 && (
              <g>
                <circle
                  cx={points[points.length - 1].x}
                  cy={points[points.length - 1].y}
                  r="5"
                  fill={primaryColor}
                />
                <circle
                  cx={points[points.length - 1].x}
                  cy={points[points.length - 1].y}
                  r="8"
                  fill="none"
                  stroke={primaryColor}
                  strokeWidth="1.5"
                  opacity="0.6"
                />
              </g>
            )}

            {/* Y-Axis Labels */}
            <text x="8" y="24" fill="#64748b" fontSize="10" fontFamily="monospace">
              {yMax}
            </text>
            <text x="8" y="90" fill="#64748b" fontSize="10" fontFamily="monospace">
              {Math.round((yMax + yMin) / 2)}
            </text>
            <text x="8" y="154" fill="#64748b" fontSize="10" fontFamily="monospace">
              {yMin}
            </text>
          </svg>
        )}

        {/* Footer Statistics Bar */}
        <div className="border-t border-slate-200 pt-1.5 mt-1 flex items-center justify-between text-[11px] font-mono text-slate-600">
          <div className="flex items-center gap-3">
            <span>
              MIN: <strong className="text-slate-800">{stats.min || '--'} {unit}</strong>
            </span>
            <span>
              AVG: <strong className="text-slate-800">{stats.avg || '--'} {unit}</strong>
            </span>
            <span>
              MAX: <strong className="text-slate-800">{stats.max || '--'} {unit}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2 text-slate-500">
            <span>SAMPLES: {filteredData.length}</span>
            <span>•</span>
            <span>LAST {timeSpanSec >= 60 ? `${timeSpanSec / 60}m` : `${timeSpanSec}s`}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
