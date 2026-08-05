import pool from './db';

interface InventoryEntry {
  idProducto: number;
  /** Cantidad con signo: negativa descuenta stock, positiva lo devuelve. */
  cantidad: number;
  tipo: 'venta' | 'devolucion';
  motivo?: string;
  referencia?: string;
}

/**
 * Registra movimientos de inventario derivados de una operación de venta.
 *
 * Es best-effort a propósito: el inventario es un módulo satélite y una falla
 * aquí NO debe revertir ni bloquear una venta ya cobrada. Los errores se
 * registran en consola para poder reconciliar después con un ajuste manual.
 */
export async function recordInventoryMovements(
  entries: InventoryEntry[],
  idUsuario: number | null
): Promise<void> {
  if (entries.length === 0) return;

  try {
    const [maxRows] = await pool.query('SELECT MAX(IdMovimiento) as maxId FROM tblInventarioMovimientos');
    let nextId = ((maxRows as any[])[0].maxId || 0) + 1;

    for (const entry of entries) {
      await pool.query(`
        INSERT INTO tblInventarioMovimientos
          (IdMovimiento, IdProducto, Tipo, Cantidad, CostoUnitario, Motivo, Fecha, IdUsuario, Referencia)
        VALUES (?, ?, ?, ?, NULL, ?, NOW(), ?, ?)
      `, [
        nextId,
        entry.idProducto,
        entry.tipo,
        entry.cantidad,
        entry.motivo || null,
        idUsuario,
        entry.referencia || null,
      ]);
      nextId++;
    }
  } catch (error) {
    console.error('Inventory movement logging failed (venta no afectada):', error);
  }
}
