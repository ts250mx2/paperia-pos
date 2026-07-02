'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp, ShoppingBag, ReceiptText, Banknote,
  CreditCard, Smartphone, XCircle, BarChart2,
  Calendar, Layers, Package, ChevronDown,
} from 'lucide-react';
import styles from './dashboard.module.css';

// ─── Types ───────────────────────────────────────────────────────────────────
type Period   = 'today' | 'yesterday' | 'week' | 'month';
type GroupBy  = 'categoria' | 'producto';

interface KPI {
  totalVentas: number;
  numTransacciones: number;
  ticketPromedio: number;
  efectivo: number;
  tarjeta: number;
  transferencia: number;
  canceladas: number;
}

interface TrendPoint { fecha: string; total: number; transacciones: number; }
interface BreakItem  { id?: number | null; nombre: string; total: number; cantidad: number; }
interface HeatCell   { diaSemana: number; hora: number; total: number; transacciones: number; }

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 }).format(n || 0);

const fmtShort = (n: number) => {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${Math.round(n)}`;
};

const DAYS_ES  = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const HOURS    = Array.from({ length: 24 }, (_, i) => i);

// Build a normalised trend with filled-in days even if no data
function buildTrendData(raw: TrendPoint[], period: Period): TrendPoint[] {
  if (raw.length === 0) return [];
  const map: Record<string, TrendPoint> = {};
  raw.forEach(r => { map[r.fecha.split('T')[0]] = r; });
  return raw.map(r => map[r.fecha.split('T')[0]] || { fecha: r.fecha, total: 0, transacciones: 0 });
}

// ─── Mini SVG Line Chart ──────────────────────────────────────────────────────
function LineChart({ data, group }: { data: TrendPoint[]; group: 'dia' | 'semana' | 'mes' }) {
  if (data.length === 0) return <div className={styles.chartEmpty}>Sin datos para el período</div>;

  const W = 780, H = 200, PAD = { t: 16, r: 20, b: 40, l: 60 };
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const maxVal = Math.max(...data.map(d => d.total), 1);
  const toX    = (i: number) => PAD.l + (i / Math.max(data.length - 1, 1)) * innerW;
  const toY    = (v: number) => PAD.t + innerH - (v / maxVal) * innerH;

  const points = data.map((d, i) => `${toX(i)},${toY(d.total)}`).join(' ');
  const areaPoints = [
    `${PAD.l},${PAD.t + innerH}`,
    ...data.map((d, i) => `${toX(i)},${toY(d.total)}`),
    `${toX(data.length - 1)},${PAD.t + innerH}`,
  ].join(' ');

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(r => ({ v: maxVal * r, y: toY(maxVal * r) }));

  const formatLabel = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00');
    if (isNaN(d.getTime())) return dateStr;
    if (group === 'mes') {
      return d.toLocaleDateString('es-MX', { month: 'short', year: '2-digit' }).toUpperCase();
    }
    if (group === 'semana') {
      return 'Sem ' + d.toLocaleDateString('es-MX', { month: 'short', day: 'numeric' });
    }
    return d.toLocaleDateString('es-MX', { month: 'short', day: 'numeric' });
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg} preserveAspectRatio="none">
      <defs>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="var(--pink)"     stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--pink)"     stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Y-grid */}
      {yTicks.map(({ v, y }) => (
        <g key={v}>
          <line x1={PAD.l} y1={y} x2={W - PAD.r} y2={y} stroke="var(--border)" strokeWidth="1" />
          <text x={PAD.l - 8} y={y + 4} textAnchor="end" fontSize="11" fill="var(--text-muted)">{fmtShort(v)}</text>
        </g>
      ))}

      {/* Area fill */}
      <polygon points={areaPoints} fill="url(#lineGrad)" />

      {/* Line */}
      <polyline points={points} fill="none" stroke="var(--pink)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

      {/* Dots + labels */}
      {data.map((d, i) => (
        <g key={i}>
          <circle cx={toX(i)} cy={toY(d.total)} r="4" fill="var(--pink)" stroke="var(--surface)" strokeWidth="2">
            <title>{`${formatLabel(d.fecha)} — Ventas: ${fmt(d.total)} (${d.transacciones} ticket${d.transacciones !== 1 ? 's' : ''})`}</title>
          </circle>
          <text
            x={toX(i)} y={PAD.t + innerH + 18}
            textAnchor="middle" fontSize="10" fill="var(--text-muted)"
          >
            {formatLabel(d.fecha)}
          </text>
        </g>
      ))}
    </svg>
  );
}

// ─── Mini Horizontal Bar Chart ───────────────────────────────────────────────
function BarChart({ data, onItemClick }: { data: BreakItem[]; onItemClick?: (item: BreakItem) => void }) {
  if (data.length === 0) return <div className={styles.chartEmpty}>Sin datos para el período</div>;
  const max = Math.max(...data.map(d => d.total), 1);
  const COLORS = ['var(--pink)', 'var(--cyan)', 'var(--yellow)', 'var(--pink-deep)', 'var(--cyan-deep)',
                  '#a78bfa', '#34d399', '#fb923c', '#60a5fa', '#f472b6'];
  return (
    <div className={styles.barList}>
      {data.map((item, i) => (
        <div
          key={i}
          className={`${styles.barRow} ${onItemClick ? styles.clickableRow : ''}`}
          onClick={() => onItemClick?.(item)}
        >
          <div className={styles.barLabel} title={item.nombre}>{item.nombre}</div>
          <div className={styles.barTrack}>
            <div
              className={styles.barFill}
              style={{ width: `${(item.total / max) * 100}%`, background: COLORS[i % COLORS.length] }}
            />
          </div>
          <div className={styles.barValue}>{fmt(item.total)}</div>
          <div className={styles.barCount}>{item.cantidad} uds</div>
        </div>
      ))}
    </div>
  );
}

// ─── Heatmap ─────────────────────────────────────────────────────────────────
function Heatmap({ data }: { data: HeatCell[] }) {
  // Build a lookup: [day][hour] => { total, transacciones }
  const map: Record<string, { total: number; transacciones: number }> = {};
  let maxVal = 0;
  data.forEach(c => {
    const key = `${c.diaSemana}-${c.hora}`;
    map[key] = { total: c.total, transacciones: c.transacciones };
    if (c.total > maxVal) maxVal = c.total;
  });

  if (maxVal === 0) return <div className={styles.chartEmpty}>Sin datos para el período</div>;

  return (
    <div className={styles.heatmapWrap}>
      <div className={styles.heatmapGrid}>
        {/* Header row */}
        <div className={styles.heatCorner} />
        {HOURS.map(h => (
          <div key={h} className={styles.heatHour}>{h}h</div>
        ))}

        {/* Rows per day */}
        {DAYS_ES.map((day, d) => (
          <>
            <div key={`day-${d}`} className={styles.heatDay}>{day}</div>
            {HOURS.map(h => {
              const cell = map[`${d}-${h}`] || { total: 0, transacciones: 0 };
              const val = cell.total;
              const txs = cell.transacciones;
              const intensity = maxVal > 0 ? val / maxVal : 0;
              return (
                <div
                  key={`${d}-${h}`}
                  className={styles.heatCell}
                  title={`${day} ${h}:00 — ${fmt(val)} (${txs} ticket${txs !== 1 ? 's' : ''})`}
                  style={{
                    background: intensity === 0
                      ? 'var(--surface-2)'
                      : `rgba(255,109,130,${0.12 + intensity * 0.88})`,
                  }}
                />
              );
            })}
          </>
        ))}
      </div>
      {/* Legend */}
      <div className={styles.heatLegend}>
        <span>Menos ventas</span>
        <div className={styles.heatLegendBar} />
        <span>Más ventas</span>
      </div>
    </div>
  );
}

// ─── Helpers: compute date strings for each preset ────────────────────────
function toISO(d: Date) {
  return d.toISOString().split('T')[0];
}
function datesForPeriod(p: Period): [string, string] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  switch (p) {
    case 'today':     return [toISO(today), toISO(today)];
    case 'yesterday': {
      const y = new Date(today); y.setDate(y.getDate() - 1);
      return [toISO(y), toISO(y)];
    }
    case 'week': {
      const w = new Date(today); w.setDate(w.getDate() - 6);
      return [toISO(w), toISO(today)];
    }
    case 'month': {
      const m = new Date(today); m.setDate(m.getDate() - 29);
      return [toISO(m), toISO(today)];
    }
  }
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [groupBy,  setGroupBy]  = useState<GroupBy>('categoria');
  const [trendGroup, setTrendGroup] = useState<'dia' | 'semana' | 'mes'>('dia');
  // Por defecto: último mes (30 días). Si la BD es histórica, la detección de
  // rango de abajo ajusta a los últimos 30 días CON datos.
  const [dateFrom, setDateFrom] = useState(() => datesForPeriod('month')[0]);
  const [dateTo,   setDateTo]   = useState(() => datesForPeriod('month')[1]);
  const [data,     setData]     = useState<any>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  // Hasta que sepamos el rango real de datos no disparamos la primera carga,
  // para abrir el dashboard directamente en el período más reciente con ventas.
  const [rangeReady, setRangeReady] = useState(false);

  // Persist trendGroup grouping
  useEffect(() => {
    const saved = localStorage.getItem('paperia_dashboard_trend_group');
    if (saved === 'dia' || saved === 'semana' || saved === 'mes') {
      setTrendGroup(saved);
    }
  }, []);

  // Al montar: detecta el rango de fechas con ventas reales. Si el dato más
  // reciente es anterior a hoy (BD histórica), abre en los últimos 30 días CON datos.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/dashboard/range');
        if (res.ok) {
          const { maxDate } = await res.json();
          if (maxDate) {
            const max = new Date(maxDate);
            const today = new Date(); today.setHours(0, 0, 0, 0);
            if (toISO(max) < toISO(today)) {
              const from = new Date(max); from.setDate(from.getDate() - 29);
              setDateFrom(toISO(from));
              setDateTo(toISO(max));
            }
          }
        }
      } catch { /* si falla, se queda en "hoy" */ }
      setRangeReady(true);
    })();
  }, []);

  const handleTrendGroup = (tg: 'dia' | 'semana' | 'mes') => {
    setTrendGroup(tg);
    localStorage.setItem('paperia_dashboard_trend_group', tg);
  };

  // ─── Modal States ──────────────────────────────────────────────────────────
  const [selectedCat, setSelectedCat] = useState<{ id: number | null | undefined; nombre: string } | null>(null);
  const [modalProducts, setModalProducts] = useState<any[]>([]);
  const [modalLoading, setModalLoading]   = useState(false);
  const [modalTab, setModalTab]           = useState<'monto' | 'cantidad'>('monto');

  const fetchCategoryDetails = useCallback(async (catId: any, catName: string) => {
    setModalLoading(true);
    try {
      const params = new URLSearchParams({
        id: catId !== undefined && catId !== null ? String(catId) : '',
        name: catName,
        dateFrom,
        dateTo,
      });
      const res = await fetch(`/api/dashboard/sales/category-details?${params}`);
      if (!res.ok) throw new Error('Error al cargar detalle');
      const json = await res.json();
      setModalProducts(json.products || []);
    } catch (e) {
      console.error(e);
    } finally {
      setModalLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    if (selectedCat) {
      fetchCategoryDetails(selectedCat.id, selectedCat.nombre);
    } else {
      setModalProducts([]);
    }
  }, [selectedCat, fetchCategoryDetails]);

  const handleCategoryClick = (item: BreakItem) => {
    setSelectedCat({ id: item.id, nombre: item.nombre });
    setModalTab('monto');
  };

  const modalTotalMonto = modalProducts.reduce((acc, p) => acc + Number(p.total), 0);
  const modalTotalCant  = modalProducts.reduce((acc, p) => acc + Number(p.cantidad), 0);

  const fetchData = useCallback(async (g: GroupBy, from: string, to: string, tg: 'dia' | 'semana' | 'mes') => {
    if (!from || !to) return;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ groupBy: g, dateFrom: from, dateTo: to, trendGroup: tg });
      const res = await fetch(`/api/dashboard/sales?${params}`);
      if (!res.ok) throw new Error('Error al cargar datos');
      setData(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!rangeReady) return;
    fetchData(groupBy, dateFrom, dateTo, trendGroup);
  }, [rangeReady, groupBy, dateFrom, dateTo, trendGroup, fetchData]);

  // Period button clicked — sets the date pickers to the preset range
  const handlePeriod = (p: Period) => {
    const [from, to] = datesForPeriod(p);
    setDateFrom(from);
    setDateTo(to);
  };

  // Detect which preset the current dates match (for active highlight)
  const activePeriod: Period | null = (['today','yesterday','week','month'] as Period[]).find(p => {
    const [f, t] = datesForPeriod(p);
    return f === dateFrom && t === dateTo;
  }) ?? null;


  const periodLabel: Record<Period, string> = {
    today:     'Hoy',
    yesterday: 'Ayer',
    week:      'Últimos 7 días',
    month:     'Últimos 30 días',
  };

  const activeLabel = activePeriod
    ? periodLabel[activePeriod]
    : `${dateFrom} → ${dateTo}`;

  const kpi: KPI = data?.kpi ?? {
    totalVentas: 0, numTransacciones: 0, ticketPromedio: 0,
    efectivo: 0, tarjeta: 0, transferencia: 0, canceladas: 0,
  };

  return (
    <div className={styles.container}>
      {/* ── Header ── */}
      <header className={styles.header}>
        <div className={styles.titleGroup}>
          <BarChart2 size={32} color="var(--primary)" />
          <div>
            <h1>Dashboard de Ventas</h1>
            <p className={styles.subtitle}>Análisis de rendimiento y KPIs — {activeLabel}</p>
          </div>
        </div>

        {/* Single filter row: preset buttons + date pickers */}
        <div className={styles.filterRow}>
          {(['today','yesterday','week','month'] as Period[]).map(p => (
            <button
              key={p}
              id={`period-${p}`}
              className={`${styles.periodBtn} ${activePeriod === p ? styles.periodActive : ''}`}
              onClick={() => handlePeriod(p)}
            >
              {p === 'today'     && <><Calendar size={14} /> Hoy</>}
              {p === 'yesterday' && <><Calendar size={14} /> Ayer</>}
              {p === 'week'      && <><Calendar size={14} /> Semana</>}
              {p === 'month'     && <><Calendar size={14} /> Mes</>}
            </button>
          ))}

          <div className={styles.dateDivider} />

          <input
            id="date-from"
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className={styles.dateInput}
          />
          <span className={styles.dateSep}>→</span>
          <input
            id="date-to"
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className={styles.dateInput}
          />
        </div>
      </header>

      {error && <div className={styles.errorMsg}>{error}</div>}

      {/* ── KPI Cards ── */}
      <div className={styles.kpiGrid}>
        <div className={`${styles.kpiCard} glass ${styles.kpiMain}`}>
          <div className={styles.kpiIcon} style={{ background: 'var(--pink-glow)', color: 'var(--pink)' }}>
            <TrendingUp size={22} />
          </div>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>Ventas Totales</span>
            <span className={styles.kpiValue}>{loading ? '—' : fmt(kpi.totalVentas)}</span>
            <span className={styles.kpiSub}>{activeLabel}</span>
          </div>
        </div>

        <div className={`${styles.kpiCard} glass`}>
          <div className={styles.kpiIcon} style={{ background: 'rgba(93,224,230,0.12)', color: 'var(--cyan)' }}>
            <ReceiptText size={22} />
          </div>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>Transacciones</span>
            <span className={styles.kpiValue}>{loading ? '—' : kpi.numTransacciones}</span>
            <span className={styles.kpiSub}>tickets procesados</span>
          </div>
        </div>

        <div className={`${styles.kpiCard} glass`}>
          <div className={styles.kpiIcon} style={{ background: 'rgba(253,216,53,0.12)', color: 'var(--yellow-deep)' }}>
            <ShoppingBag size={22} />
          </div>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>Ticket Promedio</span>
            <span className={styles.kpiValue}>{loading ? '—' : fmt(kpi.ticketPromedio)}</span>
            <span className={styles.kpiSub}>por venta</span>
          </div>
        </div>

        <div className={`${styles.kpiCard} glass`}>
          <div className={styles.kpiIcon} style={{ background: 'rgba(245,101,101,0.10)', color: 'var(--danger)' }}>
            <XCircle size={22} />
          </div>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>Cancelaciones</span>
            <span className={styles.kpiValue}>{loading ? '—' : kpi.canceladas}</span>
            <span className={styles.kpiSub}>en el período</span>
          </div>
        </div>
      </div>

      {/* ── Payment breakdown mini cards ── */}
      <div className={styles.payGrid}>
        <div className={`${styles.payCard} glass`}>
          <Banknote size={18} color="var(--secondary)" />
          <span className={styles.payLabel}>Efectivo</span>
          <span className={styles.payVal}>{loading ? '—' : fmt(kpi.efectivo)}</span>
        </div>
        <div className={`${styles.payCard} glass`}>
          <CreditCard size={18} color="var(--pink)" />
          <span className={styles.payLabel}>Tarjeta</span>
          <span className={styles.payVal}>{loading ? '—' : fmt(kpi.tarjeta)}</span>
        </div>
        <div className={`${styles.payCard} glass`}>
          <Smartphone size={18} color="var(--yellow-deep)" />
          <span className={styles.payLabel}>Transferencia</span>
          <span className={styles.payVal}>{loading ? '—' : fmt(kpi.transferencia)}</span>
        </div>
      </div>

      {/* ── Trend Chart ── */}
      <div className={`${styles.chartCard} glass`}>
        <div className={styles.chartHeader}>
          <div>
            <h3 className={styles.chartTitle}>Tendencia de Ventas</h3>
            <p className={styles.chartSub}>
              Ventas por {trendGroup === 'dia' ? 'día' : trendGroup === 'semana' ? 'semana' : 'mes'} en el período seleccionado
            </p>
          </div>
          <div className={styles.groupBtns}>
            <button
              className={`${styles.groupBtn} ${trendGroup === 'dia' ? styles.groupActive : ''}`}
              onClick={() => handleTrendGroup('dia')}
            >
              Día
            </button>
            <button
              className={`${styles.groupBtn} ${trendGroup === 'semana' ? styles.groupActive : ''}`}
              onClick={() => handleTrendGroup('semana')}
            >
              Semana
            </button>
            <button
              className={`${styles.groupBtn} ${trendGroup === 'mes' ? styles.groupActive : ''}`}
              onClick={() => handleTrendGroup('mes')}
            >
              Mes
            </button>
          </div>
        </div>
        <div className={styles.chartBody}>
          {loading
            ? <div className={styles.chartEmpty}>Cargando...</div>
            : <LineChart
                data={(data?.trend ?? []).map((r: any) => ({ ...r, fecha: r.fecha?.split('T')[0] ?? r.fecha }))}
                group={trendGroup}
              />
          }
        </div>
      </div>

      {/* ── Breakdown Chart ── */}
      <div className={`${styles.chartCard} glass`}>
        <div className={styles.chartHeader}>
          <div>
            <h3 className={styles.chartTitle}>Ventas por {groupBy === 'categoria' ? 'Categoría' : 'Producto'}</h3>
            <p className={styles.chartSub}>Desglose del período seleccionado</p>
          </div>
          <div className={styles.groupBtns}>
            <button
              id="group-categoria"
              className={`${styles.groupBtn} ${groupBy === 'categoria' ? styles.groupActive : ''}`}
              onClick={() => setGroupBy('categoria')}
            >
              <Layers size={14} /> Categoría
            </button>
            <button
              id="group-producto"
              className={`${styles.groupBtn} ${groupBy === 'producto' ? styles.groupActive : ''}`}
              onClick={() => setGroupBy('producto')}
            >
              <Package size={14} /> Producto
            </button>
          </div>
        </div>
        <div className={styles.chartBody}>
          {loading
            ? <div className={styles.chartEmpty}>Cargando...</div>
            : <BarChart
                data={data?.breakdown ?? []}
                onItemClick={groupBy === 'categoria' ? handleCategoryClick : undefined}
              />
          }
        </div>
      </div>

      {/* ── Heatmap ── */}
      <div className={`${styles.chartCard} glass`}>
        <div className={styles.chartHeader}>
          <div>
            <h3 className={styles.chartTitle}>Mapa de Calor por Hora</h3>
            <p className={styles.chartSub}>Concentración de ventas por día de la semana y hora del día</p>
          </div>
        </div>
        <div className={styles.chartBody}>
          {loading
            ? <div className={styles.chartEmpty}>Cargando...</div>
            : <Heatmap data={data?.heatmap ?? []} />
          }
        </div>
      </div>

      {/* ─── Category Details Modal ─── */}
      {selectedCat && (
        <div className={styles.modalOverlay} onClick={() => setSelectedCat(null)}>
          <div className={`${styles.modalContent} glass`} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <div className={styles.modalTitleGroup}>
                <h3>{selectedCat.nombre}</h3>
                <p>Detalle de productos en el período seleccionado</p>
              </div>
              <button className={styles.modalCloseBtn} onClick={() => setSelectedCat(null)}>
                <XCircle size={20} />
              </button>
            </div>

            {/* KPIs */}
            <div className={styles.modalKpis}>
              <div className={styles.modalKpiCard}>
                <span className={styles.modalKpiLabel}>Ventas Totales</span>
                <span className={styles.modalKpiValue}>
                  {modalLoading ? '—' : fmt(modalTotalMonto)}
                </span>
              </div>
              <div className={styles.modalKpiCard}>
                <span className={styles.modalKpiLabel}>Unidades Vendidas</span>
                <span className={styles.modalKpiValue}>
                  {modalLoading ? '—' : `${modalTotalCant} uds`}
                </span>
              </div>
            </div>

            {/* Tabs */}
            <div className={styles.modalTabs}>
              <button
                className={`${styles.modalTabBtn} ${modalTab === 'monto' ? styles.modalTabActivePink : ''}`}
                onClick={() => setModalTab('monto')}
              >
                <Banknote size={15} /> Monto ($)
              </button>
              <button
                className={`${styles.modalTabBtn} ${modalTab === 'cantidad' ? styles.modalTabActiveCyan : ''}`}
                onClick={() => setModalTab('cantidad')}
              >
                <Package size={15} /> Cantidad (Uds)
              </button>
            </div>

            {/* Content List */}
            <div className={styles.modalChartBody}>
              {modalLoading ? (
                <div className={styles.chartEmpty}>Cargando desglose...</div>
              ) : modalProducts.length === 0 ? (
                <div className={styles.chartEmpty}>Sin ventas registradas en este período</div>
              ) : (
                (() => {
                  const maxVal = Math.max(
                    ...modalProducts.map(p => (modalTab === 'monto' ? Number(p.total) : Number(p.cantidad))),
                    1
                  );
                  return modalProducts.map((p, i) => {
                    const currentVal = modalTab === 'monto' ? Number(p.total) : Number(p.cantidad);
                    const pct = (currentVal / maxVal) * 100;
                    return (
                      <div key={p.id || i} className={styles.modalBarRow}>
                        <div className={styles.modalBarRank}>#{i + 1}</div>
                        <div className={styles.modalBarContent}>
                          <div className={styles.modalBarLabel} title={p.nombre}>{p.nombre}</div>
                          <div className={styles.modalBarTrack}>
                            <div
                              className={modalTab === 'monto' ? styles.modalBarFillPink : styles.modalBarFillCyan}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                        <div className={styles.modalBarValue}>
                          {modalTab === 'monto' ? fmt(p.total) : `${p.cantidad} uds`}
                        </div>
                      </div>
                    );
                  });
                })()
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
