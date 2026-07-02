'use client';

import { useState, useEffect } from 'react';
import { Settings, Save, Layout, List } from 'lucide-react';
import styles from './ticket-config.module.css';

export default function TicketConfigPage() {
  const [config, setConfig] = useState({
    Header1: '', Header2: '', Header3: '', Header4: '', Header5: '',
    Footer1: '', Footer2: '', Footer3: '',
    PrintKitchenDefault: 0, RequireCustomerName: 0
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    const res = await fetch('/api/config/ticket');
    const data = await res.json();
    setConfig(data);
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch('/api/config/ticket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    if (res.ok) alert('Configuración guardada correctamente');
    setSaving(false);
  };

  if (loading) return <div>Cargando...</div>;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleGroup}>
          <Settings size={32} color="var(--primary)" />
          <div>
            <h1>Configuración de Ticket</h1>
            <p className={styles.subtitle}>Personaliza los textos legales y de contacto en tus tickets</p>
          </div>
        </div>
      </header>

      <form onSubmit={handleSave} className={styles.formGrid}>
        <div className={`${styles.section} glass`}>
          <div className={styles.sectionTitle}>
            <Layout size={20} />
            <h2>Encabezado (5 líneas)</h2>
          </div>
          <div className={styles.inputs}>
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className={styles.inputGroup}>
                <label>Línea {i}</label>
                <input 
                  type="text" 
                  value={(config as any)[`Header${i}`] || ''} 
                  onChange={(e) => setConfig({...config, [`Header${i}`]: e.target.value})}
                  placeholder={`Texto del encabezado ${i}...`}
                />
              </div>
            ))}
          </div>
        </div>

        <div className={`${styles.section} glass`}>
          <div className={styles.sectionTitle}>
            <List size={20} />
            <h2>Pie de Página (3 líneas)</h2>
          </div>
          <div className={styles.inputs}>
            {[1, 2, 3].map(i => (
              <div key={i} className={styles.inputGroup}>
                <label>Línea {i}</label>
                <input 
                  type="text" 
                  value={(config as any)[`Footer${i}`] || ''} 
                  onChange={(e) => setConfig({...config, [`Footer${i}`]: e.target.value})}
                  placeholder={`Texto del pie de página ${i}...`}
                />
              </div>
            ))}
          </div>
          
          <div className={styles.preview}>
            <h3>Vista Previa</h3>
            <div className={styles.ticketMockup}>
              <div className={styles.mockHeader}>
                {config.Header1 && <div>{config.Header1}</div>}
                {config.Header2 && <div>{config.Header2}</div>}
                {config.Header3 && <div>{config.Header3}</div>}
              </div>
              <div className={styles.mockDivider}></div>
              <div className={styles.mockBody}>CONTENIDO DEL TICKET</div>
              <div className={styles.mockDivider}></div>
              <div className={styles.mockFooter}>
                {config.Footer1 && <div>{config.Footer1}</div>}
                {config.Footer2 && <div>{config.Footer2}</div>}
                {config.Footer3 && <div>{config.Footer3}</div>}
              </div>
            </div>
          </div>
        </div>

        <div className={`${styles.section} glass`}>
          <div className={styles.sectionTitle}>
            <Settings size={20} />
            <h2>Opciones de Funcionamiento</h2>
          </div>
          <div className={styles.inputs}>
            <div className={styles.inputGroup} style={{ flexDirection: 'row', alignItems: 'center', gap: '10px' }}>
              <input 
                type="checkbox" 
                id="PrintKitchenDefault"
                checked={!!config.PrintKitchenDefault} 
                onChange={(e) => setConfig({...config, PrintKitchenDefault: e.target.checked ? 1 : 0})}
                style={{ width: '20px', height: '20px' }}
              />
              <label htmlFor="PrintKitchenDefault" style={{ margin: 0 }}>Imprimir en cocina por defecto</label>
            </div>
            <div className={styles.inputGroup} style={{ flexDirection: 'row', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
              <input 
                type="checkbox" 
                id="RequireCustomerName"
                checked={!!config.RequireCustomerName} 
                onChange={(e) => setConfig({...config, RequireCustomerName: e.target.checked ? 1 : 0})}
                style={{ width: '20px', height: '20px' }}
              />
              <label htmlFor="RequireCustomerName" style={{ margin: 0 }}>Nombre del cliente obligatorio</label>
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <button type="submit" className={styles.saveBtn} disabled={saving}>
            <Save size={18} /> {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </form>
    </div>
  );
}
