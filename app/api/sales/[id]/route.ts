import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const [ventaRows] = await pool.query('SELECT * FROM tblVentas WHERE IdVenta = ?', [id]);
    const venta = (ventaRows as any[])[0];

    if (!venta) {
      return NextResponse.json({ message: 'Venta no encontrada' }, { status: 404 });
    }

    const [details] = await pool.query(`
      SELECT d.*, p.Producto, d.esExtra, p.Precio2, p.Precio3, d.IdDetallePadre
      FROM tblDetalleVentas d
      JOIN tblProductos p ON d.IdProducto = p.IdProducto
      WHERE d.IdVenta = ?
    `, [id]);

    return NextResponse.json({
      venta,
      details
    });
  } catch (error) {
    console.error('Error fetching ticket data:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
