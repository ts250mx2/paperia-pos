import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const lowStockOnly = searchParams.get('lowStock') === '1';

    const where: string[] = ['p.Status != 2'];
    const params: string[] = [];
    if (search) {
      where.push('(p.Producto LIKE ? OR c.Categoria LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
    const having = lowStockOnly ? 'HAVING p.StockMinimo > 0 AND Stock <= p.StockMinimo' : '';

    const [rows] = await pool.query(`
      SELECT p.IdProducto, p.Producto, p.Costo, p.StockMinimo, p.IdCategoria, c.Categoria,
             COALESCE(SUM(m.Cantidad), 0) AS Stock
      FROM tblProductos p
      LEFT JOIN tblCategorias c ON p.IdCategoria = c.IdCategoria
      LEFT JOIN tblInventarioMovimientos m ON m.IdProducto = p.IdProducto
      WHERE ${where.join(' AND ')}
      GROUP BY p.IdProducto, p.Producto, p.Costo, p.StockMinimo, p.IdCategoria, c.Categoria
      ${having}
      ORDER BY c.Categoria, p.Producto
    `, params);

    return NextResponse.json(rows);
  } catch (error) {
    console.error('Inventory GET error:', error);
    return NextResponse.json({ message: 'Error al obtener el inventario' }, { status: 500 });
  }
}
