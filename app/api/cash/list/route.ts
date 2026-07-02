import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    const [rows] = await pool.query(`
      SELECT IdApertura, FechaApertura, FechaCierre, FondoCaja, TotalVentas, Cancelados
      FROM tblAperturasCierres
      ORDER BY IdApertura DESC
      LIMIT 100
    `);

    return NextResponse.json(rows);
  } catch (error) {
    console.error('Fetch aperturas list error:', error);
    return NextResponse.json({ message: 'Error' }, { status: 500 });
  }
}
