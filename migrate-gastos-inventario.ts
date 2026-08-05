import pool from './lib/db';

/**
 * Migración de los módulos de Gastos e Inventario.
 *
 * Ejecutar con:  npx tsx migrate-gastos-inventario.ts
 *
 * Es idempotente y puramente aditiva: crea tablas, índices y una columna
 * nuevos, pero nunca modifica ni borra datos existentes. Volver a correrla
 * sobre una base ya migrada no tiene efecto (cada paso verifica antes).
 *
 * Las credenciales se toman de lib/db (variables de entorno en .env), igual
 * que en seed.ts, para no duplicar secretos en el repositorio.
 */

async function tableExists(table: string): Promise<boolean> {
  const [rows] = await pool.query(
    `SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table]
  );
  return (rows as unknown[]).length > 0;
}

async function columnExists(table: string, column: string): Promise<boolean> {
  const [rows] = await pool.query(
    `SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return (rows as unknown[]).length > 0;
}

async function indexExists(table: string, name: string): Promise<boolean> {
  const [rows] = await pool.query(
    `SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [table, name]
  );
  return (rows as unknown[]).length > 0;
}

async function createIndexIfMissing(table: string, name: string, columns: string): Promise<void> {
  if (await indexExists(table, name)) {
    console.log(`SKIP existe: ${table}.${name}`);
    return;
  }
  await pool.query(`CREATE INDEX \`${name}\` ON \`${table}\` ${columns}`);
  console.log(`CREADO indice: ${table}.${name}`);
}

const CATEGORIAS_GASTO_POR_DEFECTO = [
  'Renta',
  'Servicios (Luz/Agua/Internet)',
  'Nómina',
  'Insumos y Papelería',
  'Mantenimiento',
  'Transporte',
  'Impuestos',
  'Otros',
];

async function migrate() {
  try {
    /* ── 1. Categorías de gasto ── */
    if (!(await tableExists('tblCategoriasGastos'))) {
      await pool.query(`
        CREATE TABLE tblCategoriasGastos (
          IdCategoriaGasto INT NOT NULL PRIMARY KEY,
          Categoria VARCHAR(100) NOT NULL,
          Status INT NOT NULL DEFAULT 0
        ) ENGINE=InnoDB
      `);
      console.log('CREADA: tblCategoriasGastos');
    } else {
      console.log('SKIP existe: tblCategoriasGastos');
    }

    /* ── 2. Gastos ── */
    if (!(await tableExists('tblGastos'))) {
      await pool.query(`
        CREATE TABLE tblGastos (
          IdGasto INT NOT NULL PRIMARY KEY,
          IdCategoriaGasto INT NULL,
          Concepto VARCHAR(255) NOT NULL,
          Monto DOUBLE NOT NULL,
          MetodoPago VARCHAR(20) NULL,
          Proveedor VARCHAR(150) NULL,
          Fecha DATETIME NOT NULL,
          IdUsuario INT NULL,
          Notas VARCHAR(500) NULL,
          Status INT NOT NULL DEFAULT 0
        ) ENGINE=InnoDB
      `);
      console.log('CREADA: tblGastos');
    } else {
      console.log('SKIP existe: tblGastos');
    }
    await createIndexIfMissing('tblGastos', 'idx_gastos_fecha', '(Fecha)');
    await createIndexIfMissing('tblGastos', 'idx_gastos_categoria', '(IdCategoriaGasto)');

    /* ── 3. Movimientos de inventario (kardex) ── */
    if (!(await tableExists('tblInventarioMovimientos'))) {
      await pool.query(`
        CREATE TABLE tblInventarioMovimientos (
          IdMovimiento INT NOT NULL PRIMARY KEY,
          IdProducto INT NOT NULL,
          Tipo VARCHAR(20) NOT NULL,
          Cantidad DOUBLE NOT NULL,
          CostoUnitario DOUBLE NULL,
          Motivo VARCHAR(255) NULL,
          Fecha DATETIME NOT NULL,
          IdUsuario INT NULL,
          Referencia VARCHAR(100) NULL
        ) ENGINE=InnoDB
      `);
      console.log('CREADA: tblInventarioMovimientos');
    } else {
      console.log('SKIP existe: tblInventarioMovimientos');
    }
    await createIndexIfMissing('tblInventarioMovimientos', 'idx_inv_producto', '(IdProducto)');
    await createIndexIfMissing('tblInventarioMovimientos', 'idx_inv_fecha', '(Fecha)');

    /* ── 4. Stock mínimo por producto ── */
    if (!(await columnExists('tblProductos', 'StockMinimo'))) {
      await pool.query('ALTER TABLE tblProductos ADD COLUMN StockMinimo DOUBLE NOT NULL DEFAULT 0');
      console.log('CREADA columna: tblProductos.StockMinimo');
    } else {
      console.log('SKIP existe: tblProductos.StockMinimo');
    }

    /* ── 5. Categorías de gasto iniciales (solo si la tabla está vacía) ── */
    const [countRows] = await pool.query('SELECT COUNT(*) as total FROM tblCategoriasGastos');
    const total = (countRows as { total: number }[])[0].total;
    if (total === 0) {
      let nextId = 1;
      for (const categoria of CATEGORIAS_GASTO_POR_DEFECTO) {
        await pool.query(
          'INSERT INTO tblCategoriasGastos (IdCategoriaGasto, Categoria, Status) VALUES (?, ?, 0)',
          [nextId, categoria]
        );
        nextId++;
      }
      console.log(`Categorías de gasto por defecto insertadas: ${CATEGORIAS_GASTO_POR_DEFECTO.length}`);
    } else {
      console.log(`SKIP: tblCategoriasGastos ya tiene ${total} fila(s)`);
    }

    console.log('MIGRACION COMPLETA');
  } catch (error) {
    console.error('Error en la migración:', error);
    process.exitCode = 1;
  } finally {
    process.exit();
  }
}

migrate();
