'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import styles from '../../ticket/ticket.module.css';

export default function CortePrint() {
  const params = useParams();
  const [data, setData] = useState<any>(null);
  const [config, setConfig] = useState<any>(null);

  useEffect(() => {
    if (params?.id) {
      fetchData();
    }
  }, [params?.id]);

  const fetchData = async () => {
    try {
      const sessionId = params.id;
      if (!sessionId || sessionId === 'undefined') return;

      const [statusRes, configRes] = await Promise.all([
        fetch(`/api/cash/status?id=${sessionId}`),
        fetch('/api/config/ticket')
      ]);
      const statusData = await statusRes.json();
      const configData = await configRes.json();
      
      if (statusData.isOpen && statusData.session) {
        setData(statusData.session);
      } else {
        setData({ error: 'Sesión no encontrada' });
      }
      setConfig(configData);
      
      // Auto-print faster
      setTimeout(() => {
        window.print();
        window.addEventListener('afterprint', () => {
          window.close();
        }, { once: true });
      }, 700);
    } catch (error) {
      console.error('Error fetching corte data:', error);
    }
  };

  if (!data || !config) return <div style={{ padding: '20px' }}>Cargando corte...</div>;
  if (data.error) return <div style={{ padding: '20px', color: 'red' }}>Error: {data.error}</div>;

  return (
    <div className={styles.ticket}>
      <div className={styles.header}>
        <img src="/logo.png" alt="Logo" style={{ width: '60px', marginBottom: '10px' }} />
        <div className={styles.title}>{config.Header1 || 'CORTE DE CAJA'}</div>
        {config.Header2 && <div>{config.Header2}</div>}
        {config.Header3 && <div>{config.Header3}</div>}
        
        <div className={styles.divider} style={{ margin: '15px 0' }}></div>
        <div style={{ fontWeight: 'bold', fontSize: '14px' }}>RESUMEN DE CAJA</div>
        <div>ID Apertura: {data.IdApertura}</div>
        <div>Apertura: {new Date(data.FechaApertura).toLocaleString()}</div>
        {data.FechaCierre && <div>Cierre: {new Date(data.FechaCierre).toLocaleString()}</div>}
      </div>

      <div className={styles.divider}></div>
      <div className={styles.sectionTitle}>VENTAS POR PRODUCTO</div>
      <div className={styles.items}>
        <div className={styles.productRow} style={{ fontWeight: 'bold', borderBottom: '1px solid #000' }}>
          <span>PRODUCTO</span>
          <div style={{ display: 'flex', gap: '10px' }}>
            <span>CANT.</span>
            <span>TOTAL</span>
          </div>
        </div>
        {data.products && data.products.map((p: any, i: number) => (
          <div key={i} className={styles.productRow}>
            <span>{p.Producto}</span>
            <div style={{ display: 'flex', gap: '10px' }}>
              <span style={{ minWidth: '35px', textAlign: 'right' }}>{p.Cantidad}</span>
              <span style={{ minWidth: '65px', textAlign: 'right' }}>${p.Total.toFixed(2)}</span>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.divider}></div>
      <div className={styles.sectionTitle}>ENTRADAS Y SALIDAS</div>
      <div className={styles.items}>
        {data.movements && data.movements.length > 0 ? (
          data.movements.map((m: any, i: number) => (
            <div key={i} className={styles.item} style={{ marginBottom: '8px' }}>
              <div className={styles.row}>
                <span style={{ fontWeight: 'bold' }}>#{m.IdRetiro} - {m.Efectivo > 0 ? 'ENTRADA' : 'SALIDA'}</span>
                <span>${Math.abs(m.Efectivo).toFixed(2)}</span>
              </div>
              <div style={{ fontSize: '9px', fontStyle: 'italic' }}>
                {m.Concepto} | {new Date(m.FechaRetiro).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          ))
        ) : (
          <div style={{ textAlign: 'center', fontSize: '11px' }}>Sin movimientos de efectivo</div>
        )}
      </div>

      <div className={styles.divider}></div>
      <div className={styles.sectionTitle}>TICKETS CANCELADOS</div>
      <div className={styles.items}>
        {data.cancelledTickets && data.cancelledTickets.length > 0 ? (
          data.cancelledTickets.map((t: any, i: number) => (
            <div key={i} className={styles.productRow}>
              <span>Folio: #{t.Folio}</span>
              <span>${t.Total.toFixed(2)}</span>
            </div>
          ))
        ) : (
          <div style={{ textAlign: 'center', fontSize: '11px' }}>Sin cancelaciones</div>
        )}
      </div>

      <div className={styles.divider}></div>

      <div className={styles.items}>
        <div className={styles.row}>
          <span>FONDO INICIAL</span>
          <span>${data.FondoCaja.toFixed(2)}</span>
        </div>
        <div className={styles.row}>
          <span>VENTAS EFECTIVO</span>
          <span>${(data.Efectivo || 0).toFixed(2)}</span>
        </div>
        <div className={styles.row}>
          <span>VENTAS TARJETA</span>
          <span>${(data.Tarjeta || 0).toFixed(2)}</span>
        </div>
        <div className={styles.row}>
          <span>VENTAS TRANSFERENCIA</span>
          <span>$0.00</span>
        </div>
      </div>

      <div className={styles.divider}></div>

      <div className={styles.footer}>
        <div className={styles.row} style={{ fontSize: '14px', fontWeight: 'bold' }}>
          <span>TOTAL VENTAS</span>
          <span>${(data.TotalVentas || 0).toFixed(2)}</span>
        </div>
        
        <div className={styles.divider} style={{ marginTop: '20px' }}></div>
        <div style={{ marginTop: '40px' }}>
          _________________________
          <br /> Firma Cajero
        </div>
      </div>
    </div>
  );
}
