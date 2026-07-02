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
  const period   = searchParams.get('period')   || 'today'; // today | yesterday | week | month
  const groupBy  = searchParams.get('groupBy')  || 'categoria'; // categoria | producto
  const dateFrom = searchParams.get('dateFrom') || ''; // YYYY-MM-DD
  const dateTo   = searchParams.get('dateTo')   || ''; // YYYY-MM-DD
  const trendGroup = searchParams.get('trendGroup') || 'dia'; // dia | semana | mes

  // ── Resolver el rango a fechas concretas [from, toInclusive] ───────────────
  // Nota: en BDPaperia IdVenta NO es único (es folio por apertura); la clave real
  // es (IdVenta, IdApertura). Además los filtros se hacen "sargables" (rango sobre
  // la columna cruda, no DATE(col)) para aprovechar los índices.
  let from: string;
  let toInclusive: string;

  if (dateFrom && dateTo) {
    from = dateFrom;
    toInclusive = dateTo;
  } else {
    const today = new Date().toISOString().slice(0, 10);
    switch (period) {
      case 'yesterday': from = addDays(today, -1); toInclusive = addDays(today, -1); break;
      case 'week':      from = addDays(today, -6); toInclusive = today; break;
      case 'month':     from = addDays(today, -29); toInclusive = today; break;
      case 'today':
      default:          from = today; toInclusive = today; break;
    }
  }
  const toExclusive = addDays(toInclusive, 1); // límite superior exclusivo

  // Filtro sobre tblVentas (fecha del ticket) y sobre tblDetalleVentas (fecha del renglón)
  const vWhere = `v.FechaVenta >= ? AND v.FechaVenta < ?`;
  const dWhere = `d.Fecha >= ? AND d.Fecha < ?`;
  const rangeParams: string[] = [from, toExclusive];

  try {
    // ── KPI Summary ──────────────────────────────────────────────────────────
    const [kpiRows] = await pool.query(`
      SELECT
        COALESCE(SUM(v.Total), 0)       AS totalVentas,
        COUNT(v.IdVenta)                AS numTransacciones,
        COALESCE(AVG(v.Total), 0)       AS ticketPromedio,
        COALESCE(SUM(v.Efectivo), 0)    AS efectivo,
        COALESCE(SUM(v.Tarjeta), 0)     AS tarjeta,
        COALESCE(SUM(v.Transferencia),0) AS transferencia,
        COALESCE(SUM(v.Cancelada), 0)   AS canceladas
      FROM tblVentas v
      WHERE ${vWhere} AND v.Cancelada = 0
    `, rangeParams);

    // ── Sales Trend (Day, Week, or Month) ────────────────────────────────────
    let selectTrend = `DATE(v.FechaVenta) AS fecha`;
    let groupTrend  = `DATE(v.FechaVenta)`;

    if (trendGroup === 'semana') {
      selectTrend = `DATE_SUB(DATE(v.FechaVenta), INTERVAL WEEKDAY(v.FechaVenta) DAY) AS fecha`;
      groupTrend  = `DATE_SUB(DATE(v.FechaVenta), INTERVAL WEEKDAY(v.FechaVenta) DAY)`;
    } else if (trendGroup === 'mes') {
      selectTrend = `DATE_FORMAT(v.FechaVenta, '%Y-%m-01') AS fecha`;
      groupTrend  = `DATE_FORMAT(v.FechaVenta, '%Y-%m-01')`;
    }

    const [trendRows] = await pool.query(`
      SELECT
        ${selectTrend},
        COALESCE(SUM(v.Total), 0)       AS total,
        COUNT(v.IdVenta)                AS transacciones
      FROM tblVentas v
      WHERE ${vWhere} AND v.Cancelada = 0
      GROUP BY ${groupTrend}
      ORDER BY fecha ASC
    `, rangeParams);

    // ── Breakdown by Category or Product ─────────────────────────────────────
    // Se une por la clave compuesta (IdVenta, IdApertura) para evitar el fan-out
    // que produciría unir solo por IdVenta (no único en BDPaperia).
    let breakdownRows: any[] = [];
    if (groupBy === 'categoria') {
      const [rows] = await pool.query(`
        SELECT
          c.IdCategoria                           AS id,
          COALESCE(c.Categoria, 'Sin Categoría') AS nombre,
          COALESCE(SUM(d.Cantidad * d.Precio), 0) AS total,
          COALESCE(SUM(d.Cantidad), 0)            AS cantidad
        FROM tblDetalleVentas d
        JOIN tblVentas v ON d.IdVenta = v.IdVenta AND d.IdApertura = v.IdApertura
        LEFT JOIN tblProductos p ON d.IdProducto = p.IdProducto
        LEFT JOIN tblCategorias c ON p.IdCategoria = c.IdCategoria
        WHERE ${dWhere} AND v.Cancelada = 0
        GROUP BY c.IdCategoria, c.Categoria
        ORDER BY total DESC
        LIMIT 10
      `, rangeParams);
      breakdownRows = rows as any[];
    } else {
      const [rows] = await pool.query(`
        SELECT
          COALESCE(p.Producto, 'Sin Producto') AS nombre,
          COALESCE(SUM(d.Cantidad * d.Precio), 0) AS total,
          COALESCE(SUM(d.Cantidad), 0)            AS cantidad
        FROM tblDetalleVentas d
        JOIN tblVentas v ON d.IdVenta = v.IdVenta AND d.IdApertura = v.IdApertura
        LEFT JOIN tblProductos p ON d.IdProducto = p.IdProducto
        WHERE ${dWhere} AND v.Cancelada = 0
        GROUP BY d.IdProducto, p.Producto
        ORDER BY total DESC
        LIMIT 10
      `, rangeParams);
      breakdownRows = rows as any[];
    }

    // ── Hourly Heatmap (hour 0–23, days of week 0–6) ────────────────────────
    const [heatmapRows] = await pool.query(`
      SELECT
        (DAYOFWEEK(v.FechaVenta) - 1)  AS diaSemana,
        HOUR(v.FechaVenta)             AS hora,
        COALESCE(SUM(v.Total), 0)      AS total,
        COUNT(v.IdVenta)               AS transacciones
      FROM tblVentas v
      WHERE ${vWhere} AND v.Cancelada = 0
      GROUP BY (DAYOFWEEK(v.FechaVenta) - 1), HOUR(v.FechaVenta)
      ORDER BY (DAYOFWEEK(v.FechaVenta) - 1), HOUR(v.FechaVenta)
    `, rangeParams);

    return NextResponse.json({
      kpi: (kpiRows as any[])[0],
      trend: trendRows,
      breakdown: breakdownRows,
      heatmap: heatmapRows,
    });
  } catch (error: any) {
    console.error('Dashboard sales error:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
