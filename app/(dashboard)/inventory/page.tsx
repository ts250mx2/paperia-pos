'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Boxes, Search, Plus, X, Check, ClipboardList, History,
} from 'lucide-react';
import styles from './inventory.module.css';

interface StockItem {
  IdProducto: number;
  Producto: string;
  Costo: number;
  StockMinimo: number;
  IdCategoria: number;
  Categoria?: string;
  Stock: number;
}

interface MovementRow {
  IdMovimiento: number;
  IdProducto: number;
  Producto?: string;
  Tipo: string;
  Cantidad: number;
  CostoUnitario?: number | null;
  Motivo?: string | null;
  Fecha: string;
  Referencia?: string | null;
  Usuario?: string | null;
}

const fmtMoney = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 }).format(n || 0);

const TIPO_LABEL: Record<string, string> = {
  entrada: 'Entrada', salida: 'Salida', ajuste: 'Ajuste', venta: 'Venta', devolucion: 'Devolución',
};
const TIPO_CLASS: Record<string, string> = {
  entrada: styles.tipoEntrada, salida: styles.tipoSalida, ajuste: styles.tipoAjuste,
  venta: styles.tipoSalida, devolucion: styles.tipoEntrada,
};

const BLANK_MOVEMENT_FORM = {
  Tipo: 'entrada' as 'entrada' | 'salida' | 'ajuste',
  Direction: 'aumentar' as 'aumentar' | 'disminuir',
  Cantidad: '',
  CostoUnitario: '',
  Motivo: '',
  Referencia: '',
};

