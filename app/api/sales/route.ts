import { NextResponse } from 'next/server';
import pool from '@/lib/db';

/**
 * Registra una venta.
 *
 * OJO: tblVentas y tblDetalleVentas son MyISAM, que NO soporta transacciones
 * (BEGIN/ROLLBACK se ignoran silenciosamente). Por eso la atomicidad se emula
 * a mano: si falla algún renglón se borra lo ya insertado para no dejar una
 * venta a medias (encabezado sin productos) que descuadraría el corte.
 */
export async function POST(request: Request) {
  try {
    const { cart, idApertura, efectivo, tarjeta, transferencia, cliente, descuentoGlobal } = await request.json();

    if (!Array.isArray(cart) || cart.length === 0) {
      return NextResponse.json({ message: 'El carrito está vacío.' }, { status: 400 });
    }

    /* ── 1. Validar caja abierta ── */
    const [sessionRows] = await pool.query(
      'SELECT IdApertura FROM tblAperturasCierres WHERE (IdSupervisorCierre = 0 OR IdSupervisorCierre IS NULL) AND IdApertura = ?',
      [idApertura]
    );
    if ((sessionRows as any[]).length === 0) {
      return NextResponse.json({ message: 'No hay caja abierta. Abre la caja antes de vender.' }, { status: 400 });
    }

    /* ── 2. Totales y descuentos calculados en el servidor (no se confía en el cliente) ── */
    let subtotal = 0;          // importes brutos
    let descProductos = 0;     // descuentos por renglón
    for (const item of cart) {
      const gross = (Number(item.price) || 0) * (Number(item.quantity) || 0);
      subtotal += gross;
      descProductos += Math.max(0, Math.min(Number(item.discount) || 0, gross));
    }
    const descGlobal = Math.min(Number(descuentoGlobal) || 0, Math.max(0, subtotal - descProductos));
    const descuento  = descProductos + descGlobal;
    const total      = Math.max(0, subtotal - descuento);

    /* ── 3. Validar el pago contra el total real ── */
    const paid = (Number(efectivo) || 0) + (Number(tarjeta) || 0) + (Number(transferencia) || 0);
    if (paid < total - 0.01) {
      return NextResponse.json({ message: 'El monto pagado no cubre el total.' }, { status: 400 });
    }

    /* ── 4. Siguiente IdVenta y Folio ── */
    const [maxVenta] = await pool.query('SELECT MAX(IdVenta) as maxId FROM tblVentas');
    const idVenta = ((maxVenta as any[])[0].maxId || 0) + 1;

    const [maxFolio] = await pool.query(
      'SELECT MAX(CAST(Folio AS UNSIGNED)) as maxFolio FROM tblVentas WHERE IdApertura = ?',
      [idApertura]
    );
    const folio = ((maxFolio as any[])[0].maxFolio || 0) + 1;
    const folioStr = String(folio).padStart(6, '0');

    try {
      /* ── 5. Encabezado de la venta ── */
      await pool.query(`
        INSERT INTO tblVentas
          (IdVenta, IdApertura, IdComputadora, Folio, Total, FechaVenta,
           IdAperturaPago, Efectivo, Tarjeta, Transferencia, Descuento, Cancelada, VentaEn, Cliente)
        VALUES (?, ?, 1, ?, ?, NOW(), ?, ?, ?, ?, ?, 0, 1, ?)
      `, [idVenta, idApertura, folioStr, total, idApertura,
          efectivo || 0, tarjeta || 0, transferencia || 0, descuento, cliente || '']);

      /* ── 6. Renglones (el descuento por línea se guarda en cada renglón) ── */
      for (const item of cart) {
        const cantidad  = Number(item.quantity) || 0;
        const precio    = Number(item.price) || 0;
        const descLinea = Math.max(0, Math.min(Number(item.discount) || 0, precio * cantidad));

        await pool.query(`
          INSERT INTO tblDetalleVentas
            (IdVenta, IdProducto, Cantidad, Precio, Fecha, Folio, IdApertura, TipoPrecio, Descuento, EsExtra)
          VALUES (?, ?, ?, ?, NOW(), ?, ?, ?, ?, 0)
        `, [idVenta, item.productId, cantidad, precio, folio, idApertura, item.typePrice || 1, descLinea]);
      }
    } catch (insertError) {
      // Compensación manual (MyISAM no revierte solo). La clave real de un
      // ticket en BDPaperia es (IdVenta, IdApertura), no IdVenta por sí solo.
      try {
        await pool.query('DELETE FROM tblDetalleVentas WHERE IdVenta = ? AND IdApertura = ?', [idVenta, idApertura]);
        await pool.query('DELETE FROM tblVentas WHERE IdVenta = ? AND IdApertura = ?', [idVenta, idApertura]);
      } catch (cleanupError) {
        console.error('Sales cleanup failed for IdVenta', idVenta, cleanupError);
      }
      throw insertError;
    }

    return NextResponse.json({ success: true, idVenta, folio: folioStr, total });
  } catch (error) {
    console.error('Sales POST error:', error);
    return NextResponse.json({ message: 'Error al procesar la venta' }, { status: 500 });
  }
}
