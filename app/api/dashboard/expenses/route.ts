import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

// Suma N días a una fecha 'YYYY-MM-DD' y regresa 'YYYY-MM-DD'.
function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const dateFrom = searchParams.get('dateFrom') || '';
  const dateTo   = searchParams.get('dateTo')   || '';
  const trendGroup = searchParams.get('trendGroup') || 'dia'; // dia | semana | mes

  let from: string;
  let toInclusive: string;
  if (dateFrom && dateTo) {
    from = dateFrom;
    toInclusive = dateTo;
  } else {
    const today = new Date().toISOString().slice(0, 10);
    from = addDays(today, -29);
    toInclusive = today;
  }
  const toExclusive = addDays(toInclusive, 1);

  const where = `g.Status != 2 AND g.Fecha >= ? AND g.Fecha < ?`;
  const rangeParams: string[] = [from, toExclusive];

  try {
    // ── KPI Summary ──────────────────────────────────────────────────────────
    const [kpiRows] = await pool.query(`
      SELECT
        COALESCE(SUM(g.Monto), 0)  AS totalGastos,
        COUNT(g.IdGasto)           AS numGastos,
        COALESCE(AVG(g.Monto), 0)  AS gastoPromedio,
        COALESCE(SUM(CASE WHEN g.MetodoPago = 'Efectivo'      THEN g.Monto ELSE 0 END), 0) AS efectivo,
        COALESCE(SUM(CASE WHEN g.MetodoPago = 'Tarjeta'       THEN g.Monto ELSE 0 END), 0) AS tarjeta,
        COALESCE(SUM(CASE WHEN g.MetodoPago = 'Transferencia' THEN g.Monto ELSE 0 END), 0) AS transferencia
      FROM tblGastos g
      WHERE ${where}
    `, rangeParams);

    // ── Trend (día, semana o mes) ────────────────────────────────────────────
    let selectTrend = `DATE(g.Fecha) AS fecha`;
    let groupTrend  = `DATE(g.Fecha)`;
    if (trendGroup === 'semana') {
      selectTrend = `DATE_SUB(DATE(g.Fecha), INTERVAL WEEKDAY(g.Fecha) DAY) AS fecha`;
      groupTrend  = `DATE_SUB(DATE(g.Fecha), INTERVAL WEEKDAY(g.Fecha) DAY)`;
    } else if (trendGroup === 'mes') {
      selectTrend = `DATE_FORMAT(g.Fecha, '%Y-%m-01') AS fecha`;
      groupTrend  = `DATE_FORMAT(g.Fecha, '%Y-%m-01')`;
    }

    const [trendRows] = await pool.query(`
      SELECT ${selectTrend}, COALESCE(SUM(g.Monto), 0) AS total, COUNT(g.IdGasto) AS cantidad
      FROM tblGastos g
      WHERE ${where}
      GROUP BY ${groupTrend}
      ORDER BY fecha ASC
    `, rangeParams);

    // ── Desglose por categoría ────────────────────────────────────────────────
    const [breakdownRows] = await pool.query(`
      SELECT
        cg.IdCategoriaGasto                       AS id,
        COALESCE(cg.Categoria, 'Sin categoría')   AS nombre,
        COALESCE(SUM(g.Monto), 0)                 AS total,
        COUNT(g.IdGasto)                          AS cantidad
      FROM tblGastos g
      LEFT JOIN tblCategoriasGastos cg ON g.IdCategoriaGasto = cg.IdCategoriaGasto
      WHERE ${where}
      GROUP BY cg.IdCategoriaGasto, cg.Categoria
      ORDER BY total DESC
      LIMIT 10
    `, rangeParams);

    // ── Top proveedores ─────────────────────────────────────────────────────
    const [proveedorRows] = await pool.query(`
      SELECT
        COALESCE(NULLIF(g.Proveedor, ''), 'Sin proveedor') AS nombre,
        COALESCE(SUM(g.Monto), 0)                          AS total,
        COUNT(g.IdGasto)                                   AS cantidad
      FROM tblGastos g
      WHERE ${where}
      GROUP BY COALESCE(NULLIF(g.Proveedor, ''), 'Sin proveedor')
      ORDER BY total DESC
      LIMIT 10
    `, rangeParams);

    return NextResponse.json({
      kpi: (kpiRows as any[])[0],
      trend: trendRows,
      breakdown: breakdownRows,
      proveedores: proveedorRows,
    });
  } catch (error: any) {
    console.error('Dashboard expenses error:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
