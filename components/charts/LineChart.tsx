'use client';

import styles from './charts.module.css';

export interface TrendPoint {
  fecha: string;
  total: number;
  count?: number;
}

type TrendGroup = 'dia' | 'semana' | 'mes';

interface LineChartProps {
  data: TrendPoint[];
  group: TrendGroup;
  formatValue?: (n: number) => string;
  formatValueShort?: (n: number) => string;
  countLabel?: string;
  color?: string;
}

function formatLabel(dateStr: string, group: TrendGroup): string {
  const d = new Date(dateStr + 'T12:00:00');
  if (isNaN(d.getTime())) return dateStr;
  if (group === 'mes') {
    return d.toLocaleDateString('es-MX', { month: 'short', year: '2-digit' }).toUpperCase();
  }
  if (group === 'semana') {
    return 'Sem ' + d.toLocaleDateString('es-MX', { month: 'short', day: 'numeric' });
  }
  return d.toLocaleDateString('es-MX', { month: 'short', day: 'numeric' });
}

/** Gráfica de línea SVG reutilizable para tendencias por fecha (ventas, gastos, movimientos de inventario, ...). */
export function LineChart({
  data,
  group,
  formatValue = (n) => String(n),
  formatValueShort = (n) => String(n),
  countLabel = 'registro',
  color = 'var(--pink)',
}: LineChartProps) {
  if (data.length === 0) return <div className={styles.chartEmpty}>Sin datos para el período</div>;

  const W = 780, H = 200, PAD = { t: 16, r: 20, b: 40, l: 60 };
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const maxVal = Math.max(...data.map(d => d.total), 1);
  const toX = (i: number) => PAD.l + (i / Math.max(data.length - 1, 1)) * innerW;
  const toY = (v: number) => PAD.t + innerH - (v / maxVal) * innerH;

  const points = data.map((d, i) => `${toX(i)},${toY(d.total)}`).join(' ');
  const areaPoints = [
    `${PAD.l},${PAD.t + innerH}`,
    ...data.map((d, i) => `${toX(i)},${toY(d.total)}`),
    `${toX(data.length - 1)},${PAD.t + innerH}`,
  ].join(' ');

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(r => ({ v: maxVal * r, y: toY(maxVal * r) }));
  const gradientId = `lineGrad-${color.replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Y-grid */}
      {yTicks.map(({ v, y }) => (
        <g key={v}>
          <line x1={PAD.l} y1={y} x2={W - PAD.r} y2={y} stroke="var(--border)" strokeWidth="1" />
          <text x={PAD.l - 8} y={y + 4} textAnchor="end" fontSize="11" fill="var(--text-muted)">{formatValueShort(v)}</text>
        </g>
      ))}

      {/* Area fill */}
      <polygon points={areaPoints} fill={`url(#${gradientId})`} />

      {/* Line */}
      <polyline points={points} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

      {/* Dots + labels */}
      {data.map((d, i) => (
        <g key={i}>
          <circle cx={toX(i)} cy={toY(d.total)} r="4" fill={color} stroke="var(--surface)" strokeWidth="2">
            <title>
              {`${formatLabel(d.fecha, group)} — ${formatValue(d.total)}`}
              {d.count !== undefined ? ` (${d.count} ${countLabel}${d.count !== 1 ? 's' : ''})` : ''}
            </title>
          </circle>
          <text
            x={toX(i)} y={PAD.t + innerH + 18}
            textAnchor="middle" fontSize="10" fill="var(--text-muted)"
          >
            {formatLabel(d.fecha, group)}
          </text>
        </g>
      ))}
    </svg>
  );
}
