'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import styles from '../kitchen.module.css';

export default function KitchenPrint() {
  const params = useParams();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (params?.id) fetchData();
  }, [params?.id]);
  const fetchData = async () => {
    try {
      const res = await fetch(`/api/sales/${params.id}`);
      if (!res.ok) throw new Error('Venta no encontrada');
      const ticketData = await res.json();
      setData(ticketData);

      // Auto-print faster
      setTimeout(() => {
        window.print();
        window.addEventListener('afterprint', () => {
          window.close();
        }, { once: true });
      }, 500);
    } catch (err) {
      console.error('Error fetching kitchen data:', err);
      setData({ error: true });
    }
  };

  if (!data) return <div className={styles.ticket}>Cargando orden...</div>;
  if (data.error || !data.venta) return <div className={styles.ticket}>Error: No se pudo cargar la orden</div>;

  const { venta, details } = data;

  return (
    <div className={styles.ticket}>
      <div className={styles.header}>
        <div className={styles.title}>COCINA</div>
        <div style={{ fontSize: '14px' }}>Folio: {venta.Folio}</div>
      </div>

      {venta.Cliente && (
        <div className={styles.cliente}>
          PARA: {venta.Cliente.toUpperCase()}
        </div>
      )}

      <div className={styles.divider}></div>

      <div className={styles.items}>
        {details.filter((i: any) => !i.IdDetallePadre).map((item: any, idx: number) => {
          const itemExtras = details.filter((ex: any) => ex.IdDetallePadre === item.IdDetalleVenta);
          
          return (
            <div key={idx} className={styles.item}>
              <div className={styles.itemMain}>
                <span>[{item.Cantidad}]</span>
                <span>{item.Producto}</span>
              </div>
              
              {item.TipoPrecio > 0 && (
                <div style={{ 
                  fontSize: '16px', 
                  fontWeight: '900', 
                  marginLeft: '25px', 
                  marginTop: '4px',
                  border: '1.5px solid #000',
                  padding: '1px 4px',
                  display: 'inline-block'
                }}>
                  * {
                    item.TipoPrecio === 1 ? 'CHICO' : 
                    (item.TipoPrecio === 2 && item.Precio3 > 0) ? 'MEDIANO' : 'GRANDE'
                  }
                </div>
              )}

              {itemExtras.map((extra: any, eIdx: number) => (
                <div key={eIdx} className={styles.extras}>
                  + {extra.Producto}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <div className={styles.divider}></div>

      <div className={styles.meta}>
        <div>{new Date(venta.FechaVenta).toLocaleString()}</div>
      </div>
    </div>
  );
}
