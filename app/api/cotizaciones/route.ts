import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { cookies } from 'next/headers';

/* ── Listar cotizaciones (para la página de Cotizaciones) ── */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = (searchParams.get('search') || '').trim();

    let where = '';
    const params: any[] = [];
    if (search) {
      where = 'WHERE c.Folio LIKE ? OR c.Cliente LIKE ?';
      params.push(`%${search}%`, `%${search}%`);
    }

    const [rows] = await pool.query(`
      SELECT c.IdCotizacion, c.Folio, c.Fecha, c.Cliente, c.Total, c.Estatus,
             u.Usuario AS UsuarioNombre,
             (SELECT COUNT(*) FROM tblDetalleCotizaciones d WHERE d.IdCotizacion = c.IdCotizacion) AS Articulos
      FROM tblCotizaciones c
      LEFT JOIN tblUsuarios u ON c.IdUsuario = u.IdUsuario
      ${where}
      ORDER BY c.IdCotizacion DESC
      LIMIT 300
    `, params);

    return NextResponse.json(rows);
  } catch (error: any) {
    console.error('GET /api/cotizaciones error:', error);
    return NextResponse.json({ message: 'Error al obtener cotizaciones' }, { status: 500 });
  }
}

/* ── Guardar una cotización a partir del carrito del POS ── */
export async function POST(request: Request) {
  const connection = await pool.getConnection();
  try {
    const { cart, cliente, notas, descuentoGlobal } = await request.json();

    if (!Array.isArray(cart) || cart.length === 0) {
      return NextResponse.json({ message: 'El carrito está vacío.' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('auth_session');
    const user = sessionCookie ? JSON.parse(sessionCookie.value) : null;
    const idUsuario = user?.IdUsuario ?? null;

    // Totales y descuentos calculados en el servidor (no se confía en el cliente)
    let subtotal = 0;             // suma de importes brutos (antes de descuento)
    let descProductos = 0;        // suma de descuentos por línea
    for (const item of cart) {
      const gross = Number(item.price) * Number(item.quantity);
      subtotal += gross;
      descProductos += Math.max(0, Math.min(Number(item.discount) || 0, gross));
    }
    const descGlobal = Math.min(Number(descuentoGlobal) || 0, Math.max(0, subtotal - descProductos));
    const descuento  = descProductos + descGlobal;
    const total      = Math.max(0, subtotal - descuento);

    await connection.beginTransaction();

    // 1. Insertar encabezado
    const [headerRes]: any = await connection.query(
      `INSERT INTO tblCotizaciones (Folio, Fecha, Cliente, IdUsuario, Subtotal, Descuento, Total, Notas, Estatus)
       VALUES (NULL, NOW(), ?, ?, ?, ?, ?, ?, 0)`,
      [cliente || '', idUsuario, subtotal, descuento, total, notas || '']
    );
    const idCotizacion = headerRes.insertId;
    const folio = 'COT-' + String(idCotizacion).padStart(6, '0');
    await connection.query('UPDATE tblCotizaciones SET Folio = ? WHERE IdCotizacion = ?', [folio, idCotizacion]);

    // 2. Insertar renglones. El descuento por línea se guarda por renglón; Importe = bruto.
    for (const item of cart) {
      const cantidad = Number(item.quantity) || 0;
      const precio   = Number(item.price) || 0;
      const grossLine = precio * cantidad;
      const descLinea = Math.max(0, Math.min(Number(item.discount) || 0, grossLine));

      await connection.query(
        `INSERT INTO tblDetalleCotizaciones
           (IdCotizacion, IdProducto, Producto, Cantidad, Precio, Importe, Descuento, TipoPrecio, EsExtra)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [idCotizacion, item.productId, item.name, cantidad, precio, grossLine, descLinea, item.typePrice || 1]
      );
    }

    await connection.commit();
    return NextResponse.json({ success: true, id: idCotizacion, folio });
  } catch (error: any) {
    await connection.rollback();
    console.error('POST /api/cotizaciones error:', error);
    return NextResponse.json({ message: 'Error al guardar la cotización' }, { status: 500 });
  } finally {
    connection.release();
  }
}
