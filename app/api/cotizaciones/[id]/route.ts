import { NextResponse } from 'next/server';
import pool from '@/lib/db';

/* ── Obtener una cotización con su detalle (para el PDF / edición) ── */
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

/* ── Editar una cotización (reemplaza encabezado + renglones) ── */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const connection = await pool.getConnection();
  try {
    const { id } = await params;
    const { cliente, notas, descuentoGlobal, lines } = await request.json();

    if (!Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json({ message: 'La cotización debe tener al menos un producto.' }, { status: 400 });
    }

    // Verificar que exista
    const [exists] = await connection.query('SELECT IdCotizacion FROM tblCotizaciones WHERE IdCotizacion = ?', [id]);
    if ((exists as any[]).length === 0) {
      return NextResponse.json({ message: 'Cotización no encontrada' }, { status: 404 });
    }

    // Totales calculados en el servidor
    let subtotal = 0;
    let descProductos = 0;
    for (const l of lines) {
      const gross = (Number(l.precio) || 0) * (Number(l.cantidad) || 0);
      subtotal += gross;
      descProductos += Math.max(0, Math.min(Number(l.descuento) || 0, gross));
    }
    const descGlobal = Math.min(Number(descuentoGlobal) || 0, Math.max(0, subtotal - descProductos));
    const descuento  = descProductos + descGlobal;
    const total      = Math.max(0, subtotal - descuento);

    await connection.beginTransaction();

    await connection.query(
      `UPDATE tblCotizaciones
         SET Cliente = ?, Notas = ?, Subtotal = ?, Descuento = ?, Total = ?
       WHERE IdCotizacion = ?`,
      [cliente || '', notas || '', subtotal, descuento, total, id]
    );

    await connection.query('DELETE FROM tblDetalleCotizaciones WHERE IdCotizacion = ?', [id]);

    for (const l of lines) {
      const cantidad = Number(l.cantidad) || 0;
      const precio   = Number(l.precio) || 0;
      const gross    = precio * cantidad;
      const descLinea = Math.max(0, Math.min(Number(l.descuento) || 0, gross));
      await connection.query(
        `INSERT INTO tblDetalleCotizaciones
           (IdCotizacion, IdProducto, Producto, Cantidad, Precio, Importe, Descuento, TipoPrecio, EsExtra)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [id, l.idProducto || null, l.producto || '', cantidad, precio, gross, descLinea, l.tipoPrecio || 1]
      );
    }

    await connection.commit();
    return NextResponse.json({ success: true, id: Number(id) });
  } catch (error: any) {
    await connection.rollback();
    console.error('PUT /api/cotizaciones/[id] error:', error);
    return NextResponse.json({ message: 'Error al actualizar la cotización' }, { status: 500 });
  } finally {
    connection.release();
  }
}
