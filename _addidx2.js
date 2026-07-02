const mysql = require('mysql2/promise');
(async () => {
  const conn = await mysql.createConnection({ host: 'hlsistemas.com', user: 'kyk', password: 'merkurio', database: 'BDPaperia', port: 3306, connectTimeout: 15000 });
  async function hasIdx(table, name) {
    const [r] = await conn.query('SHOW INDEX FROM `'+table+'` WHERE Key_name = ?', [name]);
    return r.length > 0;
  }
  const idxs = [
    ['tblDetalleVentas', 'idx_dv_idproducto', '(IdProducto)'],
    ['tblDetalleVentas', 'idx_dv_idapertura', '(IdApertura)'],
    ['tblDetalleVentas', 'idx_dv_fecha', '(Fecha)'],
    ['tblVentas', 'idx_v_fechaventa', '(FechaVenta)'],
    ['tblVentas', 'idx_v_idapertura_v', '(IdApertura)'],
  ];
  for (const [t, name, cols] of idxs) {
    if (await hasIdx(t, name)) { console.log('SKIP existe: '+name); continue; }
    const start = Date.now();
    await conn.query('CREATE INDEX `'+name+'` ON `'+t+'` '+cols);
    console.log('CREADO: '+t+'.'+name+' '+cols+'  ('+((Date.now()-start)/1000).toFixed(1)+'s)');
  }
  console.log('TODOS LOS INDICES LISTOS');
  await conn.end(); process.exit(0);
})().catch(e=>{console.error('ERR',e.message);process.exit(1);});
