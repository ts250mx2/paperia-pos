'use client';

import { useState, useEffect, useRef } from 'react';
import { Package, Search, Plus, Edit2, Trash2, Upload, X, Check, AlertTriangle } from 'lucide-react';
import styles from './products.module.css';

interface Product {
  IdProducto: number;
  Producto: string;
  Precio1: number;
  Precio2: number;
  Precio3: number;
  Multiple: number;
  IdCategoria: number;
  Categoria?: string;
  Status: number;
  ArchivoImagen?: string | null;
}

interface Category {
  IdCategoria: number;
  Categoria: string;
  EsExtra: number;
}

const BLANK_FORM = {
  Producto: '',
  Precio1: 0,
  Precio2: 0,
  Precio3: 0,
  Multiple: 0,
  IdCategoria: 0,
  Status: 0,
  ArchivoImagen: null as string | null,
};

export default function ProductsPage() {
  const [products, setProducts]         = useState<Product[]>([]);
  const [categories, setCategories]     = useState<Category[]>([]);
  const [searchTerm, setSearchTerm]     = useState('');
  const [loading, setLoading]           = useState(true);
  const [isModalOpen, setIsModalOpen]   = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData]         = useState({ ...BLANK_FORM });
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving, setSaving]             = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Product | null>(null); // ← confirm modal
  const [deleting, setDeleting]         = useState(false);
  const fileRef                         = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const res  = await fetch('/api/products');
    const data = await res.json();
    setProducts(data.products);
    setCategories(data.categories);
    setLoading(false);
  };

  /* ── Image picker → Base64 ── */
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert('La imagen no debe superar 2 MB'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string;
      setImagePreview(base64);
      setFormData(prev => ({ ...prev, ArchivoImagen: base64 }));
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImagePreview(null);
    setFormData(prev => ({ ...prev, ArchivoImagen: null }));
    if (fileRef.current) fileRef.current.value = '';
  };

  /* ── Open form modal ── */
  const handleOpenModal = (product: Product | null = null) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        Producto:      product.Producto,
        Precio1:       product.Precio1,
        Precio2:       product.Precio2 || 0,
        Precio3:       product.Precio3 || 0,
        Multiple:      product.Multiple,
        IdCategoria:   product.IdCategoria,
        Status:        product.Status,
        ArchivoImagen: product.ArchivoImagen || null,
      });
      setImagePreview(product.ArchivoImagen || null);
    } else {
      setEditingProduct(null);
      setFormData({ ...BLANK_FORM, IdCategoria: categories[0]?.IdCategoria || 0 });
      setImagePreview(null);
    }
    setIsModalOpen(true);
  };

  /* ── Save ── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const method = editingProduct ? 'PUT' : 'POST';
    const url    = editingProduct ? `/api/products/${editingProduct.IdProducto}` : '/api/products';
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

  /* ── Confirm delete ── */
  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/products/${confirmDelete.IdProducto}`, { method: 'DELETE' });
      if (res.ok) { setConfirmDelete(null); fetchData(); }
      else        { alert('Error al eliminar el producto'); }
    } catch { alert('Error de conexión'); }
    finally   { setDeleting(false); }
  };

  const filtered = products.filter(p =>
    p.Producto.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.Categoria || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const Thumb = ({ src }: { src?: string | null }) =>
    src ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="Producto" className={styles.thumb} />
    ) : (
      <div className={styles.thumbEmpty}><Package size={18} /></div>
    );

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleGroup}>
          <Package size={30} color="var(--primary)" />
          <div>
            <h1>Catálogo de Productos</h1>
            <p className={styles.subtitle}>Gestiona productos, precios e imágenes</p>
          </div>
        </div>
        <button className={styles.addBtn} onClick={() => handleOpenModal()}>
          <Plus size={18} /> Nuevo Producto
        </button>
      </header>

      <div className={`${styles.searchBar} glass`}>
        <Search size={18} className={styles.searchIcon} />
        <input
          type="text"
          placeholder="Buscar por nombre o categoría..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      <div className={`${styles.tableContainer} glass animate-fade`}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Foto</th>
              <th>Producto</th>
              <th>Categoría</th>
              <th>Precio 1</th>
              <th>Precio 2</th>
              <th>Precio 3</th>
              <th>Extras</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className={styles.emptyCell}>Cargando...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className={styles.emptyCell}>No hay productos</td></tr>
            ) : filtered.map(p => (
              <tr key={p.IdProducto}>
                <td><Thumb src={p.ArchivoImagen} /></td>
                <td className={styles.productName}>{p.Producto}</td>
                <td><span className={styles.catBadge}>{p.Categoria || '—'}</span></td>
                <td className={styles.price}>${p.Precio1.toFixed(2)}</td>
                <td className={styles.price}>{p.Precio2 > 0 ? `$${p.Precio2.toFixed(2)}` : '—'}</td>
                <td className={styles.price}>{p.Precio3 > 0 ? `$${p.Precio3.toFixed(2)}` : '—'}</td>
                <td>
                  <span className={p.Multiple === 1 ? styles.yes : styles.no}>
                    {p.Multiple === 1 ? 'Sí' : 'No'}
                  </span>
                </td>
                <td>
                  <div className={styles.actions}>
                    <button className={styles.editBtn}   onClick={() => handleOpenModal(p)}><Edit2  size={15} /></button>
                    <button className={styles.deleteBtn} onClick={() => setConfirmDelete(p)}><Trash2 size={15} /></button>
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
              <h3>{editingProduct ? 'Editar Producto' : 'Nuevo Producto'}</h3>
              <button onClick={() => setIsModalOpen(false)}><X size={20} /></button>
            </div>

            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.imageSection}>
                <label className={styles.fieldLabel}>Foto del Producto</label>
                {imagePreview ? (
                  <div className={styles.previewWrapper}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imagePreview} alt="Preview" className={styles.preview} />
                    <button type="button" className={styles.removeImg} onClick={removeImage}>
                      <X size={14} /> Quitar foto
                    </button>
                  </div>
                ) : (
                  <button type="button" className={styles.uploadZone} onClick={() => fileRef.current?.click()}>
                    <Upload size={28} />
                    <span>Haz clic para subir imagen</span>
                    <small>JPG, PNG o WEBP · máx 2 MB</small>
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp"
                  style={{ display: 'none' }} onChange={handleImageChange} />
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel}>Nombre del Producto *</label>
                <input type="text" value={formData.Producto}
                  onChange={e => setFormData({ ...formData, Producto: e.target.value })} required />
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel}>Categoría *</label>
                <select value={formData.IdCategoria}
                  onChange={e => setFormData({ ...formData, IdCategoria: +e.target.value })}>
                  <option value={0}>— Selecciona —</option>
                  {categories.map(cat => (
                    <option key={cat.IdCategoria} value={cat.IdCategoria}>
                      {cat.Categoria}{cat.EsExtra === 1 ? ' (Extras)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.priceGrid}>
                {([1,2,3] as const).map(n => (
                  <div key={n} className={styles.field}>
                    <label className={styles.fieldLabel}>Precio {n} {n > 1 && <small>(opcional)</small>}</label>
                    <input type="number" step="0.01" min="0"
                      value={(formData as any)[`Precio${n}`]}
                      onChange={e => setFormData({ ...formData, [`Precio${n}`]: parseFloat(e.target.value) || 0 })}
                      required={n === 1} />
                  </div>
                ))}
              </div>

              <label className={styles.toggle}>
                <div className={`${styles.toggleTrack} ${formData.Multiple === 1 ? styles.on : ''}`}
                  onClick={() => setFormData({ ...formData, Multiple: formData.Multiple === 1 ? 0 : 1 })}>
                  <div className={styles.toggleThumb} />
                </div>
                <span>Permite Aditamentos / Extras</span>
              </label>

              <button type="submit" className={styles.saveBtn} disabled={saving}>
                <Check size={18} />
                {saving ? 'Guardando...' : editingProduct ? 'Guardar Cambios' : 'Crear Producto'}
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
            <h3>¿Eliminar Producto?</h3>
            <p className={styles.confirmMsg}>
              Estás a punto de eliminar <strong>{confirmDelete.Producto}</strong>.
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
