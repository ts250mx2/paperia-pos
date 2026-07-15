'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import styles from './cotizacion.module.css';

const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(n) || 0);

const ESTATUS: Record<number, { label: string; cls: string }> = {
  0: { label: 'Vigente',    cls: 'vigente' },
  1: { label: 'Convertida', cls: 'convertida' },
  2: { label: 'Cancelada',  cls: 'cancelada' },
};

export default function CotizacionPrint() {
  const params = useParams();
  const [cot, setCot] = useState<any>(null);
  const [details, setDetails] = useState<any[]>([]);
  const [config, setConfig] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!params?.id) return;
    (async () => {
      try {
        const [cotRes, cfgRes] = await Promise.all([
          fetch(`/api/cotizaciones/${params.id}`),
          fetch('/api/config/ticket'),
        ]);
        if (!cotRes.ok) { setError('Cotización no encontrada'); return; }
        const data = await cotRes.json();
        setCot(data.cotizacion);
        setDetails(data.details || []);
        setConfig(await cfgRes.json());
        setTimeout(() => window.print(), 600);
      } catch {
        setError('Error al cargar la cotización');
      }
    })();
  }, [params?.id]);

  if (error) return <div className={styles.loading} style={{ color: '#c0392b' }}>{error}</div>;
  if (!cot)  return <div className={styles.loading}>Cargando cotización...</div>;

  const est = ESTATUS[cot.Estatus as number] || ESTATUS[0];
  const fecha = cot.Fecha ? new Date(cot.Fecha) : null;
  const sumLineDesc = details.reduce((s, d) => s + (Number(d.Descuento) || 0), 0);
  const descGlobal  = Math.max(0, Number(cot.Descuento || 0) - sumLineDesc);

  return (
    <div className={styles.page}>
      <div className={styles.actions}>
        <button className={styles.btn} onClick={() => window.print()}>Imprimir / PDF</button>
        <button className={`${styles.btn} ${styles.btnGhost}`} onClick={() => window.close()}>Cerrar</button>
      </div>

      <div className={styles.sheet}>
        {/* Encabezado */}
        <div className={styles.header}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="La Paperia" className={styles.logo} />
          <div className={styles.docMeta}>
            <div className={styles.docTitle}>COTIZACIÓN</div>
            <div className={styles.folio}>{cot.Folio || `COT-${cot.IdCotizacion}`}</div>
            {fecha && <div className={styles.fecha}>{fecha.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}</div>}
            <div><span className={`${styles.badge} ${styles[est.cls]}`}>{est.label}</span></div>
          </div>
        </div>

        {/* Emisor / Cliente */}
        <div className={styles.parties}>
          <div>
            <div className={styles.label}>Emisor</div>
            <div className={styles.value}>{config?.Header1 || 'LA PAPERIA'}</div>
            {config?.Header2 && <div>{config.Header2}</div>}
            {config?.Header3 && <div>{config.Header3}</div>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className={styles.label}>Cliente</div>
            <div className={styles.value}>{cot.Cliente?.trim() || 'Público en general'}</div>
            {cot.UsuarioNombre && <div style={{ color: '#888', fontSize: 12 }}>Atendió: {cot.UsuarioNombre}</div>}
          </div>
        </div>

        {/* Detalle */}
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.center} style={{ width: 58 }}>Cant.</th>
              <th>Descripción</th>
              <th className={styles.num} style={{ width: 95 }}>P. Unitario</th>
              <th className={styles.num} style={{ width: 85 }}>Desc.</th>
              <th className={styles.num} style={{ width: 105 }}>Importe</th>
            </tr>
          </thead>
          <tbody>
            {details.map((d) => (
              <tr key={d.IdDetalle}>
                <td className={styles.center}>{Number(d.Cantidad)}</td>
                <td>{d.Producto}</td>
                <td className={styles.num}>{money(d.Precio)}</td>
                <td className={styles.num}>{Number(d.Descuento) > 0 ? `–${money(d.Descuento)}` : '—'}</td>
                <td className={styles.num}>{money(d.Importe)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totales */}
        <div className={styles.totals}>
          <div className={styles.totalsBox}>
            <div className={styles.totalRow}><span>Subtotal</span><span>{money(cot.Subtotal)}</span></div>
            {sumLineDesc > 0 && (
              <div className={styles.totalRow}><span>Descuento productos</span><span>–{money(sumLineDesc)}</span></div>
            )}
            {descGlobal > 0 && (
              <div className={styles.totalRow}><span>Descuento adicional</span><span>–{money(descGlobal)}</span></div>
            )}
            <div className={`${styles.totalRow} ${styles.grand}`}><span>Total</span><span>{money(cot.Total)}</span></div>
          </div>
        </div>

        {/* Notas */}
        {cot.Notas?.trim() && (
          <div className={styles.notas}>
            <span className={styles.label}>Notas</span>
            {cot.Notas}
          </div>
        )}

        <div className={styles.footer}>
          Esta cotización es un documento informativo. Precios sujetos a cambio sin previo aviso.
          {config?.Footer1 ? ` · ${config.Footer1}` : ''}
        </div>
      </div>
    </div>
  );
}
