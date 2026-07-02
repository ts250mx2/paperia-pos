import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    // 1. Ensure table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tblConfigTicket (
        Id INT PRIMARY KEY DEFAULT 1,
        Header1 VARCHAR(255),
        Header2 VARCHAR(255),
        Header3 VARCHAR(255),
        Header4 VARCHAR(255),
        Header5 VARCHAR(255),
        Footer1 VARCHAR(255),
        Footer2 VARCHAR(255),
        Footer3 VARCHAR(255),
        PrintKitchenDefault TINYINT DEFAULT 0,
        RequireCustomerName TINYINT DEFAULT 0
      )
    `);

    // 2. Get config
    const [rows] = await pool.query('SELECT * FROM tblConfigTicket WHERE Id = 1');
    let config = (rows as any[])[0];

    if (!config) {
      // Default config
      config = {
        Id: 1,
        Header1: 'LA PAPERIA',
        Header2: 'Papelería y algo más',
        Header3: '',
        Header4: '',
        Header5: '',
        Footer1: 'Gracias por su compra',
        Footer2: '¡Vuelva pronto!',
        Footer3: ''
      };
      await pool.query('INSERT INTO tblConfigTicket SET ?', [config]);
    }

    return NextResponse.json(config);
  } catch (error) {
    console.error('Config ticket GET error:', error);
    return NextResponse.json({ message: 'Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    
    // We only ever have one config row with Id=1
    const [rows] = await pool.query('SELECT Id FROM tblConfigTicket WHERE Id = 1');
    if ((rows as any[]).length === 0) {
      await pool.query('INSERT INTO tblConfigTicket SET ?, Id = 1', [data]);
    } else {
      await pool.query('UPDATE tblConfigTicket SET ? WHERE Id = 1', [data]);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Config ticket POST error:', error);
    return NextResponse.json({ message: 'Error' }, { status: 500 });
  }
}
