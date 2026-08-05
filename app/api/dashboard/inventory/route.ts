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
  const trendGroup = searchParams.get('trendGroup') || 'dia';

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
  const rangeParams: string[] = [from, toExclusive];

  try {
    // ── KPI global de inventario (estado actual, no depende del rango) ───────
    const [kpiRows] = await pool.query(`
      SELECT
        COUNT(*)                                          AS skusConStock,
        COALESCE(SUM(t.Stock), 0)                         AS unidadesTotales,
        COALESCE(SUM(t.Stock * COALESCE(t.Costo, 0)), 0)  AS valorInventario,
        COALESCE(SUM(CASE WHEN t.StockMinimo > 0 AND t.Stock <= t.StockMinimo THEN 1 ELSE 0 END), 0) AS productosBajoStock,
        COALESCE(SUM(CASE WHEN t.Stock < 0 THEN 1 ELSE 0 END), 0) AS productosNegativos
      FROM (
        SELECT p.IdProducto, p.Costo, p.StockMinimo, COALESCE(SUM(m.Cantidad), 0) AS Stock
        FROM tblProductos p
        JOIN tblInventarioMovimientos m ON m.IdProducto = p.IdProducto
        WHERE p.Status != 2
        GROUP BY p.IdProducto, p.Costo, p.StockMinimo
      ) t
    `);

    // ── Flujo del período: entradas vs salidas ───────────────────────────────
    const [flowRows] = await pool.query(`
      SELECT
        COALESCE(SUM(CASE WHEN m.Cantidad > 0 THEN m.Cantidad ELSE 0 END), 0)   AS entradas,
        COALESCE(SUM(CASE WHEN m.Cantidad < 0 THEN -m.Cantidad ELSE 0 END), 0)  AS salidas,
        COUNT(*)                                                                AS numMovimientos
      FROM tblInventarioMovimientos m
      WHERE m.Fecha >= ? AND m.Fecha < ?
    `, rangeParams);

    // ── Tendencia de movimientos ─────────────────────────────────────────────
    let selectTrend = `DATE(m.Fecha) AS fecha`;
    let groupTrend  = `DATE(m.Fecha)`;
    if (trendGroup === 'semana') {
      selectTrend = `DATE_SUB(DATE(m.Fecha), INTERVAL WEEKDAY(m.Fecha) DAY) AS fecha`;
      groupTrend  = `DATE_SUB(DATE(m.Fecha), INTERVAL WEEKDAY(m.Fecha) DAY)`;
    } else if (trendGroup === 'mes') {
      selectTrend = `DATE_FORMAT(m.Fecha, '%Y-%m-01') AS fecha`;
      groupTrend  = `DATE_FORMAT(m.Fecha, '%Y-%m-01')`;
    }

    const [trendRows] = await pool.query(`
      SELECT ${selectTrend},
             COALESCE(SUM(CASE WHEN m.Cantidad > 0 THEN m.Cantidad ELSE 0 END), 0)  AS entradas,
             COALESCE(SUM(CASE WHEN m.Cantidad < 0 THEN -m.Cantidad ELSE 0 END), 0) AS salidas,
             COUNT(*) AS cantidad
      FROM tblInventarioMovimientos m
      WHERE m.Fecha >= ? AND m.Fecha < ?
      GROUP BY ${groupTrend}
      ORDER BY fecha ASC
    `, rangeParams);

    // ── Alertas de bajo stock (estado actual) ───────────────────────────────
    const [lowStockRows] = await pool.query(`
      SELECT p.IdProducto, p.Producto, c.Categoria, p.StockMinimo,
             COALESCE(SUM(m.Cantidad), 0) AS Stock
      FROM tblProductos p
      LEFT JOIN tblCategorias c ON p.IdCategoria = c.IdCategoria
      JOIN tblInventarioMovimientos m ON m.IdProducto = p.IdProducto
      WHERE p.Status != 2 AND p.StockMinimo > 0
      GROUP BY p.IdProducto, p.Producto, c.Categoria, p.StockMinimo
      HAVING Stock <= p.StockMinimo
      ORDER BY (Stock - p.StockMinimo) ASC
      LIMIT 15
    `);

    // ── Valor de inventario por categoría ───────────────────────────────────
    const [byCategoryRows] = await pool.query(`
      SELECT COALESCE(t.Categoria, 'Sin categoría') AS nombre,
             COALESCE(SUM(t.Stock * COALESCE(t.Costo, 0)), 0) AS total,
             COALESCE(SUM(t.Stock), 0) AS cantidad
      FROM (
        SELECT p.IdProducto, p.Costo, c.Categoria, COALESCE(SUM(m.Cantidad), 0) AS Stock
        FROM tblProductos p
        LEFT JOIN tblCategorias c ON p.IdCategoria = c.IdCategoria
        JOIN tblInventarioMovimientos m ON m.IdProducto = p.IdProducto
        WHERE p.Status != 2
        GROUP BY p.IdProducto, p.Costo, c.Categoria
      ) t
      GROUP BY t.Categoria
      ORDER BY total DESC
      LIMIT 10
    `);

    // ── Productos con más movimiento (salidas) en el período ────────────────
    const [topMovedRows] = await pool.query(`
      SELECT COALESCE(p.Producto, 'Producto eliminado') AS nombre,
             COALESCE(SUM(-m.Cantidad), 0) AS total,
             COUNT(*) AS cantidad
      FROM tblInventarioMovimientos m
      LEFT JOIN tblProductos p ON m.IdProducto = p.IdProducto
      WHERE m.Fecha >= ? AND m.Fecha < ? AND m.Cantidad < 0
      GROUP BY m.IdProducto, p.Producto
      ORDER BY total DESC
      LIMIT 10
    `, rangeParams);

    return NextResponse.json({
      kpi: (kpiRows as any[])[0],
      flow: (flowRows as any[])[0],
      trend: trendRows,
      lowStock: lowStockRows,
      byCategory: byCategoryRows,
      topMoved: topMovedRows,
    });
  } catch (error: any) {
    console.error('Dashboard inventory error:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
