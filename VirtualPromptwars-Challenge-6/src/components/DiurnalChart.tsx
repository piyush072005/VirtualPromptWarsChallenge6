import { useState } from 'react';
import type { HourlyAirPoint } from '@shared/types.ts';

interface DiurnalChartProps {
  hourly: HourlyAirPoint[];
  city: string;
  bestVentilationWindow: string;
  peakSmogWindow: string;
}

export function DiurnalChart({
  hourly,
  city,
  bestVentilationWindow,
  peakSmogWindow,
}: DiurnalChartProps) {
  const [showTable, setShowTable] = useState(false);
  const maxPm = Math.max(60, ...hourly.map((h) => h.pm25));

  const width = 680;
  const height = 180;
  const padX = 28;
  const padY = 18;
  const plotW = width - padX * 2;
  const plotH = height - padY * 2;

  const coords = hourly.map((pt, idx) => {
    const x = padX + (idx / Math.max(1, hourly.length - 1)) * plotW;
    const y = padY + plotH - (pt.pm25 / maxPm) * plotH;
    return { x, y, pt };
  });

  const polylinePoints = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');

  return (
    <section aria-labelledby="diurnal-heading" className="card">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        <div>
          <h2 id="diurnal-heading" className="section-heading" style={{ marginBottom: 0 }}>
            24-Hour Winter Smog & Ventilation Curve ({city})
          </h2>
          <p className="muted-text" style={{ margin: '0.2rem 0 0' }}>
            Safest brief air-out window: <strong>{bestVentilationWindow}</strong> ·
            Peak inversion smog: <strong>{peakSmogWindow}</strong>
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          aria-expanded={showTable}
          onClick={() => setShowTable((prev) => !prev)}
        >
          {showTable ? 'Hide hourly data table' : 'View hourly data table'}
        </button>
      </div>

      <div style={{ marginTop: '0.75rem', overflowX: 'auto' }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: '100%', maxWidth: '680px', height: 'auto', display: 'block' }}
          role="img"
          aria-label={`24-hour PM2.5 curve for ${city}. Best ventilation window is ${bestVentilationWindow}; peak smog inversion is ${peakSmogWindow}.`}
        >
          <rect x="0" y="0" width={width} height={height} fill="#f8fafc" rx="8" />
          {/* Midday solar mixing highlight */}
          {coords[12] && coords[15] && (
            <rect
              x={coords[12].x}
              y={padY}
              width={coords[15].x - coords[12].x}
              height={plotH}
              fill="#ccfbf1"
              opacity="0.7"
            />
          )}
          {/* WHO 15 ug/m3 guideline reference */}
          <line
            x1={padX}
            x2={width - padX}
            y1={padY + plotH - (15 / maxPm) * plotH}
            y2={padY + plotH - (15 / maxPm) * plotH}
            stroke="#0b6e63"
            strokeDasharray="4 4"
            strokeWidth="1.5"
          />
          <polyline
            fill="none"
            stroke="#0f172a"
            strokeWidth="2.5"
            points={polylinePoints}
          />
          {coords
            .filter((_, i) => i % 3 === 0)
            .map((c) => (
              <g key={c.pt.hour}>
                <circle
                  cx={c.x}
                  cy={c.y}
                  r="4"
                  fill={c.pt.ventilationSafe ? '#0b6e63' : '#b91c1c'}
                />
                <text
                  x={c.x}
                  y={height - 3}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#334155"
                >
                  {c.pt.label}
                </text>
              </g>
            ))}
        </svg>
      </div>

      {showTable && (
        <table className="data-table">
          <caption className="sr-only">
            Hourly PM2.5 and ventilation guidance for {city}
          </caption>
          <thead>
            <tr>
              <th scope="col">Hour</th>
              <th scope="col">PM2.5 (µg/m³)</th>
              <th scope="col">AQI</th>
              <th scope="col">Window Status</th>
            </tr>
          </thead>
          <tbody>
            {hourly
              .filter((_, i) => i % 2 === 0)
              .map((h) => (
                <tr key={h.hour}>
                  <td>{h.label}</td>
                  <td>{h.pm25}</td>
                  <td>{h.aqi}</td>
                  <td>{h.ventilationSafe ? 'Brief vent OK' : 'Keep sealed'}</td>
                </tr>
              ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
