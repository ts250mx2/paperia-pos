import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { Usuario, Login, Password, IdPuesto, Status } = await request.json();

    if (!Usuario || !Login) {
      return NextResponse.json({ message: 'Usuario y Login son requeridos' }, { status: 400 });
    }

    if (Password) {
      await pool.query(
        'UPDATE tblUsuarios SET Usuario=?, Login=?, Password=?, IdPuesto=?, Status=? WHERE IdUsuario=?',
        [Usuario, Login, Password, IdPuesto ?? 1, Status ?? 1, id]
      );
    } else {
      await pool.query(
        'UPDATE tblUsuarios SET Usuario=?, Login=?, IdPuesto=?, Status=? WHERE IdUsuario=?',
        [Usuario, Login, IdPuesto ?? 1, Status ?? 1, id]
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PUT /api/users error:', error);
    return NextResponse.json({ message: 'Error al actualizar usuario' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await pool.query('DELETE FROM tblUsuarios WHERE IdUsuario=?', [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/users error:', error);
    return NextResponse.json({ message: 'Error al eliminar usuario' }, { status: 500 });
  }
}
