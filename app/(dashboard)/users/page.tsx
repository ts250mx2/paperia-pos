'use client';

import { useState, useEffect } from 'react';
import { Users, Plus, Edit2, Trash2, X, Check, Eye, EyeOff, ShieldCheck, User } from 'lucide-react';
import styles from './users.module.css';

interface UserRow {
  IdUsuario: number;
  Usuario: string;
  IdPuesto: number;
  Login: string;
  Status: number;
}

const PUESTOS: Record<number, string> = {
  1: 'Administrador',
  2: 'Cajero',
  3: 'Mesero',
};

const emptyForm = { Usuario: '', Login: '', Password: '', IdPuesto: 2, Status: 1 };

export default function UsersPage() {
  const [users, setUsers]         = useState<UserRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing]     = useState<UserRow | null>(null);
  const [saving, setSaving]       = useState(false);
  const [showPwd, setShowPwd]     = useState(false);
  const [form, setForm]           = useState(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState<UserRow | null>(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const res  = await fetch('/api/users');
    const data = await res.json();
    setUsers(data);
    setLoading(false);
  };

  const openModal = (user: UserRow | null = null) => {
    if (user) {
      setEditing(user);
      setForm({ Usuario: user.Usuario, Login: user.Login, Password: '', IdPuesto: user.IdPuesto, Status: user.Status });
    } else {
      setEditing(null);
      setForm(emptyForm);
    }
    setShowPwd(false);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const method = editing ? 'PUT' : 'POST';
    const url    = editing ? `/api/users/${editing.IdUsuario}` : '/api/users';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) { setIsModalOpen(false); fetchData(); }
      else {
        const data = await res.json();
        alert(data.message || 'Error al guardar');
      }
    } catch { alert('Error de conexión'); }
    finally  { setSaving(false); }
  };

  const handleDelete = async (user: UserRow) => {
    const res = await fetch(`/api/users/${user.IdUsuario}`, { method: 'DELETE' });
    if (res.ok) { setDeleteConfirm(null); fetchData(); }
    else alert('No se pudo eliminar el usuario');
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleGroup}>
          <Users size={30} color="var(--primary)" />
          <div>
            <h1>Usuarios</h1>
            <p className={styles.subtitle}>Gestiona los accesos y roles del sistema</p>
          </div>
        </div>
        <button className={styles.addBtn} onClick={() => openModal()}>
          <Plus size={18} /> Nuevo Usuario
        </button>
      </header>

      <div className={`${styles.tableWrap} animate-fade`}>
        {loading ? (
          <p className={styles.empty}>Cargando...</p>
        ) : users.length === 0 ? (
          <p className={styles.empty}>No hay usuarios registrados</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>#</th>
                <th>Nombre</th>
                <th>Login</th>
                <th>Puesto</th>
                <th>Status</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.IdUsuario}>
                  <td className={styles.idCell}>{u.IdUsuario}</td>
                  <td>
                    <div className={styles.userCell}>
                      <div className={styles.avatar}>
                        {u.IdPuesto === 1 ? <ShieldCheck size={16} /> : <User size={16} />}
                      </div>
                      <span>{u.Usuario}</span>
                    </div>
                  </td>
                  <td><code className={styles.loginCode}>{u.Login}</code></td>
                  <td>
                    <span className={`${styles.badge} ${u.IdPuesto === 1 ? styles.badgeAdmin : styles.badgeUser}`}>
                      {PUESTOS[u.IdPuesto] ?? `Puesto ${u.IdPuesto}`}
                    </span>
                  </td>
                  <td>
                    <span className={`${styles.status} ${u.Status === 1 ? styles.active : styles.inactive}`}>
                      {u.Status === 1 ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td>
                    <div className={styles.actions}>
                      <button className={styles.editBtn}   onClick={() => openModal(u)}><Edit2  size={15} /></button>
                      <button className={styles.deleteBtn} onClick={() => setDeleteConfirm(u)}><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Create / Edit Modal ── */}
      {isModalOpen && (
        <div className={styles.overlay}>
          <div className={`${styles.modal} glass animate-scale`}>
            <div className={styles.modalHead}>
              <h3>{editing ? 'Editar Usuario' : 'Nuevo Usuario'}</h3>
              <button onClick={() => setIsModalOpen(false)}><X size={20} /></button>
            </div>

            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.field}>
                <label>Nombre completo *</label>
                <input
                  type="text"
                  value={form.Usuario}
                  onChange={e => setForm({ ...form, Usuario: e.target.value })}
                  placeholder="Ej: Juan García"
                  required autoFocus
                />
              </div>

              <div className={styles.row2}>
                <div className={styles.field}>
                  <label>Login *</label>
                  <input
                    type="text"
                    value={form.Login}
                    onChange={e => setForm({ ...form, Login: e.target.value })}
                    placeholder="Ej: jgarcia"
                    required
                  />
                </div>

                <div className={styles.field}>
                  <label>{editing ? 'Contraseña (dejar vacío = no cambiar)' : 'Contraseña *'}</label>
                  <div className={styles.pwdWrap}>
                    <input
                      type={showPwd ? 'text' : 'password'}
                      value={form.Password}
                      onChange={e => setForm({ ...form, Password: e.target.value })}
                      placeholder="••••••••"
                      required={!editing}
                    />
                    <button type="button" className={styles.eyeBtn} onClick={() => setShowPwd(v => !v)}>
                      {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              <div className={styles.row2}>
                <div className={styles.field}>
                  <label>Puesto</label>
                  <select value={form.IdPuesto} onChange={e => setForm({ ...form, IdPuesto: Number(e.target.value) })}>
                    <option value={1}>Administrador</option>
                    <option value={2}>Cajero</option>
                    <option value={3}>Mesero</option>
                  </select>
                </div>

                <div className={styles.field}>
                  <label>Status</label>
                  <select value={form.Status} onChange={e => setForm({ ...form, Status: Number(e.target.value) })}>
                    <option value={1}>Activo</option>
                    <option value={0}>Inactivo</option>
                  </select>
                </div>
              </div>

              <button type="submit" className={styles.saveBtn} disabled={saving}>
                <Check size={18} />
                {saving ? 'Guardando...' : editing ? 'Guardar Cambios' : 'Crear Usuario'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete confirm modal ── */}
      {deleteConfirm && (
        <div className={styles.overlay}>
          <div className={`${styles.deleteModal} glass animate-scale`}>
            <div className={styles.deleteIcon}><Trash2 size={32} /></div>
            <h3>¿Eliminar usuario?</h3>
            <p>Esta acción no se puede deshacer. Se eliminará a <strong>{deleteConfirm.Usuario}</strong> permanentemente.</p>
            <div className={styles.deleteBtns}>
              <button className={styles.cancelBtn} onClick={() => setDeleteConfirm(null)}>Cancelar</button>
              <button className={styles.confirmDeleteBtn} onClick={() => handleDelete(deleteConfirm)}>Sí, eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
