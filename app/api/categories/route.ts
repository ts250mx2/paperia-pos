import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    const [rows] = await pool.query('SELECT * FROM tblCategorias ORDER BY Categoria ASC');
    return NextResponse.json(rows);
  } catch (error) {
    console.error('Categories GET error:', error);
    return NextResponse.json({ message: 'Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { Categoria, EsExtra } = await request.json();

    const [maxRows] = await pool.query('SELECT MAX(IdCategoria) as maxId FROM tblCategorias');
    const nextId = ((maxRows as any[])[0].maxId || 0) + 1;

    await pool.query(
      'INSERT INTO tblCategorias (IdCategoria, Categoria, EsExtra) VALUES (?, ?, ?)',
      [nextId, Categoria, EsExtra ? 1 : 0]
    );

    return NextResponse.json({ success: true, id: nextId });
  } catch (error) {
    console.error('Categories POST error:', error);
    return NextResponse.json({ message: 'Error' }, { status: 500 });
  }
}