export default function InventoryPage() {
  const [tab, setTab] = useState<'stock' | 'movimientos'>('stock');

  /* ── Stock ── */
  const [stock, setStock]             = useState<StockItem[]>([]);
  const [stockLoading, setStockLoading] = useState(true);
  const [search, setSearch]           = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [minEdits, setMinEdits]       = useState<Record<number, string>>({});

  /* ── Movimientos ── */
  const [movements, setMovements]     = useState<MovementRow[]>([]);
  const [movLoading, setMovLoading]   = useState(false);
  const [movTipo, setMovTipo]         = useState('');
  const [movDateFrom, setMovDateFrom] = useState('');
  const [movDateTo, setMovDateTo]     = useState('');

  /* ── Modal de movimiento ── */
  const [isModalOpen, setIsModalOpen]       = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<StockItem | null>(null);
  const [comboSearch, setComboSearch]       = useState('');
  const [comboOpen, setComboOpen]           = useState(false);
  const [form, setForm]                     = useState({ ...BLANK_MOVEMENT_FORM });
  const [saving, setSaving]                 = useState(false);

  const fetchStock = useCallback(async () => {
    setStockLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (lowStockOnly) params.set('lowStock', '1');
      const res  = await fetch(`/api/inventory?${params}`);
      const data = await res.json();
      setStock(Array.isArray(data) ? data : []);
    } catch {
      setStock([]);
    } finally {
      setStockLoading(false);
    }
  }, [search, lowStockOnly]);

  const fetchMovements = useCallback(async () => {
    setMovLoading(true);
    try {
      const params = new URLSearchParams();
      if (movTipo) params.set('tipo', movTipo);
      if (movDateFrom && movDateTo) { params.set('dateFrom', movDateFrom); params.set('dateTo', movDateTo); }
      const res  = await fetch(`/api/inventory/movements?${params}`);
      const data = await res.json();
      setMovements(Array.isArray(data) ? data : []);
    } catch {
      setMovements([]);
    } finally {
      setMovLoading(false);
    }
  }, [movTipo, movDateFrom, movDateTo]);

  useEffect(() => {
    const id = setTimeout(fetchStock, 250);
    return () => clearTimeout(id);
  }, [fetchStock]);

  useEffect(() => {
    if (tab === 'movimientos') fetchMovements();
  }, [tab, fetchMovements]);

  const totalSKUs        = stock.length;
  const totalUnidades    = stock.reduce((acc, s) => acc + Number(s.Stock), 0);
  const valorInventario  = stock.reduce((acc, s) => acc + Number(s.Stock) * Number(s.Costo || 0), 0);
  const bajoStockCount   = stock.filter(s => s.StockMinimo > 0 && s.Stock <= s.StockMinimo).length;

  /* ── Edición inline de stock mínimo ── */
  const commitMinEdit = async (item: StockItem) => {
    const raw = minEdits[item.IdProducto];
    if (raw === undefined) return;
    const value = parseFloat(raw);
    const clearEdit = () => setMinEdits(prev => {
      const next = { ...prev };
      delete next[item.IdProducto];
      return next;
    });

    if (!Number.isFinite(value) || value < 0 || value === item.StockMinimo) {
      clearEdit();
      return;
    }
    try {
      const res = await fetch(`/api/inventory/${item.IdProducto}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ StockMinimo: value }),
      });
      if (res.ok) {
        setStock(prev => prev.map(s => s.IdProducto === item.IdProducto ? { ...s, StockMinimo: value } : s));
      } else {
        alert('No se pudo actualizar el stock mínimo');
      }
    } catch {
      alert('Error de conexión');
    } finally {
      clearEdit();
    }
  };

  /* ── Modal ── */
  const openModal = (product: StockItem | null = null) => {
    setSelectedProduct(product);
    setComboSearch('');
    setComboOpen(false);
    setForm({ ...BLANK_MOVEMENT_FORM });
    setIsModalOpen(true);
  };

  const comboResults = useMemo(() => {
    if (!comboSearch.trim()) return stock.slice(0, 8);
    const q = comboSearch.toLowerCase();
    return stock.filter(s => s.Producto.toLowerCase().includes(q)).slice(0, 8);
  }, [comboSearch, stock]);

  const handleSubmitMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) { alert('Selecciona un producto'); return; }
    const cantidad = parseFloat(form.Cantidad);
    if (!Number.isFinite(cantidad) || cantidad <= 0) { alert('Ingresa una cantidad válida'); return; }

    setSaving(true);
    try {
      const res = await fetch('/api/inventory/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          IdProducto: selectedProduct.IdProducto,
          Tipo: form.Tipo,
          Direction: form.Direction,
          Cantidad: cantidad,
          CostoUnitario: form.CostoUnitario ? parseFloat(form.CostoUnitario) : null,
          Motivo: form.Motivo || null,
          Referencia: form.Referencia || null,
        }),
      });
      if (res.ok) {
        setIsModalOpen(false);
        fetchStock();
        if (tab === 'movimientos') fetchMovements();
      } else {
        const err = await res.json();
        alert(err.message || 'Error al registrar el movimiento');
      }
    } catch {
      alert('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleGroup}>
          <Boxes size={30} color="var(--primary)" />
          <div>
            <h1>Inventario</h1>
            <p className={styles.subtitle}>Controla existencias, entradas, salidas y ajustes de stock</p>
          </div>
        </div>
        <button className={styles.addBtn} onClick={() => openModal()}>
          <Plus size={18} /> Registrar Movimiento
        </button>
      </header>

      <div className={styles.statStrip}>
        <div className={`${styles.statCard} glass`}>
          <span className={styles.statLabel}>SKUs con existencia registrada</span>
          <span className={styles.statValue}>{totalSKUs}</span>
        </div>
        <div className={`${styles.statCard} glass`}>
          <span className={styles.statLabel}>Unidades en stock</span>
          <span className={styles.statValue}>{totalUnidades.toLocaleString('es-MX')}</span>
        </div>
        <div className={`${styles.statCard} glass`}>
          <span className={styles.statLabel}>Valor de inventario</span>
          <span className={styles.statValue}>{fmtMoney(valorInventario)}</span>
        </div>
        <div className={`${styles.statCard} glass`}>
          <span className={styles.statLabel}>Productos en bajo stock</span>
          <span className={`${styles.statValue} ${bajoStockCount > 0 ? styles.statDanger : ''}`}>{bajoStockCount}</span>
        </div>
      </div>

      <div className={`${styles.tabs} glass`}>
        <button className={`${styles.tabBtn} ${tab === 'stock' ? styles.tabActive : ''}`} onClick={() => setTab('stock')}>
          <ClipboardList size={15} style={{ verticalAlign: '-2px', marginRight: '0.4rem' }} /> Stock Actual
        </button>
        <button className={`${styles.tabBtn} ${tab === 'movimientos' ? styles.tabActive : ''}`} onClick={() => setTab('movimientos')}>
          <History size={15} style={{ verticalAlign: '-2px', marginRight: '0.4rem' }} /> Movimientos
        </button>
      </div>

      {tab === 'stock' ? (
        <>
          <div className={`${styles.filterBar} glass`}>
            <div className={styles.searchWrap}>
              <Search size={16} className={styles.searchIcon} />
              <input
                type="text"
                placeholder="Buscar por producto o categoría..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <label className={styles.checkboxLabel}>
              <input type="checkbox" checked={lowStockOnly} onChange={e => setLowStockOnly(e.target.checked)} />
              Solo bajo stock
            </label>
          </div>

          <div className={`${styles.tableContainer} glass animate-fade`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Categoría</th>
                  <th>Stock</th>
                  <th>Mínimo</th>
                  <th>Costo</th>
                  <th>Valor</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {stockLoading ? (
                  <tr><td colSpan={7} className={styles.emptyCell}>Cargando...</td></tr>
                ) : stock.length === 0 ? (
                  <tr><td colSpan={7} className={styles.emptyCell}>No hay productos que coincidan</td></tr>
                ) : stock.map(item => {
                  const isLow = item.StockMinimo > 0 && item.Stock <= item.StockMinimo;
                  return (
                    <tr key={item.IdProducto}>
                      <td className={styles.productName}>{item.Producto}</td>
                      <td><span className={styles.catBadge}>{item.Categoria || '—'}</span></td>
                      <td className={`${styles.stockValue} ${isLow ? styles.stockLow : styles.stockOk}`}>{item.Stock}</td>
                      <td>
                        <input
                          type="number" min="0" step="1" className={styles.minInput}
                          value={minEdits[item.IdProducto] ?? item.StockMinimo}
                          onChange={e => setMinEdits(prev => ({ ...prev, [item.IdProducto]: e.target.value }))}
                          onBlur={() => commitMinEdit(item)}
                          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                        />
                      </td>
                      <td>{fmtMoney(item.Costo)}</td>
                      <td className={styles.valueCell}>{fmtMoney(item.Stock * (item.Costo || 0))}</td>
                      <td>
                        <button className={styles.rowAddBtn} onClick={() => openModal(item)}>
                          <Plus size={13} /> Movimiento
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          <div className={`${styles.filterBar} glass`}>
            <select className={styles.filterSelect} value={movTipo} onChange={e => setMovTipo(e.target.value)}>
              <option value="">Todos los tipos</option>
              <option value="entrada">Entrada</option>
              <option value="salida">Salida</option>
              <option value="ajuste">Ajuste</option>
              <option value="venta">Venta</option>
              <option value="devolucion">Devolución</option>
            </select>
            <input type="date" className={styles.filterDate} value={movDateFrom} onChange={e => setMovDateFrom(e.target.value)} />
            <span className={styles.filterSep}>→</span>
            <input type="date" className={styles.filterDate} value={movDateTo} onChange={e => setMovDateTo(e.target.value)} />
          </div>

          <div className={`${styles.tableContainer} glass animate-fade`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Producto</th>
                  <th>Tipo</th>
                  <th>Cantidad</th>
                  <th>Motivo</th>
                  <th>Usuario</th>
                </tr>
              </thead>
              <tbody>
                {movLoading ? (
                  <tr><td colSpan={6} className={styles.emptyCell}>Cargando...</td></tr>
                ) : movements.length === 0 ? (
                  <tr><td colSpan={6} className={styles.emptyCell}>No hay movimientos registrados</td></tr>
                ) : movements.map(m => (
                  <tr key={m.IdMovimiento}>
                    <td>{new Date(m.Fecha).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                    <td className={styles.productName}>{m.Producto || '—'}</td>
                    <td><span className={`${styles.tipoBadge} ${TIPO_CLASS[m.Tipo] || ''}`}>{TIPO_LABEL[m.Tipo] || m.Tipo}</span></td>
                    <td className={m.Cantidad >= 0 ? styles.cantidadPos : styles.cantidadNeg}>
                      {m.Cantidad >= 0 ? '+' : ''}{m.Cantidad}
                    </td>
                    <td className={styles.motivo}>{m.Motivo || '—'}</td>
                    <td className={styles.motivo}>{m.Usuario || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── Modal: Registrar Movimiento ── */}
      {isModalOpen && (
        <div className={styles.overlay}>
          <div className={`${styles.modal} glass animate-scale`}>
            <div className={styles.modalHead}>
              <h3>Registrar Movimiento</h3>
              <button onClick={() => setIsModalOpen(false)}><X size={20} /></button>
            </div>

            <form onSubmit={handleSubmitMovement} className={styles.form}>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Producto *</label>
                <div className={styles.comboWrap}>
                  {selectedProduct ? (
                    <div className={styles.comboSelected}>
                      <span>{selectedProduct.Producto} <small>(stock: {selectedProduct.Stock})</small></span>
                      <button type="button" onClick={() => setSelectedProduct(null)}>Cambiar</button>
                    </div>
                  ) : (
                    <>
                      <input
                        type="text"
                        placeholder="Buscar producto..."
                        value={comboSearch}
                        autoFocus
                        onFocus={() => setComboOpen(true)}
                        onChange={e => { setComboSearch(e.target.value); setComboOpen(true); }}
                      />
                      {comboOpen && (
                        <div className={styles.comboDropdown}>
                          {comboResults.length === 0 ? (
                            <div className={styles.comboEmpty}>Sin resultados</div>
                          ) : comboResults.map(p => (
                            <div
                              key={p.IdProducto}
                              className={styles.comboOption}
                              onClick={() => { setSelectedProduct(p); setComboOpen(false); }}
                            >
                              <span>{p.Producto}</span>
                              <span className={styles.comboOptionStock}>stock: {p.Stock}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Tipo *</label>
                  <select value={form.Tipo} onChange={e => setForm({ ...form, Tipo: e.target.value as typeof form.Tipo })}>
                    <option value="entrada">Entrada (compra / recepción)</option>
                    <option value="salida">Salida (merma / uso interno)</option>
                    <option value="ajuste">Ajuste manual</option>
                  </select>
                </div>
                {form.Tipo === 'ajuste' ? (
                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>Dirección *</label>
                    <select value={form.Direction} onChange={e => setForm({ ...form, Direction: e.target.value as typeof form.Direction })}>
                      <option value="aumentar">Aumentar stock</option>
                      <option value="disminuir">Disminuir stock</option>
                    </select>
                  </div>
                ) : (
                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>Cantidad *</label>
                    <input
                      type="number" min="0.01" step="0.01" required
                      value={form.Cantidad}
                      onChange={e => setForm({ ...form, Cantidad: e.target.value })}
                    />
                  </div>
                )}
              </div>

              {form.Tipo === 'ajuste' && (
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Cantidad *</label>
                  <input
                    type="number" min="0.01" step="0.01" required
                    value={form.Cantidad}
                    onChange={e => setForm({ ...form, Cantidad: e.target.value })}
                  />
                </div>
              )}

              {form.Tipo === 'entrada' && (
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Costo unitario <small>(opcional)</small></label>
                  <input
                    type="number" min="0" step="0.01"
                    value={form.CostoUnitario}
                    onChange={e => setForm({ ...form, CostoUnitario: e.target.value })}
                  />
                </div>
              )}

              <div className={styles.field}>
                <label className={styles.fieldLabel}>Motivo <small>(opcional)</small></label>
                <input
                  type="text"
                  placeholder="Ej: Compra a proveedor, merma por daño..."
                  value={form.Motivo}
                  onChange={e => setForm({ ...form, Motivo: e.target.value })}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel}>Referencia <small>(opcional)</small></label>
                <input
                  type="text"
                  placeholder="Ej: Folio de factura o remisión"
                  value={form.Referencia}
                  onChange={e => setForm({ ...form, Referencia: e.target.value })}
                />
              </div>

              <button type="submit" className={styles.saveBtn} disabled={saving || !selectedProduct}>
                <Check size={18} />
                {saving ? 'Guardando...' : 'Registrar Movimiento'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
