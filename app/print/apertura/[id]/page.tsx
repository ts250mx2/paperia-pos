'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import styles from '../../ticket/ticket.module.css';

export default function AperturaPrint() {
  const params = useParams();
  const [data, setData] = useState<any>(null);
  const [config, setConfig] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [statusRes, configRes] = await Promise.all([
      fetch(`/api/cash/status?id=${params.id}`),
      fetch('/api/config/ticket')
    ]);
    const statusData = await statusRes.json();
    const configData = await configRes.json();
    
    setData(statusData.session);
    setConfig(configData);
    
    // Auto-print faster
    setTimeout(() => {
      window.print();
      window.addEventListener('afterprint', () => {
        window.close();
      }, { once: true });
    }, 500);
  };

  if (!data || !config) return <div>Cargando comprobante de apertura...</div>;

  return (
    <div className={styles.ticket}>
      <div className={styles.header}>
        <img src="/logo.png" alt="Logo" style={{ width: '60px', marginBottom: '10px' }} />
        <div className={styles.title}>COMPROBANTE DE APERTURA</div>
        {config.Header1 && <div style={{ fontSize: '11px', marginTop: '5px' }}>{config.Header1}</div>}
      </div>

      <div className={styles.divider}></div>

      <div className={styles.items}>
        <div className={styles.row}>
          <span>ID APERTURA:</span>
          <span>#{data.IdApertura}</span>
        </div>
        <div className={styles.row}>
          <span>FECHA:</span>
          <span>{new Date(data.FechaApertura).toLocaleString()}</span>
        </div>
        <div className={styles.row}>
          <span>CAJERO:</span>
          <span>USUARIO #{data.IdCajero}</span>
        </div>
      </div>

      <div className={styles.divider}></div>

      <div className={styles.footer} style={{ fontSize: '14px', fontWeight: 'bold', textAlign: 'center', marginTop: '15px' }}>
        <div className={styles.row}>
          <span>FONDO INICIAL:</span>
          <span style={{ fontSize: '18px' }}>${Number(data.FondoCaja || 0).toFixed(2)}</span>
        </div>
      </div>

      <div className={styles.divider} style={{ marginTop: '25px' }}></div>
      <div style={{ marginTop: '40px', textAlign: 'center', fontSize: '11px' }}>
        _________________________
        <br /> Firma Responsable
      </div>
    </div>
  );
}
