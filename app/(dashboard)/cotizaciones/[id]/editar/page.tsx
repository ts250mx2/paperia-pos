'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Search, Plus, Trash2, Save, FileDown } from 'lucide-react';
import styles from './editar.module.css';

interface Line {
  key: string;
  idProducto: number | null;
  producto: string;
  cantidad: number;
  precio: number;
  descuento: number;
  tipoPrecio: number;
}
interface Prod {
  IdProducto: number;
  Producto: string;
  Precio1: number;
  Codigo?: string;
  CodigoBarras?: string;
}

const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(n) || 0);

let counter = 0;
const newKey = () => `L${Date.now()}_${counter++}`;

export default function EditarCotizacionPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [folio, setFolio]     = useState('');
  const [cliente, setCliente] = useState('');
  const [notas, setNotas]     = useState('');
  const [lines, setLines]     = useState<Line[]>([]);
  const [globalDiscount, setGlobalDiscount] = useState('');
  const [products, setProducts] = useState<Prod[]>([]);
  const [search, setSearch]   = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const [cotRes, prodRes] = await Promise.all([
          fetch(`/api/cotizaciones/${id}`),
          fetch('/api/products'),
        ]);
        if (!cotRes.ok) { setError('Cotización no encontrada'); setLoading(false); return; }
        const data = await cotRes.json();
        const prodData = await prodRes.json();
        setProducts(prodData.products || []);

        const c = data.cotizacion;
        setFolio(c.Folio || `COT-${c.IdCotizacion}`);
        setCliente(c.Cliente || '');
        setNotas(c.Notas || '');

        const dets: Line[] = (data.details || []).map((d: any) => ({
          key: newKey(),
          idProducto: d.IdProducto,
          producto: d.Producto,
          cantidad: Number(d.Cantidad),
          precio: Number(d.Precio),
          descuento: Number(d.Descuento) || 0,
          tipoPrecio: Number(d.TipoPrecio) || 1,
        }));
        setLines(dets);

        const sumLineDesc = dets.reduce((s, l) => s + (l.descuento || 0), 0);
        const gd = Math.max(0, Number(c.Descuento || 0) - sumLineDesc);
        setGlobalDiscount(gd > 0 ? String(gd) : '');
        setLoading(false);
      } catch {
        setError('Error al cargar la cotización');
        setLoading(false);
      }
    })();
  }, [id]);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return products.filter(p =>
      p.Producto.toLowerCase().includes(q) ||
      (p.Codigo || '').toLowerCase().includes(q) ||
      (p.CodigoBarras || '').toLowerCase().includes(q)
    ).slice(0, 8);
  }, [search, products]);

  const addProduct = (p: Prod) => {
    setLines(prev => [...prev, {
      key: newKey(), idProducto: p.IdProducto, producto: p.Producto,
      cantidad: 1, precio: Number(p.Precio1) || 0, descuento: 0, tipoPrecio: 1,
    }]);
    setSearch('');
  };

  const updateLine = (key: string, field: 'cantidad' | 'precio' | 'descuento', value: string) => {
    const num = parseFloat(value) || 0;
    setLines(prev => prev.map(l => {
      if (l.key !== key) return l;
      const next = { ...l, [field]: Math.max(0, num) };
      const gross = next.precio * next.cantidad;
      if (next.descuento > gross) next.descuento = gross;   // el descuento no excede el importe
      return next;
    }));
  };
  const removeLine = (key: string) => setLines(prev => prev.filter(l => l.key !== key));

  const subtotal = lines.reduce((s, l) => s + l.precio * l.cantidad, 0);
  const descProductos = lines.reduce((s, l) => s + Math.min(l.descuento, l.precio * l.cantidad), 0);
  const descGlobal = Math.min(parseFloat(globalDiscount) || 0, Math.max(0, subtotal - descProductos));
  const total = Math.max(0, subtotal - descProductos - descGlobal);

  const save = async () => {
    if (lines.length === 0) { setError('Agrega al menos un producto.'); return; }
    setSaving(true); setError('');
    try {
      const res = await fetch(`/api/cotizaciones/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cliente, notas, descuentoGlobal: descGlobal, lines }),
      });
      const data = await res.json();
      if (res.ok) {
        router.push('/cotizaciones');
      } else {
        setError(data.message || 'Error al guardar');
        setSaving(false);
      }
    } catch {
      setError('Error de conexión');
      setSaving(false);
    }
  };

  if (loading) return <div className={styles.center}>Cargando cotización...</div>;
  if (error && lines.length === 0) return <div className={styles.center} style={{ color: 'var(--danger)' }}>{error}</div>;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => router.push('/cotizaciones')}>
          <ArrowLeft size={18} /> Volver
        </button>
        <h1>Editar {folio}</h1>
        <button className={styles.pdfBtn} onClick={() => window.open(`/print/cotizacion/${id}`, '_blank')}>
          <FileDown size={16} /> Ver PDF
        </button>
      </header>

      {/* Datos del cliente */}
      <div className={`${styles.card} glass`}>
        <div className={styles.field}>
          <label>Cliente</label>
          <input value={cliente} onChange={e => setCliente(e.target.value)} placeholder="Nombre del cliente..." />
        </div>
        <div className={styles.field}>
          <label>Notas</label>
          <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2} placeholder="Vigencia, condiciones..." />
        </div>
      </div>

      {/* Agregar productos */}
      <div className={`${styles.card} glass`}>
        <label className={styles.addLabel}>Agregar producto</label>
        <div className={styles.searchBox}>
          <Search size={18} className={styles.searchIcon} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre o código..." />
          {matches.length > 0 && (
            <div className={styles.dropdown}>
              {matches.map(p => (
                <button key={p.IdProducto} className={styles.dropItem} onClick={() => addProduct(p)}>
                  <span>{p.Producto}</span>
                  <span className={styles.dropPrice}>{money(p.Precio1)} <Plus size={14} /></span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Renglones */}
      <div className={`${styles.card} glass`} style={{ overflowX: 'auto' }}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Producto</th>
              <th className={styles.num} style={{ width: 90 }}>Cantidad</th>
              <th className={styles.num} style={{ width: 110 }}>Precio</th>
              <th className={styles.num} style={{ width: 110 }}>Desc. $</th>
              <th className={styles.num} style={{ width: 110 }}>Importe</th>
              <th style={{ width: 44 }}></th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr><td colSpan={6} className={styles.emptyRow}>Sin productos. Usa el buscador de arriba para agregar.</td></tr>
            ) : lines.map(l => (
              <tr key={l.key}>
                <td>{l.producto}</td>
                <td className={styles.num}>
                  <input type="number" min="0" step="1" value={l.cantidad}
                    onChange={e => updateLine(l.key, 'cantidad', e.target.value)} className={styles.cellInput} />
                </td>
                <td className={styles.num}>
                  <input type="number" min="0" step="0.01" value={l.precio}
                    onChange={e => updateLine(l.key, 'precio', e.target.value)} className={styles.cellInput} />
                </td>
                <td className={styles.num}>
                  <input type="number" min="0" step="0.01" value={l.descuento || ''}
                    placeholder="0" onChange={e => updateLine(l.key, 'descuento', e.target.value)} className={styles.cellInput} />
                </td>
                <td className={styles.num}>{money(Math.max(0, l.precio * l.cantidad - l.descuento))}</td>
                <td className={styles.center}>
                  <button className={styles.delBtn} onClick={() => removeLine(l.key)} title="Quitar"><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totales */}
      <div className={styles.bottom}>
        <div className={`${styles.totals} glass`}>
          <div className={styles.totalRow}><span>Subtotal</span><span>{money(subtotal)}</span></div>
          {descProductos > 0 && (
            <div className={styles.totalRow}><span>Descuento productos</span><span>–{money(descProductos)}</span></div>
          )}
          <div className={styles.totalRow} style={{ alignItems: 'center' }}>
            <span>Descuento adicional</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              $ <input type="number" min="0" step="0.01" value={globalDiscount} placeholder="0.00"
                   onChange={e => setGlobalDiscount(e.target.value)} className={styles.cellInput} style={{ width: 100 }} />
            </span>
          </div>
          <div className={`${styles.totalRow} ${styles.grand}`}><span>Total</span><span>{money(total)}</span></div>
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.actions}>
        <button className={styles.cancelBtn} onClick={() => router.push('/cotizaciones')} disabled={saving}>Cancelar</button>
        <button className={styles.saveBtn} onClick={save} disabled={saving || lines.length === 0}>
          <Save size={17} /> {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  );
}
