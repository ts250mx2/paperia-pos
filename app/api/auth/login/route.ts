import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { serialize } from 'cookie';

export async function POST(request: Request) {
  try {
    console.log('--- Login Attempt Start ---');
    const { username, password } = await request.json();
    console.log(`Attempting login for user: ${username}`);

    console.log('Database configuration:');
    console.log(`- Host: ${process.env.DB_HOST || 'hlsistemas.com'}`);
    console.log(`- User: ${process.env.DB_USER || 'kyk'}`);
    console.log(`- Database: ${process.env.DB_NAME || 'BDPaperia'}`);
    console.log(`- Port: ${process.env.DB_PORT || '3306'}`);

    console.log('Executing database query...');
    const [rows] = await pool.query(
      'SELECT IdUsuario, Usuario, IdPuesto, Status FROM tblUsuarios WHERE Login = ? AND Password = ? AND Status = 1',
      [username, password]
    );
    console.log('Query executed successfully.');

    const users = rows as any[];
    console.log(`Users found: ${users.length}`);

    if (users.length > 0) {
      const user = users[0];
      console.log('Login successful, setting cookie...');
      
      const cookie = serialize('auth_session', JSON.stringify(user), {
        httpOnly: true,
        secure: false, // Permitir en HTTP (necesario para acceso por IP sin SSL)
        sameSite: 'strict',
        maxAge: 60 * 60 * 24 * 7, // 1 week
        path: '/',
      });

      const response = NextResponse.json({
        success: true,
        user: {
          IdUsuario: user.IdUsuario,
          Usuario: user.Usuario,
          IdPuesto: user.IdPuesto
        }
      });

      response.headers.set('Set-Cookie', cookie);
      console.log('Response prepared with cookie.');
      return response;
    }

    console.log('Invalid credentials.');
    return NextResponse.json(
      { message: 'Credenciales inválidas' },
      { status: 401 }
    );
  } catch (error: any) {
    console.error('!!! Login Error !!!');
    console.error('Error details:', error.message || error);
    if (error.code) console.error('Error Code:', error.code);
    if (error.errno) console.error('Error Number:', error.errno);
    
    return NextResponse.json(
      { message: 'Error interno del servidor', details: error.message },
      { status: 500 }
    );
  } finally {
    console.log('--- Login Attempt End ---');
  }
}
