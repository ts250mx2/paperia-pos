import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const idRaw = searchParams.get('id');
    const id = (idRaw && idRaw !== 'undefined' && idRaw !== 'null') ? parseInt(idRaw) : null;

    let query = '';
    let params: any[] = [];

    if (id) {
      query = 'SELECT IdApertura, FechaApertura, FechaCierre, FondoCaja, IdCajero, IdSupervisorCierre FROM tblAperturasCierres WHERE IdApertura = ?';
      params = [id];
    } else {
      query = `
        SELECT IdApertura, FechaApertura, FechaCierre, FondoCaja, IdCajero, IdSupervisorCierre
        FROM tblAperturasCierres
        WHERE (IdSupervisorCierre = 0 OR IdSupervisorCierre IS NULL)
        ORDER BY IdApertura DESC
        LIMIT 1
      `;
    }

    // 1. Get session
    const [rows] = await pool.query(query, params);

    const sessionData = (rows as any[])[0] || null;
    if (!sessionData) return NextResponse.json({ isOpen: false, session: null });

    // 2. Calculate current totals for this session
    const [totalsRows] = await pool.query(`
      SELECT 
        SUM(Total) as TotalVentas,
        SUM(Efectivo) as Efectivo,
        SUM(Tarjeta) as Tarjeta,
        SUM(Transferencia) as Transferencia
      FROM tblVentas
      WHERE IdApertura = ? AND Cancelada = 0
    `, [sessionData.IdApertura]);
    
    const totals = (totalsRows as any[])[0] || { TotalVentas: 0, Efectivo: 0, Tarjeta: 0, Transferencia: 0 };

    // 3. Get products summary
    const [productsRows] = await pool.query(`
      SELECT 
        p.Producto, 
        SUM(dv.Cantidad) as Cantidad, 
        SUM(dv.Precio * dv.Cantidad) as Total
      FROM tblDetalleVentas dv
      JOIN tblProductos p ON dv.IdProducto = p.IdProducto
      WHERE dv.IdApertura = ?
      GROUP BY p.Producto
      ORDER BY Cantidad DESC
    `, [sessionData.IdApertura]);

    // 4. Get cancelled tickets summary
    const [cancelledRows] = await pool.query(`
      SELECT Folio, Total, FechaVenta
      FROM tblVentas
      WHERE IdApertura = ? AND Cancelada = 1
      ORDER BY IdVenta DESC
    `, [sessionData.IdApertura]);

    // 5. Get cash movements (entries and exits)
    const [movementsRows] = await pool.query(`
      SELECT IdRetiro, Concepto, Efectivo, Fecha AS FechaRetiro
      FROM tblRetiros
      WHERE IdApertura = ?
      ORDER BY IdRetiro ASC
    `, [sessionData.IdApertura]);

    const session = {
      ...sessionData,
      ...totals,
      products: productsRows,
      cancelledTickets: cancelledRows,
      movements: movementsRows
    };

    return NextResponse.json({ isOpen: true, session });
  } catch (error) {
    console.error('Cash status error:', error);
    return NextResponse.json({ message: 'Error' }, { status: 500 });
  }
}
