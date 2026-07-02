import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    // Current day stats
    const [stats] = await pool.query(`
      SELECT 
        SUM(Total) as total,
        SUM(Efectivo) as efectivo,
        SUM(Tarjeta) as tarjeta,
        SUM(Transferencia) as transferencia,
        COUNT(*) as count
      FROM tblVentas 
      WHERE DATE(FechaVenta) = CURDATE() AND Cancelada = 0
    `);

    // Top products
    const [topProducts] = await pool.query(`
      SELECT p.Producto, SUM(d.Cantidad) as sold
      FROM tblDetalleVentas d
      JOIN tblProductos p ON d.IdProducto = p.IdProducto
      WHERE DATE(d.Fecha) = CURDATE()
      GROUP BY p.IdProducto
      ORDER BY sold DESC
      LIMIT 5
    `);

    // Recent alerts
    const [alerts] = await pool.query(`
      SELECT * FROM tblAlertas ORDER BY FechaAlerta DESC LIMIT 10
    `);

    return NextResponse.json({
      today: (stats as any[])[0],
      topProducts,
      alerts
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
