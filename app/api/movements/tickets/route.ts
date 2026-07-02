import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const idApertura = searchParams.get('idApertura');

    if (!idApertura) {
      return NextResponse.json({ message: 'Missing idApertura' }, { status: 400 });
    }

    const [rows] = await pool.query(`
      SELECT IdVenta, Folio, Total, FechaVenta, Cancelada, Efectivo, Tarjeta, Transferencia
      FROM tblVentas
      WHERE IdApertura = ?
      ORDER BY IdVenta DESC
    `, [idApertura]);

    return NextResponse.json(rows);
  } catch (error) {
    console.error('Fetch tickets error:', error);
    return NextResponse.json({ message: 'Error' }, { status: 500 });
  }
}
