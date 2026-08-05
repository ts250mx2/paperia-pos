import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get('dateFrom'); // YYYY-MM-DD
    const dateTo   = searchParams.get('dateTo');   // YYYY-MM-DD (inclusive)
    const idCategoria = searchParams.get('idCategoria');
    const search   = searchParams.get('search');

    const where: string[] = ['g.Status != 2'];
    const params: (string | number)[] = [];

    if (dateFrom && dateTo) {
      where.push('g.Fecha >= ? AND g.Fecha < DATE_ADD(?, INTERVAL 1 DAY)');
      params.push(dateFrom, dateTo);
    }
    if (idCategoria) {
      where.push('g.IdCategoriaGasto = ?');
      params.push(idCategoria);
    }
    if (search) {
      where.push('(g.Concepto LIKE ? OR g.Proveedor LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    const [expenses] = await pool.query(`
      SELECT g.IdGasto, g.Concepto, g.Monto, g.MetodoPago, g.Proveedor, g.Fecha, g.Notas,
             g.IdCategoriaGasto, cg.Categoria, u.Usuario
      FROM tblGastos g
      LEFT JOIN tblCategoriasGastos cg ON g.IdCategoriaGasto = cg.IdCategoriaGasto
      LEFT JOIN tblUsuarios u ON g.IdUsuario = u.IdUsuario
      WHERE ${where.join(' AND ')}
      ORDER BY g.Fecha DESC
    `, params);

    const [categories] = await pool.query(
      `SELECT IdCategoriaGasto, Categoria FROM tblCategoriasGastos WHERE Status != 2 ORDER BY Categoria ASC`
    );

    return NextResponse.json({ expenses, categories });
  } catch (error) {
    console.error('Expenses GET error:', error);
    return NextResponse.json({ message: 'Error al obtener gastos' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { Concepto, Monto, IdCategoriaGasto, MetodoPago, Proveedor, Fecha, Notas } = body;

    if (!Concepto || typeof Concepto !== 'string' || !Concepto.trim()) {
      return NextResponse.json({ message: 'El concepto es obligatorio' }, { status: 400 });
    }
    const monto = Number(Monto);
    if (!Number.isFinite(monto) || monto <= 0) {
      return NextResponse.json({ message: 'El monto debe ser mayor a cero' }, { status: 400 });
    }

    const cookieStore   = await cookies();
    const sessionCookie = cookieStore.get('auth_session');
    const user = sessionCookie ? JSON.parse(sessionCookie.value) : null;

    const [maxRows] = await pool.query('SELECT MAX(IdGasto) as maxId FROM tblGastos');
    const nextId = ((maxRows as any[])[0].maxId || 0) + 1;

    await pool.query(`
      INSERT INTO tblGastos
        (IdGasto, IdCategoriaGasto, Concepto, Monto, MetodoPago, Proveedor, Fecha, IdUsuario, Notas, Status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `, [
      nextId,
      IdCategoriaGasto || null,
      Concepto.trim(),
      monto,
      MetodoPago || null,
      Proveedor || null,
      Fecha || new Date(),
      user?.IdUsuario || null,
      Notas || null,
    ]);

    return NextResponse.json({ success: true, id: nextId });
  } catch (error) {
    console.error('Expenses POST error:', error);
    return NextResponse.json({ message: 'Error al crear el gasto' }, { status: 500 });
  }
}
