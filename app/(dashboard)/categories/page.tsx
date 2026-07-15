'use client';

import { useState, useEffect } from 'react';
import { Tag, Plus, Edit2, Trash2, X, Check } from 'lucide-react';
import styles from './categories.module.css';

interface Category {
  IdCategoria: number;
  Categoria: string;
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading]       = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing]       = useState<Category | null>(null);
  const [saving, setSaving]         = useState(false);
  const [form, setForm]             = useState({ Categoria: '' });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const res  = await fetch('/api/categories');
    const data = await res.json();
    setCategories(data);
    setLoading(false);
  };

  const openModal = (cat: Category | null = null) => {
    if (cat) {
      setEditing(cat);
      setForm({ Categoria: cat.Categoria });
    } else {
      setEditing(null);
      setForm({ Categoria: '' });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const method = editing ? 'PUT' : 'POST';
    const url    = editing ? `/api/categories/${editing.IdCategoria}` : '/api/categories';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) { setIsModalOpen(false); fetchData(); }
      else        { alert('Error al guardar'); }
    } catch { alert('Error de conexión'); }
    finally  { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar esta categoría?')) return;
    const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
    if (res.ok) fetchData();
    else alert('No se puede eliminar (puede tener productos asociados)');
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleGroup}>
          <Tag size={30} color="var(--primary)" />
          <div>
            <h1>Categorías</h1>
            <p className={styles.subtitle}>Organiza tus productos por categoría</p>
          </div>
        </div>
        <button className={styles.addBtn} onClick={() => openModal()}>
          <Plus size={18} /> Nueva Categoría
        </button>
      </header>

      <div className={`${styles.grid} animate-fade`}>
        {loading ? (
          <p className={styles.empty}>Cargando...</p>
        ) : categories.length === 0 ? (
          <p className={styles.empty}>No hay categorías registradas</p>
        ) : (
          categories.map(cat => (
            <div key={cat.IdCategoria} className={`${styles.card} glass`}>
              <div className={styles.cardIcon}>
                <Tag size={24} />
              </div>
              <div className={styles.cardBody}>
                <h3 className={styles.catName}>{cat.Categoria}</h3>
              </div>
              <div className={styles.cardActions}>
                <button className={styles.editBtn}   onClick={() => openModal(cat)}><Edit2  size={15} /></button>
                <button className={styles.deleteBtn} onClick={() => handleDelete(cat.IdCategoria)}><Trash2 size={15} /></button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className={styles.overlay}>
          <div className={`${styles.modal} glass animate-scale`}>
            <div className={styles.modalHead}>
              <h3>{editing ? 'Editar Categoría' : 'Nueva Categoría'}</h3>
              <button onClick={() => setIsModalOpen(false)}><X size={20} /></button>
            </div>

            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.field}>
                <label>Nombre de la Categoría *</label>
                <input
                  type="text"
                  value={form.Categoria}
                  onChange={e => setForm({ ...form, Categoria: e.target.value })}
                  placeholder="Ej: Cuadernos, Lápices, Mochilas..."
                  required
                  autoFocus
                />
              </div>

              <button type="submit" className={styles.saveBtn} disabled={saving}>
                <Check size={18} />
                {saving ? 'Guardando...' : editing ? 'Guardar Cambios' : 'Crear Categoría'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
