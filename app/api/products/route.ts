import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    const [products] = await pool.query(`
      SELECT p.IdProducto, p.Producto, p.Precio1, p.Precio2, p.Precio3,
             p.IVA, p.Status, p.Multiple, p.IdCategoria, p.ArchivoImagen,
             c.Categoria, c.EsExtra
      FROM tblProductos p
      LEFT JOIN tblCategorias c ON p.IdCategoria = c.IdCategoria
      WHERE p.Status != 2
      ORDER BY c.Categoria, p.Producto
    `);

    const [categories] = await pool.query(`
      SELECT * FROM tblCategorias ORDER BY Categoria ASC
    `);

    return NextResponse.json({ products, categories });
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json({ message: 'Error fetching products' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { Producto, Precio1, Precio2, Precio3, Multiple, IdCategoria, ArchivoImagen } = body;

    const [maxRows] = await pool.query('SELECT MAX(IdProducto) as maxId FROM tblProductos');
    const nextId = ((maxRows as any[])[0].maxId || 0) + 1;

    await pool.query(`
      INSERT INTO tblProductos
        (IdProducto, Producto, Precio1, Precio2, Precio3, Status, Multiple, IdCategoria, ArchivoImagen, FechaAct)
      VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, NOW())
    `, [nextId, Producto, Precio1, Precio2 || 0, Precio3 || 0, Multiple, IdCategoria, ArchivoImagen || null]);

    return NextResponse.json({ success: true, id: nextId });
  } catch (error) {
    console.error('Create product error:', error);
    return NextResponse.json({ message: 'Error creating product' }, { status: 500 });
  }
}
