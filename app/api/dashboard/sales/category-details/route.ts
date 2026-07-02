import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const categoryId = searchParams.get('id');
  const dateFrom = searchParams.get('dateFrom') || '';
  const dateTo   = searchParams.get('dateTo')   || '';

  // Rango sargable sobre d.Fecha (usa idx_dv_fecha). En BDPaperia la clave real
  // de una venta es (IdVenta, IdApertura), así que se une por ambas columnas.
  const today = new Date().toISOString().slice(0, 10);
  const from = dateFrom || today;
  const toExclusive = addDays(dateTo || today, 1);
  const rangeParams = [from, toExclusive];

  try {
    const catFilter = (categoryId && categoryId !== 'null' && categoryId !== 'undefined')
      ? 'p.IdCategoria = ?'
      : 'p.IdCategoria IS NULL';
    const catParams = (categoryId && categoryId !== 'null' && categoryId !== 'undefined')
      ? [Number(categoryId)]
      : [];

    const query = `
      SELECT
        p.IdProducto AS id,
        p.Producto AS nombre,
        COALESCE(SUM(d.Cantidad * d.Precio), 0) AS total,
        COALESCE(SUM(d.Cantidad), 0)            AS cantidad
      FROM tblDetalleVentas d
      JOIN tblVentas v ON d.IdVenta = v.IdVenta AND d.IdApertura = v.IdApertura
      LEFT JOIN tblProductos p ON d.IdProducto = p.IdProducto
      WHERE ${catFilter} AND d.Fecha >= ? AND d.Fecha < ? AND v.Cancelada = 0
      GROUP BY p.IdProducto, p.Producto
      ORDER BY total DESC
    `;
    const params = [...catParams, ...rangeParams];

    const [rows] = await pool.query(query, params);
    return NextResponse.json({ products: rows });
  } catch (error: any) {
    console.error('Error fetching category details:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
