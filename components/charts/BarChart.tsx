'use client';

import styles from './charts.module.css';

export interface BarItem {
  id?: number | string | null;
  nombre: string;
  total: number;
  cantidad?: number;
  cantidadLabel?: string;
}

interface BarChartProps {
  data: BarItem[];
  formatValue?: (n: number) => string;
  onItemClick?: (item: BarItem) => void;
  colors?: string[];
}

const DEFAULT_COLORS = [
  'var(--pink)', 'var(--cyan)', 'var(--yellow)', 'var(--pink-deep)', 'var(--cyan-deep)',
  '#a78bfa', '#34d399', '#fb923c', '#60a5fa', '#f472b6',
];

/** Gráfica de barras horizontales reutilizable para desgloses (categoría, proveedor, producto, ...). */
export function BarChart({ data, formatValue = (n) => String(n), onItemClick, colors = DEFAULT_COLORS }: BarChartProps) {
  if (data.length === 0) return <div className={styles.chartEmpty}>Sin datos para el período</div>;
  const max = Math.max(...data.map(d => d.total), 1);

  return (
    <div className={styles.barList}>
      {data.map((item, i) => (
        <div
          key={item.id ?? i}
          className={`${styles.barRow} ${onItemClick ? styles.clickableRow : ''}`}
          onClick={() => onItemClick?.(item)}
        >
          <div className={styles.barLabel} title={item.nombre}>{item.nombre}</div>
          <div className={styles.barTrack}>
            <div
              className={styles.barFill}
              style={{ width: `${(item.total / max) * 100}%`, background: colors[i % colors.length] }}
            />
          </div>
          <div className={styles.barValue}>{formatValue(item.total)}</div>
          <div className={styles.barCount}>
            {item.cantidad !== undefined ? `${item.cantidad} ${item.cantidadLabel ?? 'uds'}` : ''}
          </div>
        </div>
      ))}
    </div>
  );
}
