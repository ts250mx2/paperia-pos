import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body   = await request.json();
    const { Producto, Precio1, Precio2, Precio3, Multiple, IdCategoria, Status, ArchivoImagen } = body;

    await pool.query(`
      UPDATE tblProductos
      SET Producto = ?, Precio1 = ?, Precio2 = ?, Precio3 = ?,
          Multiple = ?, IdCategoria = ?, Status = ?,
          ArchivoImagen = ?, FechaAct = NOW()
      WHERE IdProducto = ?
    `, [Producto, Precio1, Precio2 || 0, Precio3 || 0, Multiple, IdCategoria, Status,
        ArchivoImagen !== undefined ? ArchivoImagen : null, id]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update product error:', error);
    return NextResponse.json({ message: 'Error updating product' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Logical delete: Status = 2 means deleted
    await pool.query('UPDATE tblProductos SET Status = 2 WHERE IdProducto = ?', [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete product error:', error);
    return NextResponse.json({ message: 'Error deleting product' }, { status: 500 });
  }
}
