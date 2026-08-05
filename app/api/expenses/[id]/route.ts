import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { Concepto, Monto, IdCategoriaGasto, MetodoPago, Proveedor, Fecha, Notas } = body;

    if (!Concepto || typeof Concepto !== 'string' || !Concepto.trim()) {
      return NextResponse.json({ message: 'El concepto es obligatorio' }, { status: 400 });
    }
    const monto = Number(Monto);
    if (!Number.isFinite(monto) || monto <= 0) {
      return NextResponse.json({ message: 'El monto debe ser mayor a cero' }, { status: 400 });
    }

    await pool.query(`
      UPDATE tblGastos
      SET Concepto = ?, Monto = ?, IdCategoriaGasto = ?, MetodoPago = ?,
          Proveedor = ?, Fecha = ?, Notas = ?
      WHERE IdGasto = ?
    `, [
      Concepto.trim(), monto, IdCategoriaGasto || null, MetodoPago || null,
      Proveedor || null, Fecha || new Date(), Notas || null, id,
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Expenses PUT error:', error);
    return NextResponse.json({ message: 'Error al actualizar el gasto' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Borrado lógico: Status = 2 significa eliminado (mismo patrón que tblProductos)
    await pool.query('UPDATE tblGastos SET Status = 2 WHERE IdGasto = ?', [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Expenses DELETE error:', error);
    return NextResponse.json({ message: 'Error al eliminar el gasto' }, { status: 500 });
  }
}
