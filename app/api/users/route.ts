import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    const [rows] = await pool.query(
      'SELECT IdUsuario, Usuario, IdPuesto, Login, Status FROM tblUsuarios ORDER BY IdUsuario'
    );
    return NextResponse.json(rows);
  } catch (error) {
    console.error('GET /api/users error:', error);
    return NextResponse.json({ message: 'Error al obtener usuarios' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { Usuario, Login, Password, IdPuesto, Status } = await request.json();
    if (!Usuario || !Login || !Password) {
      return NextResponse.json({ message: 'Usuario, Login y Password son requeridos' }, { status: 400 });
    }

    const [maxRows] = await pool.query('SELECT MAX(IdUsuario) as maxId FROM tblUsuarios');
    const nextId = ((maxRows as any[])[0].maxId || 0) + 1;

    await pool.query(
      'INSERT INTO tblUsuarios (IdUsuario, Usuario, Login, Password, IdPuesto, Status) VALUES (?, ?, ?, ?, ?, ?)',
      [nextId, Usuario, Login, Password, IdPuesto ?? 1, Status ?? 1]
    );

    return NextResponse.json({ success: true, IdUsuario: nextId });
  } catch (error) {
    console.error('POST /api/users error:', error);
    return NextResponse.json({ message: 'Error al crear usuario' }, { status: 500 });
  }
}
