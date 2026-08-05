'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Wallet, TrendingDown, Receipt, Banknote, CreditCard, Smartphone,
  Calendar, Layers, Truck,
} from 'lucide-react';
import styles from '../../shared-dashboard.module.css';
import { LineChart } from '@/components/charts/LineChart';
import { BarChart } from '@/components/charts/BarChart';
import { type Period, datesForPeriod } from '@/lib/dateRange';
import { formatCurrencyMXN, formatCurrencyShort } from '@/lib/format';

interface KPI {
  totalGastos: number;
  numGastos: number;
  gastoPromedio: number;
  efectivo: number;
  tarjeta: number;
  transferencia: number;
}

interface DashboardData {
  kpi: KPI;
  trend: { fecha: string; total: number; cantidad: number }[];
  breakdown: { id: number | null; nombre: string; total: number; cantidad: number }[];
  proveedores: { nombre: string; total: number; cantidad: number }[];
}

export default function ExpensesDashboardPage() {
  const [trendGroup, setTrendGroup] = useState<'dia' | 'semana' | 'mes'>('dia');
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
      const res = await fetch(`/api/dashboard/expenses?${params}`);
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
    totalGastos: 0, numGastos: 0, gastoPromedio: 0, efectivo: 0, tarjeta: 0, transferencia: 0,
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleGroup}>
          <TrendingDown size={32} color="var(--danger)" />
          <div>
            <h1>Dashboard de Gastos</h1>
            <p className={styles.subtitle}>Análisis de egresos del negocio — {activeLabel}</p>
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

      {/* ── KPI Cards ── */}
      <div className={styles.kpiGrid}>
        <div className={`${styles.kpiCard} glass ${styles.kpiMain}`}>
          <div className={styles.kpiIcon} style={{ background: 'rgba(245,101,101,0.10)', color: 'var(--danger)' }}>
            <Wallet size={22} />
          </div>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>Gastos Totales</span>
            <span className={styles.kpiValue}>{loading ? '—' : formatCurrencyMXN(kpi.totalGastos)}</span>
            <span className={styles.kpiSub}>{activeLabel}</span>
          </div>
        </div>

        <div className={`${styles.kpiCard} glass`}>
          <div className={styles.kpiIcon} style={{ background: 'rgba(93,224,230,0.12)', color: 'var(--cyan)' }}>
            <Receipt size={22} />
          </div>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>Núm. de Gastos</span>
            <span className={styles.kpiValue}>{loading ? '—' : kpi.numGastos}</span>
            <span className={styles.kpiSub}>registros en el período</span>
          </div>
        </div>

        <div className={`${styles.kpiCard} glass`}>
          <div className={styles.kpiIcon} style={{ background: 'rgba(253,216,53,0.12)', color: 'var(--yellow-deep)' }}>
            <TrendingDown size={22} />
          </div>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>Gasto Promedio</span>
            <span className={styles.kpiValue}>{loading ? '—' : formatCurrencyMXN(kpi.gastoPromedio)}</span>
            <span className={styles.kpiSub}>por registro</span>
          </div>
        </div>

        <div className={`${styles.kpiCard} glass`}>
          <div className={styles.kpiIcon} style={{ background: 'rgba(142,77,160,0.12)', color: 'var(--purple, #8e4da0)' }}>
            <Layers size={22} />
          </div>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>Categoría Principal</span>
            <span className={styles.kpiValue} style={{ fontSize: '1.1rem' }}>
              {loading ? '—' : (data?.breakdown?.[0]?.nombre ?? '—')}
            </span>
            <span className={styles.kpiSub}>
              {loading || !data?.breakdown?.[0] ? '' : formatCurrencyMXN(data.breakdown[0].total)}
            </span>
          </div>
        </div>
      </div>

      {/* ── Payment breakdown mini cards ── */}
      <div className={styles.kpiGrid} style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '1.75rem' }}>
        <div className={`${styles.kpiCard} glass`} style={{ padding: '1rem 1.25rem' }}>
          <Banknote size={18} color="var(--secondary)" />
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>Efectivo</span>
            <span className={styles.kpiValue} style={{ fontSize: '1.1rem' }}>{loading ? '—' : formatCurrencyMXN(kpi.efectivo)}</span>
          </div>
        </div>
        <div className={`${styles.kpiCard} glass`} style={{ padding: '1rem 1.25rem' }}>
          <CreditCard size={18} color="var(--pink)" />
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>Tarjeta</span>
            <span className={styles.kpiValue} style={{ fontSize: '1.1rem' }}>{loading ? '—' : formatCurrencyMXN(kpi.tarjeta)}</span>
          </div>
        </div>
        <div className={`${styles.kpiCard} glass`} style={{ padding: '1rem 1.25rem' }}>
          <Smartphone size={18} color="var(--yellow-deep)" />
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>Transferencia</span>
            <span className={styles.kpiValue} style={{ fontSize: '1.1rem' }}>{loading ? '—' : formatCurrencyMXN(kpi.transferencia)}</span>
          </div>
        </div>
      </div>

      {/* ── Trend Chart ── */}
      <div className={`${styles.chartCard} glass`}>
        <div className={styles.chartHeader}>
          <div>
            <h3 className={styles.chartTitle}>Tendencia de Gastos</h3>
            <p className={styles.chartSub}>
              Gastos por {trendGroup === 'dia' ? 'día' : trendGroup === 'semana' ? 'semana' : 'mes'} en el período seleccionado
            </p>
          </div>
          <div className={styles.groupBtns}>
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
                data={(data?.trend ?? []).map(r => ({ fecha: r.fecha?.split('T')[0] ?? r.fecha, total: Number(r.total), count: r.cantidad }))}
                group={trendGroup}
                formatValue={formatCurrencyMXN}
                formatValueShort={formatCurrencyShort}
                countLabel="gasto"
                color="var(--danger)"
              />
          }
        </div>
      </div>

      {/* ── Breakdown by category ── */}
      <div className={`${styles.chartCard} glass`}>
        <div className={styles.chartHeader}>
          <div>
            <h3 className={styles.chartTitle}>Gastos por Categoría</h3>
            <p className={styles.chartSub}>Desglose del período seleccionado</p>
          </div>
        </div>
        <div className={styles.chartBody}>
          {loading
            ? <div>Cargando...</div>
            : <BarChart
                data={(data?.breakdown ?? []).map(b => ({ ...b, cantidadLabel: 'gastos' }))}
                formatValue={formatCurrencyMXN}
              />
          }
        </div>
      </div>

      {/* ── Top proveedores ── */}
      <div className={`${styles.chartCard} glass`}>
        <div className={styles.chartHeader}>
          <div>
            <h3 className={styles.chartTitle}><Truck size={16} style={{ verticalAlign: '-2px', marginRight: '0.4rem' }} />Top Proveedores</h3>
            <p className={styles.chartSub}>A quién se le ha pagado más en el período</p>
          </div>
        </div>
        <div className={styles.chartBody}>
          {loading
            ? <div>Cargando...</div>
            : <BarChart
                data={(data?.proveedores ?? []).map(p => ({ nombre: p.nombre, total: p.total, cantidad: p.cantidad, cantidadLabel: 'gastos' }))}
                formatValue={formatCurrencyMXN}
                colors={['var(--cyan)', 'var(--pink)', 'var(--yellow)', 'var(--cyan-deep)', 'var(--pink-deep)']}
              />
          }
        </div>
      </div>
    </div>
  );
}
