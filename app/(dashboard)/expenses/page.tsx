'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Wallet, Search, Plus, Edit2, Trash2, X, Check, AlertTriangle,
} from 'lucide-react';
import styles from './expenses.module.css';

interface Expense {
  IdGasto: number;
  Concepto: string;
  Monto: number;
  MetodoPago: string | null;
  Proveedor: string | null;
  Fecha: string;
  Notas: string | null;
  IdCategoriaGasto: number | null;
  Categoria?: string;
  Usuario?: string;
}

interface ExpenseCategory {
  IdCategoriaGasto: number;
  Categoria: string;
}

const METODOS_PAGO = ['Efectivo', 'Tarjeta', 'Transferencia'];

const todayISO = () => new Date().toISOString().slice(0, 10);

const BLANK_FORM = {
  Concepto: '',
  Monto: 0,
  IdCategoriaGasto: 0,
  MetodoPago: 'Efectivo',
  Proveedor: '',
  Fecha: todayISO(),
  Notas: '',
};

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 }).format(n || 0);

export default function ExpensesPage() {
  const [expenses, setExpenses]       = useState<Expense[]>([]);
  const [categories, setCategories]   = useState<ExpenseCategory[]>([]);
  const [loading, setLoading]         = useState(true);

  // Filtros
  const [search, setSearch]           = useState('');
  const [filterCat, setFilterCat]     = useState('');
  const [dateFrom, setDateFrom]       = useState('');
  const [dateTo, setDateTo]           = useState('');

  // Modal de alta/edición
  const [isModalOpen, setIsModalOpen]   = useState(false);
  const [editing, setEditing]           = useState<Expense | null>(null);
  const [formData, setFormData]         = useState({ ...BLANK_FORM });
  const [saving, setSaving]             = useState(false);

  // Alta rápida de categoría
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddValue, setQuickAddValue] = useState('');
  const [quickAddSaving, setQuickAddSaving] = useState(false);

  // Confirmación de borrado
  const [confirmDelete, setConfirmDelete] = useState<Expense | null>(null);
  const [deleting, setDeleting]           = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo)   params.set('dateTo', dateTo);
      if (filterCat) params.set('idCategoria', filterCat);
      if (search)   params.set('search', search);

      const res  = await fetch(`/api/expenses?${params}`);
      const data = await res.json();
      setExpenses(data.expenses || []);
      setCategories(data.categories || []);
    } catch {
      // el estado de error visible se maneja implícitamente con la tabla vacía
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, filterCat, search]);

  useEffect(() => {
    const id = setTimeout(fetchData, 250); // pequeño debounce para no golpear la API en cada tecla
    return () => clearTimeout(id);
  }, [fetchData]);

  const clearFilters = () => {
    setSearch(''); setFilterCat(''); setDateFrom(''); setDateTo('');
  };
  const hasFilters = !!(search || filterCat || dateFrom || dateTo);

  const totalPeriodo = expenses.reduce((acc, g) => acc + Number(g.Monto), 0);

  /* ── Modal de alta/edición ── */
  const openModal = (expense: Expense | null = null) => {
    if (expense) {
      setEditing(expense);
      setFormData({
        Concepto: expense.Concepto,
        Monto: expense.Monto,
        IdCategoriaGasto: expense.IdCategoriaGasto || 0,
        MetodoPago: expense.MetodoPago || 'Efectivo',
        Proveedor: expense.Proveedor || '',
        Fecha: expense.Fecha ? expense.Fecha.slice(0, 10) : todayISO(),
        Notas: expense.Notas || '',
      });
    } else {
      setEditing(null);
      setFormData({ ...BLANK_FORM, IdCategoriaGasto: categories[0]?.IdCategoriaGasto || 0 });
    }
    setQuickAddOpen(false);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const method = editing ? 'PUT' : 'POST';
    const url    = editing ? `/api/expenses/${editing.IdGasto}` : '/api/expenses';
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) { setIsModalOpen(false); fetchData(); }
      else { const err = await res.json(); alert(err.message || 'Error al guardar'); }
    } catch { alert('Error de conexión'); }
    finally   { setSaving(false); }
  };

  /* ── Alta rápida de categoría ── */
  const handleQuickAddCategory = async () => {
    if (!quickAddValue.trim()) return;
    setQuickAddSaving(true);
    try {
      const res = await fetch('/api/expenses/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Categoria: quickAddValue.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        const newCat = { IdCategoriaGasto: data.id, Categoria: quickAddValue.trim() };
        setCategories(prev => [...prev, newCat].sort((a, b) => a.Categoria.localeCompare(b.Categoria)));
        setFormData(prev => ({ ...prev, IdCategoriaGasto: data.id }));
        setQuickAddValue('');
        setQuickAddOpen(false);
      } else {
        alert(data.message || 'Error al crear la categoría');
      }
    } catch { alert('Error de conexión'); }
    finally { setQuickAddSaving(false); }
  };

  /* ── Borrado ── */
  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/expenses/${confirmDelete.IdGasto}`, { method: 'DELETE' });
      if (res.ok) { setConfirmDelete(null); fetchData(); }
      else        { alert('Error al eliminar el gasto'); }
    } catch { alert('Error de conexión'); }
    finally   { setDeleting(false); }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleGroup}>
          <Wallet size={30} color="var(--primary)" />
          <div>
            <h1>Gastos</h1>
            <p className={styles.subtitle}>Registra y controla los gastos del negocio</p>
          </div>
        </div>
        <button className={styles.addBtn} onClick={() => openModal()}>
          <Plus size={18} /> Nuevo Gasto
        </button>
      </header>

      <div className={`${styles.filterBar} glass`}>
        <div className={styles.searchWrap}>
          <Search size={16} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Buscar por concepto o proveedor..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className={styles.filterSelect}
          value={filterCat}
          onChange={e => setFilterCat(e.target.value)}
        >
          <option value="">Todas las categorías</option>
          {categories.map(cat => (
            <option key={cat.IdCategoriaGasto} value={cat.IdCategoriaGasto}>{cat.Categoria}</option>
          ))}
        </select>
        <input
          type="date" className={styles.filterDate}
          value={dateFrom} onChange={e => setDateFrom(e.target.value)}
        />
        <span className={styles.filterSep}>→</span>
        <input
          type="date" className={styles.filterDate}
          value={dateTo} onChange={e => setDateTo(e.target.value)}
        />
        {hasFilters && (
          <button className={styles.clearBtn} onClick={clearFilters}>Limpiar filtros</button>
        )}
      </div>

      <div className={styles.totalBar}>
        <span className={styles.totalLabel}>
          Total {hasFilters ? 'del filtro' : 'mostrado'} ({expenses.length} gasto{expenses.length !== 1 ? 's' : ''})
        </span>
        <span className={styles.totalValue}>{fmt(totalPeriodo)}</span>
      </div>

      <div className={`${styles.tableContainer} glass animate-fade`}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Concepto</th>
              <th>Categoría</th>
              <th>Proveedor</th>
              <th>Pago</th>
              <th>Monto</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className={styles.emptyCell}>Cargando...</td></tr>
            ) : expenses.length === 0 ? (
              <tr><td colSpan={7} className={styles.emptyCell}>No hay gastos registrados</td></tr>
            ) : expenses.map(g => (
              <tr key={g.IdGasto}>
                <td>{new Date(g.Fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                <td className={styles.concepto}>{g.Concepto}</td>
                <td><span className={styles.catBadge}>{g.Categoria || '—'}</span></td>
                <td className={styles.provider}>{g.Proveedor || '—'}</td>
                <td>{g.MetodoPago && <span className={styles.payBadge}>{g.MetodoPago}</span>}</td>
                <td className={styles.amount}>{fmt(g.Monto)}</td>
                <td>
                  <div className={styles.actions}>
                    <button className={styles.editBtn}   onClick={() => openModal(g)}><Edit2  size={15} /></button>
                    <button className={styles.deleteBtn} onClick={() => setConfirmDelete(g)}><Trash2 size={15} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Form Modal ── */}
      {isModalOpen && (
        <div className={styles.overlay}>
          <div className={`${styles.modal} glass animate-scale`}>
            <div className={styles.modalHead}>
              <h3>{editing ? 'Editar Gasto' : 'Nuevo Gasto'}</h3>
              <button onClick={() => setIsModalOpen(false)}><X size={20} /></button>
            </div>

            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Concepto *</label>
                <input
                  type="text" value={formData.Concepto} required autoFocus
                  placeholder="Ej: Pago de renta agosto"
                  onChange={e => setFormData({ ...formData, Concepto: e.target.value })}
                />
              </div>

              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Monto *</label>
                  <input
                    type="number" step="0.01" min="0.01" required
                    value={formData.Monto}
                    onChange={e => setFormData({ ...formData, Monto: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Fecha *</label>
                  <input
                    type="date" required
                    value={formData.Fecha}
                    onChange={e => setFormData({ ...formData, Fecha: e.target.value })}
                  />
                </div>
              </div>

              <div className={styles.catRow}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Categoría</label>
                  <select
                    value={formData.IdCategoriaGasto}
                    onChange={e => setFormData({ ...formData, IdCategoriaGasto: +e.target.value })}
                  >
                    <option value={0}>— Sin categoría —</option>
                    {categories.map(cat => (
                      <option key={cat.IdCategoriaGasto} value={cat.IdCategoriaGasto}>{cat.Categoria}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="button" className={styles.quickAddBtn}
                  title="Nueva categoría"
                  onClick={() => setQuickAddOpen(o => !o)}
                >
                  <Plus size={18} />
                </button>
              </div>

              {quickAddOpen && (
                <div className={styles.quickAddRow}>
                  <input
                    type="text"
                    placeholder="Nombre de la nueva categoría"
                    value={quickAddValue}
                    onChange={e => setQuickAddValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleQuickAddCategory(); } }}
                  />
                  <button
                    type="button" className={styles.quickAddConfirm}
                    disabled={quickAddSaving || !quickAddValue.trim()}
                    onClick={handleQuickAddCategory}
                  >
                    {quickAddSaving ? '...' : 'Agregar'}
                  </button>
                </div>
              )}

              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Método de pago</label>
                  <select
                    value={formData.MetodoPago}
                    onChange={e => setFormData({ ...formData, MetodoPago: e.target.value })}
                  >
                    {METODOS_PAGO.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Proveedor <small>(opcional)</small></label>
                  <input
                    type="text" value={formData.Proveedor}
                    placeholder="Ej: CFE, Arrendador..."
                    onChange={e => setFormData({ ...formData, Proveedor: e.target.value })}
                  />
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel}>Notas <small>(opcional)</small></label>
                <textarea
                  value={formData.Notas}
                  onChange={e => setFormData({ ...formData, Notas: e.target.value })}
                  placeholder="Detalles adicionales..."
                />
              </div>

              <button type="submit" className={styles.saveBtn} disabled={saving}>
                <Check size={18} />
                {saving ? 'Guardando...' : editing ? 'Guardar Cambios' : 'Crear Gasto'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Confirm Delete Modal ── */}
      {confirmDelete && (
        <div className={styles.overlay}>
          <div className={`${styles.confirmModal} glass animate-scale`}>
            <div className={styles.confirmIcon}>
              <AlertTriangle size={40} />
            </div>
            <h3>¿Eliminar Gasto?</h3>
            <p className={styles.confirmMsg}>
              Estás a punto de eliminar <strong>{confirmDelete.Concepto}</strong> ({fmt(confirmDelete.Monto)}).
              Esta acción no se puede deshacer.
            </p>
            <div className={styles.confirmBtns}>
              <button className={styles.cancelBtn} onClick={() => setConfirmDelete(null)} disabled={deleting}>
                Cancelar
              </button>
              <button className={styles.confirmDeleteBtn} onClick={handleConfirmDelete} disabled={deleting}>
                <Trash2 size={16} />
                {deleting ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
