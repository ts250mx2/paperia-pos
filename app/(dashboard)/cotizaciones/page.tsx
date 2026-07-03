'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Search, FileDown, RefreshCw, Pencil } from 'lucide-react';
import styles from './cotizaciones.module.css';

interface Cotizacion {
  IdCotizacion: number;
  Folio: string;
  Fecha: string;
  Cliente: string;
  Total: number;
  Estatus: number;
  UsuarioNombre?: string;
  Articulos: number;
}

const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(n) || 0);

const ESTATUS: Record<number, { label: string; cls: string }> = {
  0: { label: 'Vigente',    cls: 'vigente' },
  1: { label: 'Convertida', cls: 'convertida' },
  2: { label: 'Cancelada',  cls: 'cancelada' },
};

export default function CotizacionesPage() {
  const [list, setList]       = useState<Cotizacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const router = useRouter();

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/cotizaciones');
      setList(res.ok ? await res.json() : []);
    } catch { setList([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(c =>
      (c.Folio || '').toLowerCase().includes(q) ||
      (c.Cliente || '').toLowerCase().includes(q)
    );
  }, [list, search]);

  const openPdf = (id: number) => window.open(`/print/cotizacion/${id}`, '_blank');

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleGroup}>
          <FileText size={30} color="var(--primary)" />
          <div>
            <h1>Cotizaciones</h1>
            <p className={styles.subtitle}>Cotizaciones guardadas desde el punto de venta</p>
          </div>
        </div>
        <button className={styles.refreshBtn} onClick={load} title="Actualizar">
          <RefreshCw size={16} /> Actualizar
        </button>
      </header>

      <div className={styles.searchBar}>
        <Search size={18} className={styles.searchIcon} />
        <input
          type="text"
          placeholder="Buscar por folio o cliente..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className={`${styles.tableWrap} glass`}>
        {loading ? (
          <div className={styles.empty}>Cargando cotizaciones...</div>
        ) : filtered.length === 0 ? (
          <div className={styles.empty}>
            {list.length === 0 ? 'Aún no hay cotizaciones guardadas.' : 'Sin resultados para la búsqueda.'}
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Folio</th>
                <th>Fecha</th>
                <th>Cliente</th>
                <th className={styles.center}>Artículos</th>
                <th className={styles.num}>Total</th>
                <th className={styles.center}>Estatus</th>
                <th className={styles.center}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const est = ESTATUS[c.Estatus] || ESTATUS[0];
                return (
                  <tr key={c.IdCotizacion}>
                    <td className={styles.folio}>{c.Folio}</td>
                    <td>{c.Fecha ? new Date(c.Fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                    <td>{c.Cliente?.trim() || 'Público en general'}</td>
                    <td className={styles.center}>{c.Articulos}</td>
                    <td className={styles.num}>{money(c.Total)}</td>
                    <td className={styles.center}>
                      <span className={`${styles.badge} ${styles[est.cls]}`}>{est.label}</span>
                    </td>
                    <td className={styles.center}>
                      <div className={styles.actions}>
                        <button className={styles.editBtn} onClick={() => router.push(`/cotizaciones/${c.IdCotizacion}/editar`)} title="Editar">
                          <Pencil size={16} />
                        </button>
                        <button className={styles.pdfBtn} onClick={() => openPdf(c.IdCotizacion)} title="Abrir PDF">
                          <FileDown size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
