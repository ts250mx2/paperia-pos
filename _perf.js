const mysql = require('mysql2/promise');
(async () => {
  const conn = await mysql.createConnection({ host: 'hlsistemas.com', user: 'kyk', password: 'merkurio', database: 'BDPaperia', port: 3306, connectTimeout: 10000 });
  const df='2025-07-12', dt='2025-08-10';
  const time = async (label, sql, params) => { const t=Date.now(); const [r]=await conn.query(sql, params); console.log(label+': '+(Date.now()-t)+'ms, filas='+r.length); };
  await time('KPI', `SELECT COALESCE(SUM(v.Total),0) tv, COUNT(v.IdVenta) n FROM tblVentas v WHERE DATE(v.FechaVenta) BETWEEN ? AND ? AND v.Cancelada=0`, [df,dt]);
  await time('TREND', `SELECT DATE(v.FechaVenta) f, SUM(v.Total) t FROM tblVentas v WHERE DATE(v.FechaVenta) BETWEEN ? AND ? AND v.Cancelada=0 GROUP BY DATE(v.FechaVenta)`, [df,dt]);
  await time('BREAKDOWN', `SELECT c.IdCategoria, SUM(d.Cantidad*d.Precio) t FROM tblDetalleVentas d JOIN tblVentas v ON d.IdVenta=v.IdVenta LEFT JOIN tblProductos p ON d.IdProducto=p.IdProducto LEFT JOIN tblCategorias c ON p.IdCategoria=c.IdCategoria WHERE DATE(v.FechaVenta) BETWEEN ? AND ? AND v.Cancelada=0 GROUP BY c.IdCategoria ORDER BY t DESC LIMIT 10`, [df,dt]);
  await time('HEATMAP', `SELECT (DAYOFWEEK(v.FechaVenta)-1) ds, HOUR(v.FechaVenta) h, SUM(v.Total) t FROM tblVentas v WHERE DATE(v.FechaVenta) BETWEEN ? AND ? AND v.Cancelada=0 GROUP BY ds,h`, [df,dt]);
  // does tblVentas have index on FechaVenta?
  const [idx] = await conn.query('SHOW INDEX FROM tblVentas');
  console.log('Indices tblVentas:', idx.map(i=>i.Key_name+'('+i.Column_name+')').join(', '));
  const [idx2] = await conn.query('SHOW INDEX FROM tblDetalleVentas');
  console.log('Indices tblDetalleVentas:', idx2.map(i=>i.Key_name+'('+i.Column_name+')').join(', '));
  await conn.end(); process.exit(0);
})().catch(e=>{console.error('ERR',e.message);process.exit(1);});
