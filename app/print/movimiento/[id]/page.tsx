'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import styles from '../../ticket/ticket.module.css';

export default function MovimientoPrint() {
  const params = useParams();
  const [data, setData] = useState<any>(null);
  const [config, setConfig] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [movRes, configRes] = await Promise.all([
      fetch(`/api/movements/${params.id}`),
      fetch('/api/config/ticket')
    ]);
    const movData = await movRes.json();
    const configData = await configRes.json();
    
    setData(movData);
    setConfig(configData);
    
    // Auto-print faster
    setTimeout(() => {
      window.print();
      window.addEventListener('afterprint', () => {
        window.close();
      }, { once: true });
    }, 500);
  };

  if (!data || !config) return <div>Cargando comprobante de movimiento...</div>;

  const isSalida = data.Efectivo < 0;

  return (
    <div className={styles.ticket}>
      <div className={styles.header}>
        <img src="/logo.png" alt="Logo" style={{ width: '60px', marginBottom: '10px' }} />
        <div className={styles.title}>
          COMPROBANTE DE {isSalida ? 'SALIDA' : 'ENTRADA'}
        </div>
        {config.Header1 && <div style={{ fontSize: '11px', marginTop: '5px' }}>{config.Header1}</div>}
      </div>

      <div className={styles.divider}></div>

      <div className={styles.items}>
        <div className={styles.row}>
          <span>FOLIO:</span>
          <span>#{data.IdRetiro}</span>
        </div>
        <div className={styles.row}>
          <span>FECHA:</span>
          <span>{new Date(data.FechaRetiro).toLocaleString()}</span>
        </div>
        <div className={styles.row}>
          <span>CAJA ID:</span>
          <span>#{data.IdApertura}</span>
        </div>
      </div>

      <div className={styles.divider}></div>

      <div className={styles.sectionTitle} style={{ textAlign: 'left', textDecoration: 'none' }}>
        CONCEPTO:
      </div>
      <div style={{ fontSize: '14px', marginBottom: '15px' }}>
        {data.Concepto}
      </div>

      <div className={styles.divider}></div>

      <div className={styles.footer} style={{ fontSize: '16px', fontWeight: 'bold', textAlign: 'center', marginTop: '10px' }}>
        <div className={styles.row}>
          <span>MONTO:</span>
          <span style={{ fontSize: '20px' }}>${Math.abs(Number(data.Efectivo || 0)).toFixed(2)}</span>
        </div>
      </div>

      <div className={styles.divider} style={{ marginTop: '30px' }}></div>
      <div style={{ marginTop: '50px', textAlign: 'center', fontSize: '11px' }}>
        _________________________
        <br /> Firma de Conformidad
      </div>
    </div>
  );
}
