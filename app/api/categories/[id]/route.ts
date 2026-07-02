import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { Categoria, EsExtra } = await request.json();

    await pool.query(
      'UPDATE tblCategorias SET Categoria = ?, EsExtra = ? WHERE IdCategoria = ?',
      [Categoria, EsExtra ? 1 : 0, id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Category PUT error:', error);
    return NextResponse.json({ message: 'Error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await pool.query('DELETE FROM tblCategorias WHERE IdCategoria = ?', [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Category DELETE error:', error);
    return NextResponse.json({ message: 'Error' }, { status: 500 });
  }
}
