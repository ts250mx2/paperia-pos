import pool from './lib/db';

/**
 * Seed para La Paperia.
 *
 * BDPaperia es una base de datos de producción que ya contiene los productos y
 * las categorías reales de la papelería. Por eso este script NO inserta
 * catálogo de ejemplo: únicamente garantiza que exista un usuario
 * administrador para poder iniciar sesión en el POS.
 *
 * Usuario por defecto:  Login: admin   Password: admin123
 */
async function seed() {
  try {
    const [users] = await pool.query('SELECT IdUsuario FROM tblUsuarios');
    if ((users as any[]).length === 0) {
      console.log('No hay usuarios. Creando administrador por defecto (admin / admin123)...');
      await pool.query(
        'INSERT INTO tblUsuarios (IdUsuario, Usuario, IdPuesto, Login, Password, Status) VALUES (?, ?, ?, ?, ?, ?)',
        [1, 'Administrador', 1, 'admin', 'admin123', 1]
      );
      console.log('Administrador creado.');
    } else {
      console.log(`Ya existen ${(users as any[]).length} usuario(s); no se crea ninguno.`);
    }

    console.log('Seed completado.');
  } catch (error) {
    console.error('Error en el seed:', error);
  } finally {
    process.exit();
  }
}

seed();
