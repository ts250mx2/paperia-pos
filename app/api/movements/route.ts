import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const { amount, concept, type, idApertura } = await request.json();
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('auth_session');
    const user = sessionCookie ? JSON.parse(sessionCookie.value) : null;

    if (!user) {
      return NextResponse.json({ message: 'No session' }, { status: 401 });
    }

    // Get next IdRetiro
    const [maxRows] = await pool.query('SELECT MAX(IdRetiro) as maxId FROM tblRetiros');
    const nextId = ((maxRows as any[])[0].maxId || 0) + 1;

    // Use negative for salidas, positive for entradas?
    // Usually tblRetiros stores magnitude and we distinguish by concept or type.
    // I'll store it as is and use concept to prefix with [ENTRADA] or [SALIDA]

    await pool.query(`
      INSERT INTO tblRetiros 
      (IdRetiro, IdComputadora, IdApertura, Efectivo, Concepto, Fecha, IdSupervisor)
      VALUES (?, 1, ?, ?, ?, NOW(), ?)
    `, [nextId, idApertura, type === 'salida' ? -amount : amount, concept, user.IdUsuario]);

    return NextResponse.json({ success: true, id: nextId });
  } catch (error) {
    console.error('Movement error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const idApertura = searchParams.get('idApertura');

    const [rows] = await pool.query(`
      SELECT *, Fecha AS FechaRetiro FROM tblRetiros
      WHERE IdApertura = ?
      ORDER BY Fecha DESC
    `, [idApertura]);

    return NextResponse.json(rows);
  } catch (error) {
    console.error('Fetch movements error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
