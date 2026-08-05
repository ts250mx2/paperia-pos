import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    const [rows] = await pool.query(
      'SELECT IdCategoriaGasto, Categoria FROM tblCategoriasGastos WHERE Status != 2 ORDER BY Categoria ASC'
    );
    return NextResponse.json(rows);
  } catch (error) {
    console.error('Expense categories GET error:', error);
    return NextResponse.json({ message: 'Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { Categoria } = await request.json();
    if (!Categoria || typeof Categoria !== 'string' || !Categoria.trim()) {
      return NextResponse.json({ message: 'El nombre de la categoría es obligatorio' }, { status: 400 });
    }

    const [maxRows] = await pool.query('SELECT MAX(IdCategoriaGasto) as maxId FROM tblCategoriasGastos');
    const nextId = ((maxRows as any[])[0].maxId || 0) + 1;

    await pool.query(
      'INSERT INTO tblCategoriasGastos (IdCategoriaGasto, Categoria, Status) VALUES (?, ?, 0)',
      [nextId, Categoria.trim()]
    );

    return NextResponse.json({ success: true, id: nextId });
  } catch (error) {
    console.error('Expense categories POST error:', error);
    return NextResponse.json({ message: 'Error al crear la categoría' }, { status: 500 });
  }
}
