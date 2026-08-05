'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Boxes, PackageCheck, AlertTriangle, Coins, Calendar,
  ArrowDownToLine, ArrowUpFromLine, Layers, TrendingDown,
} from 'lucide-react';
import styles from '../../shared-dashboard.module.css';
import { LineChart } from '@/components/charts/LineChart';
import { BarChart } from '@/components/charts/BarChart';
import { type Period, datesForPeriod } from '@/lib/dateRange';
import { formatCurrencyMXN } from '@/lib/format';

interface KPI {
  skusConStock: number;
  unidadesTotales: number;
  valorInventario: number;
  productosBajoStock: number;
  productosNegativos: number;
}

interface Flow {
  entradas: number;
  salidas: number;
  numMovimientos: number;
}

interface LowStockRow {
  IdProducto: number;
  Producto: string;
  Categoria?: string;
  StockMinimo: number;
  Stock: number;
}

interface DashboardData {
  kpi: KPI;
  flow: Flow;
  trend: { fecha: string; entradas: number; salidas: number; cantidad: number }[];
  lowStock: LowStockRow[];
  byCategory: { nombre: string; total: number; cantidad: number }[];
  topMoved: { nombre: string; total: number; cantidad: number }[];
}

const fmtUnits = (n: number) => `${Number(n || 0).toLocaleString('es-MX')}`;

