import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(request: Request) {
  try {
    const { cart, total, idApertura, efectivo, tarjeta, transferencia, cliente } = await request.json();

    /* ── 1. Validate open session ── */
    const [sessionRows] = await pool.query(
      'SELECT IdApertura FROM tblAperturasCierres WHERE (IdSupervisorCierre = 0 OR IdSupervisorCierre IS NULL) AND IdApertura = ?',
      [idApertura]
    );
    if ((sessionRows as any[]).length === 0) {
      return NextResponse.json({ message: 'No hay caja abierta. Abre la caja antes de vender.' }, { status: 400 });
    }

    /* ── 2. Validate payment amounts ── */
    const paid = (efectivo || 0) + (tarjeta || 0) + (transferencia || 0);
    if (paid < total - 0.01) {
      return NextResponse.json({ message: 'El monto pagado no cubre el total.' }, { status: 400 });
    }

    /* ── 3. Get next IdVenta ── */
    const [maxVenta] = await pool.query('SELECT MAX(IdVenta) as maxId FROM tblVentas');
    const idVenta = ((maxVenta as any[])[0].maxId || 0) + 1;

    /* ── 4. Get next Folio ── */
    const [maxFolio] = await pool.query(
      'SELECT MAX(CAST(Folio AS UNSIGNED)) as maxFolio FROM tblVentas WHERE IdApertura = ?',
      [idApertura]
    );
    const folio = ((maxFolio as any[])[0].maxFolio || 0) + 1;
    const folioStr = String(folio).padStart(6, '0');

    /* ── 5. Insert tblVentas ── */
    await pool.query(`
      INSERT INTO tblVentas
        (IdVenta, IdApertura, IdComputadora, Folio, Total, FechaVenta,
         IdAperturaPago, Efectivo, Tarjeta, Transferencia, Cancelada, VentaEn, Cliente)
      VALUES (?, ?, 1, ?, ?, NOW(), ?, ?, ?, ?, 0, 1, ?)
    `, [idVenta, idApertura, folioStr, total, idApertura,
        efectivo || 0, tarjeta || 0, transferencia || 0, cliente || '']);

    /* ── 6. Insert tblDetalleVentas (each item + its extras linked) ── */
    for (const item of cart) {
      // Main product
      const [mainRes] = await pool.query(`
        INSERT INTO tblDetalleVentas
          (IdVenta, IdProducto, Cantidad, Precio, Fecha, Folio, IdApertura, TipoPrecio, Descuento, EsExtra)
        VALUES (?, ?, ?, ?, NOW(), ?, ?, ?, 0, ?)
      `, [idVenta, item.productId, item.quantity, item.price, folio, idApertura, item.typePrice, item.isExtra || 0]);

      const parentId = (mainRes as any).insertId;

      // Extras (each linked to parentId)
      for (const extra of item.extras) {
        await pool.query(`
          INSERT INTO tblDetalleVentas
            (IdVenta, IdProducto, Cantidad, Precio, Fecha, Folio, IdApertura, TipoPrecio, Descuento, EsExtra, IdDetallePadre)
          VALUES (?, ?, ?, ?, NOW(), ?, ?, 1, 0, 1, ?)
        `, [idVenta, extra.IdProducto, item.quantity, extra.Precio1, folio, idApertura, parentId]);
      }
    }

    return NextResponse.json({ success: true, idVenta, folio: folioStr });
  } catch (error) {
    console.error('Sales POST error:', error);
    return NextResponse.json({ message: 'Error al procesar la venta' }, { status: 500 });
  }
}
