import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { StockMinimo } = await request.json();
    const value = Number(StockMinimo);
    if (!Number.isFinite(value) || value < 0) {
      return NextResponse.json({ message: 'El stock mínimo debe ser un número igual o mayor a cero' }, { status: 400 });
    }
    await pool.query('UPDATE tblProductos SET StockMinimo = ? WHERE IdProducto = ?', [value, id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Inventory StockMinimo PUT error:', error);
    return NextResponse.json({ message: 'Error al actualizar el stock mínimo' }, { status: 500 });
  }
}
