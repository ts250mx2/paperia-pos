import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const { idVenta, folio } = await request.json();
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('auth_session');
    const user = sessionCookie ? JSON.parse(sessionCookie.value) : null;

    if (!user) {
      return NextResponse.json({ message: 'No session' }, { status: 401 });
    }

    // Get next IdAlerta
    const [maxAlertRows] = await pool.query('SELECT MAX(IdAlerta) as maxId FROM tblAlertas');
    const nextAlertId = ((maxAlertRows as any[])[0].maxId || 0) + 1;

    // Get current IdApertura from Venta
    const [ventaRows] = await pool.query('SELECT IdApertura FROM tblVentas WHERE IdVenta = ?', [idVenta]);
    const idApertura = (ventaRows as any[])[0]?.IdApertura || 0;

    await pool.query(`
      INSERT INTO tblAlertas (IdAlerta, Alerta, IdUsuario, IdApertura, FechaAlerta, Rojo)
      VALUES (?, ?, ?, ?, NOW(), 0)
    `, [
      nextAlertId, 
      `REIMPRESION: Folio ${folio}`, 
      user.IdUsuario, 
      idApertura
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Reprint alert error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
