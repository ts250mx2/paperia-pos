import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'hlsistemas.com',
  user: process.env.DB_USER || 'kyk',
  password: process.env.DB_PASSWORD || 'merkurio',
  database: process.env.DB_NAME || 'BDPaperia',
  port: parseInt(process.env.DB_PORT || '3306'),
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10'),
  queueLimit: 0,
});

export default pool;
