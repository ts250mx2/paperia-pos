'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, ArrowUpRight, ArrowDownRight, Printer, CheckCircle2, X } from 'lucide-react';
import styles from './cash.module.css';

export default function CashPage() {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState('');
  const [movements, setMovements] = useState<any[]>([]);
  const [movementModal, setMovementModal] = useState<{ type: 'entrada' | 'salida' } | null>(null);
  const [movData, setMovData] = useState({ amount: '', concept: '' });
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    fetchStatus();
    fetchHistory();
  }, []);

  const fetchStatus = async () => {
    const res = await fetch('/api/cash/status');
    const data = await res.json();
    setStatus(data);
    setLoading(false);
    
    if (data.isOpen) {
      fetchMovements(data.session.IdApertura);
    }
  };

  const fetchMovements = async (idApertura: number) => {
    const res = await fetch(`/api/movements?idApertura=${idApertura}`);
    const data = await res.json();
    setMovements(data);
  };

  const fetchHistory = async () => {
    const res = await fetch('/api/cash/list');
    const data = await res.json();
    setHistory(data);
  };

  const handleOpen = async () => {
    if (!amount) return;
    const res = await fetch('/api/cash/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'open', amount: parseFloat(amount) })
    });
    if (res.ok) {
      const data = await res.json();
      fetch('/api/alerts/log', {
        method: 'POST',
        body: JSON.stringify({ message: 'APERTURA DE CAJA', idApertura: data.id })
      });
      window.open(`/print/apertura/${data.id}`, '_blank');
      fetchStatus();
    }
  };

  const handleMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!movData.amount || !movData.concept) return;

    const res = await fetch('/api/movements', {
      method: 'POST',
      body: JSON.stringify({
        ...movData,
        amount: parseFloat(movData.amount),
        type: movementModal?.type,
        idApertura: status.session.IdApertura
      })
    });

    if (res.ok) {
      const data = await res.json();
      setMovementModal(null);
      setMovData({ amount: '', concept: '' });
      window.open(`/print/movimiento/${data.id}`, '_blank');
      fetchMovements(status.session.IdApertura);
    }
  };

  const handleClose = async () => {
    if (!confirm('¿Estás seguro de cerrar la caja?')) return;

    // In a real app, calculate totals from tblVentas
    const totals = {
      efectivo: status.session.Efectivo || 0,
      tarjeta: status.session.Tarjeta || 0,
      total: status.session.TotalVentas || 0,
      descuentos: 0,
      cancelados: status.session.Cancelados || 0
    };
    
    const res = await fetch('/api/cash/action', {
      method: 'POST',
      body: JSON.stringify({ 
        action: 'close', 
        id: status.session.IdApertura,
        totals 
      })
    });

    if (res.ok) {
      alert('Corte generado con éxito');
      fetch('/api/alerts/log', {
        method: 'POST',
        body: JSON.stringify({ message: 'CORTE DE CAJA GENERADO', idApertura: status.session.IdApertura, isRed: 1 })
      });
      window.open(`/print/corte/${status.session.IdApertura}`, '_blank');
      fetchStatus();
      fetchHistory();
    }
  };

  if (loading) return <div>Cargando...</div>;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleGroup}>
          <TrendingUp size={32} color="var(--primary)" />
          <div>
            <h1>Control de Caja</h1>
            <p className={styles.subtitle}>Gestiona tus aperturas, cortes y movimientos</p>
          </div>
        </div>
      </header>

      {!status.isOpen ? (
        <div className={`${styles.card} glass animate-scale`}>
          <div className={styles.formIcon}><CheckCircle2 size={48} /></div>
          <h2>Apertura de Caja</h2>
          <p>Ingresa el fondo inicial para comenzar a vender</p>
          <div className={styles.inputGroup}>
            <label>Fondo de Caja ($)</label>
            <input 
              type="number" 
              placeholder="0.00" 
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
            />
          </div>
          <button className={styles.mainBtn} onClick={handleOpen}>
            Abrir Caja
          </button>
        </div>
      ) : (
        <div className={styles.dashboard}>
          <div className={styles.stats}>
            <div className={`${styles.statCard} glass`}>
              <span className={styles.statLabel}>Fondo Inicial</span>
              <span className={styles.statValue}>${status.session.FondoCaja.toFixed(2)}</span>
            </div>
            <div className={`${styles.statCard} glass`}>
              <span className={styles.statLabel}>Ventas Hoy</span>
              <span className={styles.statValue}>${(status.session.TotalVentas || 0).toFixed(2)}</span>
            </div>
            <div className={`${styles.statCard} glass`}>
              <span className={styles.statLabel}>Efectivo en Caja</span>
              <span className={styles.statValue}>${(status.session.FondoCaja + (status.session.Efectivo || 0) + movements.reduce((acc, m) => acc + m.Efectivo, 0)).toFixed(2)}</span>
            </div>
          </div>

          <div className={styles.mainGrid}>
            <div className={`${styles.section} glass`}>
              <div className={styles.sectionHeader}>
                <h3>Movimientos de Dinero</h3>
                <div className={styles.actions}>
                  <button className={styles.actionBtn} onClick={() => setMovementModal({ type: 'entrada' })}>
                    <ArrowUpRight size={18} /> Entrada
                  </button>
                  <button className={`${styles.actionBtn} ${styles.btnDanger}`} onClick={() => setMovementModal({ type: 'salida' })}>
                    <ArrowDownRight size={18} /> Salida
                  </button>
                </div>
              </div>
              <div className={styles.movTable}>
                {movements.length === 0 ? (
                  <p className={styles.emptyMsg}>No hay movimientos registrados</p>
                ) : (
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Hora</th>
                        <th>Concepto</th>
                        <th>Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movements.map((m, idx) => (
                        <tr key={idx}>
                          <td>{new Date(m.FechaRetiro).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                          <td>{m.Concepto}</td>
                          <td className={m.Efectivo >= 0 ? styles.positive : styles.negative}>
                            ${Math.abs(m.Efectivo).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className={`${styles.section} glass`}>
              <div className={styles.sectionHeader}>
                <h3>Ventas por Producto</h3>
              </div>
              <div className={styles.movTable}>
                {!status.session.products || status.session.products.length === 0 ? (
                  <p className={styles.emptyMsg}>No hay ventas registradas</p>
                ) : (
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th style={{ textAlign: 'center' }}>Cant.</th>
                        <th style={{ textAlign: 'right' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {status.session.products.map((p: any, idx: number) => (
                        <tr key={idx}>
                          <td>{p.Producto}</td>
                          <td style={{ textAlign: 'center' }}>{p.Cantidad}</td>
                          <td style={{ textAlign: 'right', fontWeight: '600' }}>
                            ${p.Total.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className={`${styles.section} glass`}>
              <h3>Corte de Caja</h3>
              <div className={styles.corteDetails}>
                <div className={styles.corteRow}>
                  <span>Ventas Efectivo</span>
                  <span>${(status.session.Efectivo || 0).toFixed(2)}</span>
                </div>
                <div className={styles.corteRow}>
                  <span>Ventas Tarjeta</span>
                  <span>${(status.session.Tarjeta || 0).toFixed(2)}</span>
                </div>
                <div className={styles.corteRow}>
                  <span>Ventas Transferencia</span>
                  <span>$0.00</span>
                </div>
                <div className={styles.corteRow}>
                  <span>Movimientos</span>
                  <span>${movements.reduce((acc, m) => acc + m.Efectivo, 0).toFixed(2)}</span>
                </div>
                <hr className={styles.divider} />
                <div className={`${styles.corteRow} ${styles.totalRow}`}>
                  <span>Total Ventas</span>
                  <span>${(status.session.TotalVentas || 0).toFixed(2)}</span>
                </div>
              </div>
              <div className={styles.footerBtns}>
                <button className={styles.printBtn} onClick={async () => {
                  fetch('/api/alerts/log', {
                    method: 'POST',
                    body: JSON.stringify({ message: 'VISUALIZACION DE PRE-CORTE', idApertura: status.session.IdApertura })
                  });
                  window.open(`/print/corte/${status.session.IdApertura}`, '_blank');
                }}>
                  <Printer size={18} /> Imprimir Pre-Corte
                </button>
                <button className={styles.closeCajaBtn} onClick={handleClose}>Cerrar Caja y Generar Corte</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Movement Modal */}
      {movementModal && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modal} glass animate-scale`}>
            <div className={styles.modalHeader}>
              <h3>Registrar {movementModal.type === 'entrada' ? 'Entrada' : 'Salida'}</h3>
              <button onClick={() => setMovementModal(null)}><X size={20} /></button>
            </div>
            <form onSubmit={handleMovement} className={styles.movForm}>
              <div className={styles.inputGroup}>
                <label>Monto ($)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  value={movData.amount}
                  onChange={(e) => setMovData({...movData, amount: e.target.value})}
                  required 
                  autoFocus 
                />
              </div>
              <div className={styles.inputGroup}>
                <label>Concepto / Motivo</label>
                <input 
                  type="text" 
                  value={movData.concept}
                  onChange={(e) => setMovData({...movData, concept: e.target.value})}
                  placeholder="Ej: Pago de proveedor, Refresco..." 
                  required 
                />
              </div>
              <button type="submit" className={movementModal.type === 'entrada' ? styles.mainBtn : `${styles.mainBtn} ${styles.btnDanger}`}>
                Guardar Movimiento
              </button>
            </form>
          </div>
        </div>
      )}
      {/* Historial de Cortes */}
      <div className={`${styles.section} glass`} style={{ marginTop: '2rem' }}>
        <div className={styles.sectionHeader}>
          <h3>Historial de Cortes Recientes</h3>
        </div>
        <div className={styles.movTable}>
          {history.length === 0 ? (
            <p className={styles.emptyMsg}>No hay historial disponible</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Apertura</th>
                  <th>Cierre</th>
                  <th>Ventas</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, idx) => (
                  <tr key={idx}>
                    <td>#{h.IdApertura}</td>
                    <td>{new Date(h.FechaApertura).toLocaleString()}</td>
                    <td>{h.FechaCierre ? new Date(h.FechaCierre).toLocaleString() : <span className={styles.positive}>ACTIVA</span>}</td>
                    <td>${Number(h.TotalVentas || 0).toFixed(2)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button 
                        className={styles.printBtn} 
                        style={{ padding: '4px 8px', fontSize: '12px' }}
                        onClick={() => window.open(`/print/corte/${h.IdApertura}`, '_blank')}
                      >
                        <Printer size={14} /> Reimprimir Corte
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
