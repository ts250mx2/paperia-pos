import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

// Status 2 = producto eliminado lógicamente. Nunca se lista en el POS ni en los catálogos.
const ACTIVE_PRODUCTS = 'p.Status != 2';

const PRODUCT_COLUMNS = `p.IdProducto, p.Producto, p.Precio1, p.Precio2, p.Precio3,
             p.IVA, p.Status, p.Multiple, p.IdCategoria, p.ArchivoImagen,
             c.Categoria`;

/**
 * Unidades vendidas por producto (histórico completo).
 *
 * Los tickets cancelados se descartan con NOT EXISTS sobre la clave real de una
 * venta en BDPaperia: (IdVenta, IdApertura). IdVenta por sí solo NO es único
 * —es un folio secuencial por apertura—, así que unir solo por IdVenta inflaría
 * las cantidades por fan-out. NOT EXISTS además evita el JOIN completo contra
 * tblVentas, que sobre estas tablas MyISAM cuesta el doble de tiempo.
 */
const UNITS_SOLD_BY_PRODUCT = `
        SELECT d.IdProducto, SUM(d.Cantidad) AS Vendidos
        FROM tblDetalleVentas d
        WHERE NOT EXISTS (
          SELECT 1 FROM tblVentas v
          WHERE v.IdVenta = d.IdVenta AND v.IdApertura = d.IdApertura AND v.Cancelada = 1
        )
        GROUP BY d.IdProducto`;

// El POS ordena por mayor venta (?sort=ventas); los catálogos, alfabéticamente.
function buildProductsQuery(sortBySales: boolean): string {
  if (sortBySales) {
    return `
      SELECT ${PRODUCT_COLUMNS}, COALESCE(vp.Vendidos, 0) AS Vendidos
      FROM tblProductos p
      LEFT JOIN tblCategorias c ON p.IdCategoria = c.IdCategoria
      LEFT JOIN (${UNITS_SOLD_BY_PRODUCT}
      ) vp ON vp.IdProducto = p.IdProducto
      WHERE ${ACTIVE_PRODUCTS}
      ORDER BY Vendidos DESC, p.Producto ASC
    `;
  }

  return `
    SELECT ${PRODUCT_COLUMNS}
    FROM tblProductos p
    LEFT JOIN tblCategorias c ON p.IdCategoria = c.IdCategoria
    WHERE ${ACTIVE_PRODUCTS}
    ORDER BY p.Producto ASC
  `;
}

export async function GET(request: NextRequest) {
  try {
    const sortBySales = new URL(request.url).searchParams.get('sort') === 'ventas';

    const [products] = await pool.query(buildProductsQuery(sortBySales));

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
