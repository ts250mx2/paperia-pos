import { NextResponse } from 'next/server';
import pool from '@/lib/db';

/**
 * Devuelve el rango de fechas con ventas reales en la base de datos.
 * El dashboard lo usa para abrir por defecto en el período más reciente
 * que SÍ tiene datos (útil cuando la BD es un histórico que no llega a hoy).
 */
export async function GET() {
  try {
    const [rows] = await pool.query(
      'SELECT MIN(FechaVenta) AS minDate, MAX(FechaVenta) AS maxDate FROM tblVentas WHERE Cancelada = 0'
    );
    const r = (rows as any[])[0] || {};
    return NextResponse.json({ minDate: r.minDate ?? null, maxDate: r.maxDate ?? null });
  } catch (error: any) {
    console.error('Dashboard range error:', error);
    return NextResponse.json({ minDate: null, maxDate: null }, { status: 500 });
  }
}