export default function InventoryDashboardPage() {
  const [trendGroup, setTrendGroup] = useState<'dia' | 'semana' | 'mes'>('dia');
  const [trendMetric, setTrendMetric] = useState<'salidas' | 'entradas'>('salidas');
  const [dateFrom, setDateFrom]     = useState(() => datesForPeriod('month')[0]);
  const [dateTo, setDateTo]         = useState(() => datesForPeriod('month')[1]);
  const [data, setData]             = useState<DashboardData | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ dateFrom, dateTo, trendGroup });
      const res = await fetch(`/api/dashboard/inventory?${params}`);
      if (!res.ok) throw new Error('Error al cargar datos');
      setData(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, trendGroup]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handlePeriod = (p: Period) => {
    const [from, to] = datesForPeriod(p);
    setDateFrom(from);
    setDateTo(to);
  };

  const activePeriod: Period | null = (['today', 'yesterday', 'week', 'month'] as Period[]).find(p => {
    const [f, t] = datesForPeriod(p);
    return f === dateFrom && t === dateTo;
  }) ?? null;

  const periodLabel: Record<Period, string> = {
    today: 'Hoy', yesterday: 'Ayer', week: 'Últimos 7 días', month: 'Últimos 30 días',
  };
  const activeLabel = activePeriod ? periodLabel[activePeriod] : `${dateFrom} → ${dateTo}`;

  const kpi: KPI = data?.kpi ?? {
    skusConStock: 0, unidadesTotales: 0, valorInventario: 0, productosBajoStock: 0, productosNegativos: 0,
  };
  const flow: Flow = data?.flow ?? { entradas: 0, salidas: 0, numMovimientos: 0 };

  const trendData = (data?.trend ?? []).map(r => ({
    fecha: r.fecha?.split('T')[0] ?? r.fecha,
    total: Number(trendMetric === 'salidas' ? r.salidas : r.entradas),
    count: r.cantidad,
  }));

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleGroup}>
          <Boxes size={32} color="var(--primary)" />
          <div>
            <h1>Dashboard de Inventario</h1>
            <p className={styles.subtitle}>Existencias, flujo de stock y alertas — {activeLabel}</p>
          </div>
        </div>

        <div className={styles.filterRow}>
          {(['today', 'yesterday', 'week', 'month'] as Period[]).map(p => (
            <button
              key={p}
              className={`${styles.periodBtn} ${activePeriod === p ? styles.periodActive : ''}`}
              onClick={() => handlePeriod(p)}
            >
              <Calendar size={14} /> {periodLabel[p]}
            </button>
          ))}
          <div className={styles.dateDivider} />
          <input type="date" className={styles.dateInput} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          <span className={styles.dateSep}>→</span>
          <input type="date" className={styles.dateInput} value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
      </header>

      {error && <div className={styles.errorMsg}>{error}</div>}

      {/* ── KPI Cards (estado actual del inventario) ── */}
      <div className={styles.kpiGrid}>
        <div className={`${styles.kpiCard} glass ${styles.kpiMain}`}>
          <div className={styles.kpiIcon} style={{ background: 'var(--pink-glow)', color: 'var(--pink)' }}>
            <Coins size={22} />
          </div>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>Valor de Inventario</span>
            <span className={styles.kpiValue}>{loading ? '—' : formatCurrencyMXN(kpi.valorInventario)}</span>
            <span className={styles.kpiSub}>a costo, estado actual</span>
          </div>
        </div>

        <div className={`${styles.kpiCard} glass`}>
          <div className={styles.kpiIcon} style={{ background: 'rgba(93,224,230,0.12)', color: 'var(--cyan)' }}>
            <PackageCheck size={22} />
          </div>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>Unidades en Stock</span>
            <span className={styles.kpiValue}>{loading ? '—' : fmtUnits(kpi.unidadesTotales)}</span>
            <span className={styles.kpiSub}>{loading ? '' : `${kpi.skusConStock} SKUs con movimientos`}</span>
          </div>
        </div>

        <div className={`${styles.kpiCard} glass ${kpi.productosBajoStock > 0 ? styles.kpiWarn : ''}`}>
          <div className={styles.kpiIcon} style={{ background: 'rgba(245,101,101,0.10)', color: 'var(--danger)' }}>
            <AlertTriangle size={22} />
          </div>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>Bajo Stock</span>
            <span className={styles.kpiValue}>{loading ? '—' : kpi.productosBajoStock}</span>
            <span className={styles.kpiSub}>productos en o bajo el mínimo</span>
          </div>
        </div>

        <div className={`${styles.kpiCard} glass`}>
          <div className={styles.kpiIcon} style={{ background: 'rgba(253,216,53,0.12)', color: 'var(--yellow-deep)' }}>
            <TrendingDown size={22} />
          </div>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>Stock Negativo</span>
            <span className={styles.kpiValue}>{loading ? '—' : kpi.productosNegativos}</span>
            <span className={styles.kpiSub}>requieren ajuste de inventario</span>
          </div>
        </div>
      </div>

      {/* ── Flujo del período ── */}
      <div className={styles.kpiGrid} style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '1.75rem' }}>
        <div className={`${styles.kpiCard} glass`} style={{ padding: '1rem 1.25rem' }}>
          <ArrowDownToLine size={18} color="var(--green, #8cc63e)" />
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>Entradas del período</span>
            <span className={styles.kpiValue} style={{ fontSize: '1.1rem' }}>{loading ? '—' : fmtUnits(flow.entradas)} uds</span>
          </div>
        </div>
        <div className={`${styles.kpiCard} glass`} style={{ padding: '1rem 1.25rem' }}>
          <ArrowUpFromLine size={18} color="var(--danger)" />
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>Salidas del período</span>
            <span className={styles.kpiValue} style={{ fontSize: '1.1rem' }}>{loading ? '—' : fmtUnits(flow.salidas)} uds</span>
          </div>
        </div>
        <div className={`${styles.kpiCard} glass`} style={{ padding: '1rem 1.25rem' }}>
          <Layers size={18} color="var(--cyan)" />
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>Movimientos registrados</span>
            <span className={styles.kpiValue} style={{ fontSize: '1.1rem' }}>{loading ? '—' : flow.numMovimientos}</span>
          </div>
        </div>
      </div>

      {/* ── Trend Chart ── */}
      <div className={`${styles.chartCard} glass`}>
        <div className={styles.chartHeader}>
          <div>
            <h3 className={styles.chartTitle}>Flujo de Inventario</h3>
            <p className={styles.chartSub}>
              {trendMetric === 'salidas' ? 'Salidas' : 'Entradas'} por {trendGroup === 'dia' ? 'día' : trendGroup === 'semana' ? 'semana' : 'mes'} en el período
            </p>
          </div>
          <div className={styles.groupBtns}>
            <button
              className={`${styles.groupBtn} ${trendMetric === 'salidas' ? styles.groupActive : ''}`}
              onClick={() => setTrendMetric('salidas')}
            >
              Salidas
            </button>
            <button
              className={`${styles.groupBtn} ${trendMetric === 'entradas' ? styles.groupActive : ''}`}
              onClick={() => setTrendMetric('entradas')}
            >
              Entradas
            </button>
            <div className={styles.dateDivider} />
            {(['dia', 'semana', 'mes'] as const).map(tg => (
              <button
                key={tg}
                className={`${styles.groupBtn} ${trendGroup === tg ? styles.groupActive : ''}`}
                onClick={() => setTrendGroup(tg)}
              >
                {tg === 'dia' ? 'Día' : tg === 'semana' ? 'Semana' : 'Mes'}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.chartBody}>
          {loading
            ? <div>Cargando...</div>
            : <LineChart
                data={trendData}
                group={trendGroup}
                formatValue={(n) => `${fmtUnits(n)} uds`}
                formatValueShort={(n) => fmtUnits(Math.round(n))}
                countLabel="movimiento"
                color={trendMetric === 'salidas' ? 'var(--danger)' : 'var(--cyan)'}
              />
          }
        </div>
      </div>

      {/* ── Alertas de bajo stock ── */}
      <div className={`${styles.chartCard} glass`}>
        <div className={styles.chartHeader}>
          <div>
            <h3 className={styles.chartTitle}>
              <AlertTriangle size={16} style={{ verticalAlign: '-2px', marginRight: '0.4rem', color: 'var(--danger)' }} />
              Alertas de Bajo Stock
            </h3>
            <p className={styles.chartSub}>Productos que alcanzaron o cruzaron su stock mínimo</p>
          </div>
        </div>
        <div className={styles.chartBody}>
          {loading ? (
            <div>Cargando...</div>
          ) : (data?.lowStock ?? []).length === 0 ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem', fontSize: '0.9rem' }}>
              Sin alertas: ningún producto está por debajo de su mínimo
            </div>
          ) : (
            <table className={styles.miniTable}>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Categoría</th>
                  <th>Stock</th>
                  <th>Mínimo</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {(data?.lowStock ?? []).map(row => (
                  <tr key={row.IdProducto}>
                    <td style={{ fontWeight: 600 }}>{row.Producto}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{row.Categoria || '—'}</td>
                    <td style={{ fontWeight: 700, color: 'var(--danger)' }}>{row.Stock}</td>
                    <td>{row.StockMinimo}</td>
                    <td>
                      {row.Stock <= 0
                        ? <span className={styles.badgeDanger}>Agotado</span>
                        : <span className={styles.badgeWarn}>Bajo mínimo</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Valor por categoría ── */}
      <div className={`${styles.chartCard} glass`}>
        <div className={styles.chartHeader}>
          <div>
            <h3 className={styles.chartTitle}>Valor de Inventario por Categoría</h3>
            <p className={styles.chartSub}>Dónde está concentrado el capital en stock</p>
          </div>
        </div>
        <div className={styles.chartBody}>
          {loading
            ? <div>Cargando...</div>
            : <BarChart
                data={(data?.byCategory ?? []).map(c => ({ nombre: c.nombre, total: Number(c.total), cantidad: Number(c.cantidad) }))}
                formatValue={formatCurrencyMXN}
              />
          }
        </div>
      </div>

      {/* ── Productos con más salida ── */}
      <div className={`${styles.chartCard} glass`}>
        <div className={styles.chartHeader}>
          <div>
            <h3 className={styles.chartTitle}>Productos con Más Salida</h3>
            <p className={styles.chartSub}>Unidades que salieron del inventario en el período</p>
          </div>
        </div>
        <div className={styles.chartBody}>
          {loading
            ? <div>Cargando...</div>
            : <BarChart
                data={(data?.topMoved ?? []).map(p => ({ nombre: p.nombre, total: Number(p.total), cantidad: Number(p.cantidad), cantidadLabel: 'movs' }))}
                formatValue={(n) => `${fmtUnits(n)} uds`}
                colors={['var(--danger)', 'var(--yellow-deep)', 'var(--pink)', 'var(--purple, #8e4da0)', 'var(--orange, #f47c20)']}
              />
          }
        </div>
      </div>
    </div>
  );
}
