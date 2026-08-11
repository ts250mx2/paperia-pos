import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { cookies } from 'next/headers';

const TIPOS_VALIDOS = ['entrada', 'salida', 'ajuste'];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const idProducto = searchParams.get('idProducto');
    const dateFrom   = searchParams.get('dateFrom');
    const dateTo     = searchParams.get('dateTo');
    const tipo       = searchParams.get('tipo');

    const where: string[] = ['1=1'];
    const params: string[] = [];
    if (idProducto) { where.push('m.IdProducto = ?'); params.push(idProducto); }
    if (dateFrom && dateTo) {
      where.push('m.Fecha >= ? AND m.Fecha < DATE_ADD(?, INTERVAL 1 DAY)');
      params.push(dateFrom, dateTo);
    }
    if (tipo && TIPOS_VALIDOS.includes(tipo)) { where.push('m.Tipo = ?'); params.push(tipo); }

    const [rows] = await pool.query(`
      SELECT m.IdMovimiento, m.IdProducto, p.Producto, m.Tipo, m.Cantidad, m.CostoUnitario,
             m.Motivo, m.Fecha, m.Referencia, u.Usuario
      FROM tblInventarioMovimientos m
      LEFT JOIN tblProductos p  ON m.IdProducto = p.IdProducto
      LEFT JOIN tblUsuarios u   ON m.IdUsuario = u.IdUsuario
      WHERE ${where.join(' AND ')}
      ORDER BY m.Fecha DESC
      LIMIT 200
    `, params);

    return NextResponse.json(rows);
  } catch (error) {
    console.error('Inventory movements GET error:', error);
    return NextResponse.json({ message: 'Error al obtener los movimientos' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { IdProducto, Tipo, Cantidad, CostoUnitario, Motivo, Direction, Referencia } = body;

    if (!IdProducto) {
      return NextResponse.json({ message: 'Selecciona un producto' }, { status: 400 });
    }
    if (!TIPOS_VALIDOS.includes(Tipo)) {
      return NextResponse.json({ message: 'Tipo de movimiento inválido' }, { status: 400 });
    }
    const cantidadAbs = Number(Cantidad);
    if (!Number.isFinite(cantidadAbs) || cantidadAbs <= 0) {
      return NextResponse.json({ message: 'La cantidad debe ser mayor a cero' }, { status: 400 });
    }

    // Status 2 = eliminado: no se listan en ningún catálogo, así que tampoco
    // deben poder acumular movimientos nuevos de inventario.
    const [productRows] = await pool.query(
      'SELECT IdProducto FROM tblProductos WHERE IdProducto = ? AND Status != 2',
      [IdProducto]
    );
    if ((productRows as any[]).length === 0) {
      return NextResponse.json({ message: 'El producto no existe o fue eliminado' }, { status: 404 });
    }

    // El signo del delta lo decide el tipo de movimiento (salida siempre resta;
    // ajuste puede sumar o restar según la dirección elegida por el usuario).
    let signedCantidad = cantidadAbs;
    if (Tipo === 'salida') signedCantidad = -cantidadAbs;
    else if (Tipo === 'ajuste' && Direction === 'disminuir') signedCantidad = -cantidadAbs;

    const cookieStore    = await cookies();
    const sessionCookie  = cookieStore.get('auth_session');
    const user           = sessionCookie ? JSON.parse(sessionCookie.value) : null;

    const [maxRows] = await pool.query('SELECT MAX(IdMovimiento) as maxId FROM tblInventarioMovimientos');
    const nextId = ((maxRows as any[])[0].maxId || 0) + 1;

    await pool.query(`
      INSERT INTO tblInventarioMovimientos
        (IdMovimiento, IdProducto, Tipo, Cantidad, CostoUnitario, Motivo, Fecha, IdUsuario, Referencia)
      VALUES (?, ?, ?, ?, ?, ?, NOW(), ?, ?)
    `, [nextId, IdProducto, Tipo, signedCantidad, CostoUnitario || null, Motivo || null, user?.IdUsuario || null, Referencia || null]);

    return NextResponse.json({ success: true, id: nextId });
  } catch (error) {
    console.error('Inventory movements POST error:', error);
    return NextResponse.json({ message: 'Error al registrar el movimiento' }, { status: 500 });
  }
}
