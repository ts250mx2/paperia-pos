import { NextResponse } from 'next/server';
import pool from '@/lib/db';

/* ── Obtener una cotización con su detalle (para el PDF) ── */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const [headerRows] = await pool.query(`
      SELECT c.*, u.Usuario AS UsuarioNombre
      FROM tblCotizaciones c
      LEFT JOIN tblUsuarios u ON c.IdUsuario = u.IdUsuario
      WHERE c.IdCotizacion = ?
    `, [id]);

    const cotizacion = (headerRows as any[])[0];
    if (!cotizacion) {
      return NextResponse.json({ message: 'Cotización no encontrada' }, { status: 404 });
    }

    const [details] = await pool.query(`
      SELECT IdDetalle, IdProducto, Producto, Cantidad, Precio, Importe, Descuento, TipoPrecio, EsExtra
      FROM tblDetalleCotizaciones
      WHERE IdCotizacion = ?
      ORDER BY IdDetalle ASC
    `, [id]);

    return NextResponse.json({ cotizacion, details });
  } catch (error: any) {
    console.error('GET /api/cotizaciones/[id] error:', error);
    return NextResponse.json({ message: 'Error al obtener la cotización' }, { status: 500 });
  }
}
