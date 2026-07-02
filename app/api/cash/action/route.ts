import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, amount, supervisorId, id, totals } = body;
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('auth_session');
    const user = sessionCookie ? JSON.parse(sessionCookie.value) : null;

    if (!user) {
      return NextResponse.json({ message: 'No session' }, { status: 401 });
    }

    if (action === 'open') {
      // Get next IdApertura
      const [maxRows] = await pool.query('SELECT MAX(IdApertura) as maxId FROM tblAperturasCierres');
      const nextId = ((maxRows as any[])[0].maxId || 0) + 1;

      await pool.query(`
        INSERT INTO tblAperturasCierres 
        (IdApertura, FechaApertura, IdCajero, FondoCaja, IdComputadora, IdSupervisorCierre) 
        VALUES (?, NOW(), ?, ?, 1, 0)
      `, [nextId, user.IdUsuario, amount]);

      return NextResponse.json({ success: true, id: nextId });
    }

    if (action === 'close') {
      
      await pool.query(`
        UPDATE tblAperturasCierres 
        SET FechaCierre = NOW(),
            IdSupervisorCierre = ?,
            Efectivo = ?,
            Tarjeta = ?,
            TotalVentas = ?,
            Descuentos = ?,
            Cancelados = ?
        WHERE IdApertura = ?
      `, [
        supervisorId || user.IdUsuario, 
        totals.efectivo, 
        totals.tarjeta, 
        totals.total, 
        totals.descuentos, 
        totals.cancelados,
        id
      ]);

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ message: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Cash action error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
