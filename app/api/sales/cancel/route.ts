import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  let connection;
  try {
    connection = await pool.getConnection();
    const { idVenta, reason } = await request.json();
    const idVentaNum = Number(idVenta);
    console.log('[CANCEL] Starting for IdVenta:', idVentaNum);
    
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('auth_session');
    const user = sessionCookie ? JSON.parse(sessionCookie.value) : null;

    if (!user) return NextResponse.json({ message: 'Sesión no válida' }, { status: 401 });

    // 1. Get Venta info
    const [ventaRows] = await connection.query('SELECT * FROM tblVentas WHERE IdVenta = ?', [idVentaNum]);
    const venta = (ventaRows as any[])[0];

    if (!venta) return NextResponse.json({ message: 'La venta no existe en la base de datos' }, { status: 404 });
    if (venta.Cancelada === 1) return NextResponse.json({ message: 'Esta venta ya ha sido cancelada' }, { status: 400 });

    // 2. Perform cancellation steps with granular error reporting
    try {
      await connection.beginTransaction();

      // Step A: Mark as cancelled
      try {
        await connection.query('UPDATE tblVentas SET Cancelada = 1 WHERE IdVenta = ?', [idVentaNum]);
      } catch (err: any) {
        throw new Error(`Error al marcar venta como cancelada: ${err.message}`);
      }

      // Step B: Update session totals
      try {
        await connection.query(`
          UPDATE tblAperturasCierres 
          SET TotalVentas = IFNULL(TotalVentas, 0) - ?,
              Efectivo = IFNULL(Efectivo, 0) - ?,
              Tarjeta = IFNULL(Tarjeta, 0) - ?,
              Transferencia = IFNULL(Transferencia, 0) - ?,
              Cancelados = IFNULL(Cancelados, 0) + 1
          WHERE IdApertura = ?
        `, [venta.Total, venta.Efectivo || 0, venta.Tarjeta || 0, venta.Transferencia || 0, venta.IdApertura]);
      } catch (err: any) {
        throw new Error(`Error al actualizar totales de caja: ${err.message}`);
      }

      // Step C: Log Alert
      try {
        const [maxAlertRows] = await connection.query('SELECT MAX(IdAlerta) as maxId FROM tblAlertas');
        const nextAlertId = ((maxAlertRows as any[])[0].maxId || 0) + 1;

        await connection.query(`
          INSERT INTO tblAlertas (IdAlerta, Alerta, IdUsuario, IdApertura, FechaAlerta, Rojo)
          VALUES (?, ?, ?, ?, NOW(), 1)
        `, [nextAlertId, `CANCELACION: Folio ${venta.Folio} - Motivo: ${reason}`, user.IdUsuario, venta.IdApertura]);
      } catch (err: any) {
        throw new Error(`Error al registrar alerta de cancelación: ${err.message}`);
      }

      await connection.commit();
      console.log('[CANCEL] Success for Folio:', venta.Folio);
      return NextResponse.json({ success: true });

    } catch (txError: any) {
      await connection.rollback();
      console.error('[CANCEL] Transaction failed:', txError);
      return NextResponse.json({ message: `Fallo en la base de datos: ${txError.message}` }, { status: 500 });
    }

  } catch (error: any) {
    console.error('[CANCEL] Fatal error:', error);
    return NextResponse.json({ message: `Error fatal: ${error.message}` }, { status: 500 });
  } finally {
    if (connection) connection.release();
  }
}
