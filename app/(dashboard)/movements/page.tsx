'use client';

import { useState, useEffect } from 'react';
import { DollarSign, Printer, XCircle, ChevronDown, Calendar, Hash, Tag } from 'lucide-react';
import styles from './movements.module.css';

export default function MovementsPage() {
  const [aperturas, setAperturas] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAperturas();
  }, []);

  const fetchAperturas = async () => {
    const res = await fetch('/api/cash/list');
    const data = await res.json();
    setAperturas(data);
    if (data.length > 0) {
      setSelectedId(data[0].IdApertura.toString());
      fetchTickets(data[0].IdApertura);
    }
  };

  const fetchTickets = async (id: number) => {
    setLoading(true);
    const res = await fetch(`/api/movements/tickets?idApertura=${id}`);
    const data = await res.json();
    setTickets(data);
    setLoading(false);
  };

  const handleSelectApertura = (id: string) => {
    setSelectedId(id);
    fetchTickets(parseInt(id));
  };

  const handleReprint = async (ticket: any) => {
    // 1. Log Alert
    await fetch('/api/sales/reprint-alert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idVenta: ticket.IdVenta, folio: ticket.Folio })
    });

    // 2. Open Print
    window.open(`/print/ticket/${ticket.IdVenta}`, '_blank', 'width=420,height=650');
  };

  const handleCancel = async (ticket: any) => {
    try {
      if (!confirm(`¿Estás seguro de cancelar la venta con folio #${ticket.Folio}? Esta acción no se puede deshacer.`)) return;

      const reason = prompt('Motivo de la cancelación:');
      if (!reason) return;

      console.log('Enviando cancelación para:', ticket.IdVenta);
      const res = await fetch('/api/sales/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idVenta: ticket.IdVenta, reason })
      });

      const data = await res.json();
      if (res.ok) {
        alert('✅ Venta cancelada correctamente');
        fetchTickets(parseInt(selectedId));
      } else {
        alert('❌ Error del servidor: ' + (data.message || 'Error desconocido'));
      }
    } catch (err: any) {
      console.error('Frontend Cancel Error:', err);
      alert('❌ Error de conexión: ' + err.message);
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleGroup}>
          <DollarSign size={32} color="var(--primary)" />
          <div>
            <h1>Movimientos y Tickets</h1>
            <p className={styles.subtitle}>Consulta el historial de ventas y gestiona cancelaciones</p>
          </div>
        </div>
      </header>

      <div className={styles.topActions}>
        <div className={styles.selectWrapper}>
          <label><Calendar size={16} /> Seleccionar Apertura</label>
          <div className={styles.customSelect}>
            <select 
              value={selectedId} 
              onChange={(e) => handleSelectApertura(e.target.value)}
            >
              {aperturas.map(a => (
                <option key={a.IdApertura} value={a.IdApertura}>
                  No. {a.IdApertura} - {new Date(a.FechaApertura).toLocaleDateString()} ({a.FechaCierre ? 'Cerrada' : 'Abierta'})
                </option>
              ))}
            </select>
            <ChevronDown className={styles.selectIcon} size={18} />
          </div>
        </div>
      </div>

      <div className={`${styles.mainCard} glass`}>
        {loading ? (
          <div className={styles.emptyMsg}>Cargando tickets...</div>
        ) : tickets.length === 0 ? (
          <div className={styles.emptyMsg}>No hay ventas en esta apertura</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th><Hash size={14} /> Folio</th>
                <th>Hora</th>
                <th><Tag size={14} /> Total</th>
                <th>Pago</th>
                <th>Estado</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map(ticket => (
                <tr key={ticket.IdVenta} className={ticket.Cancelada ? styles.cancelledRow : ''}>
                  <td className={styles.folio}>#{ticket.Folio}</td>
                  <td>{new Date(ticket.FechaVenta).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                  <td className={styles.total}>${ticket.Total.toFixed(2)}</td>
                  <td className={styles.pago}>
                    {ticket.Efectivo > 0 && <span className={styles.payBadge}>E</span>}
                    {ticket.Tarjeta > 0 && <span className={styles.payBadge}>T</span>}
                    {ticket.Transferencia > 0 && <span className={styles.payBadge}>Tr</span>}
                  </td>
                  <td>
                    {ticket.Cancelada ? (
                      <span className={styles.statusBadgeError}>Cancelado</span>
                    ) : (
                      <span className={styles.statusBadgeSuccess}>Pagado</span>
                    )}
                  </td>
                  <td className={styles.actions}>
                    <button 
                      className={styles.actionBtn} 
                      onClick={() => handleReprint(ticket)}
                      title="Reimprimir Ticket"
                    >
                      <Printer size={16} />
                    </button>
                    {!ticket.Cancelada && (
                      <button 
                        className={`${styles.actionBtn} ${styles.btnDanger}`} 
                        onClick={() => handleCancel(ticket)}
                        title="Cancelar Venta"
                      >
                        <XCircle size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
