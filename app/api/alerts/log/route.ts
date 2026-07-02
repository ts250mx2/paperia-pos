import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const { message, idApertura, isRed } = await request.json();
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('auth_session');
    const user = sessionCookie ? JSON.parse(sessionCookie.value) : null;

    if (!user) return NextResponse.json({ message: 'No session' }, { status: 401 });

    const [maxRows] = await pool.query('SELECT MAX(IdAlerta) as maxId FROM tblAlertas');
    const nextId = ((maxRows as any[])[0].maxId || 0) + 1;

    await pool.query(`
      INSERT INTO tblAlertas (IdAlerta, Alerta, IdUsuario, IdApertura, FechaAlerta, Rojo)
      VALUES (?, ?, ?, ?, NOW(), ?)
    `, [nextId, message, user.IdUsuario, idApertura || 0, isRed ? 1 : 0]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Log alert error:', error);
    return NextResponse.json({ message: 'Error' }, { status: 500 });
  }
}
