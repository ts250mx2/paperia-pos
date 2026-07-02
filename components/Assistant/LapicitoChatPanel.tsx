'use client';

import { useEffect, useRef, useState } from 'react';
import { Send, X, Database, Trash2, Maximize2, Minimize2 } from 'lucide-react';
import { useLapicitoChat, type ModelKey } from './LapicitoChatContext';
import styles from './LapicitoAssistant.module.css';

const MODEL_OPTIONS: { key: ModelKey; label: string }[] = [
  { key: 'haiku',  label: 'Haiku · rápido' },
  { key: 'sonnet', label: 'Sonnet · equilibrio' },
  { key: 'opus',   label: 'Opus · potente' },
];

const SUGGESTIONS = [
  '¿Cuánto vendí hoy?',
  'Top 5 productos del mes',
  'Ventas por categoría esta semana',
  '¿Cuál es mi hora pico de ventas?',
];

/* ── Avatar circular de Lapicito (lápiz rosa) ── */
export function LapicitoFace({ size = 40 }: { size?: number }) {
  return (
    <img
      src="/lapicito.jpg"
      alt="Lapicito"
      width={size}
      height={size}
      style={{
        borderRadius: '50%',
        objectFit: 'contain',
        backgroundColor: '#fff',
        border: '1px solid var(--border)',
        display: 'block',
      }}
    />
  );
}

/* ── Mini-formato: escapa HTML y aplica **negrita**, `código` y saltos de línea ── */
function renderContent(text: string): string {
  const esc = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return esc
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br/>');
}

interface LapicitoChatPanelProps {
  variant: 'widget' | 'page';
  onClose?: () => void;
  onMaximize?: () => void;
  onMinimize?: () => void;
}

export default function LapicitoChatPanel({ variant, onClose, onMaximize, onMinimize }: LapicitoChatPanelProps) {
  const { model, changeModel, messages, busy, send, clear } = useLapicitoChat();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const submit = (text: string) => {
    if (!text.trim() || busy) return;
    setInput('');
    send(text);
  };

  return (
    <>
      <header className={styles.header}>
        <div className={styles.brand}>
          <LapicitoFace size={variant === 'page' ? 40 : 34} />
          <div className={styles.brandText}>
            <span className={styles.name}>Lapicito</span>
            <span className={styles.sub}>{variant === 'page' ? 'Agente inteligente' : 'tu asistente'}</span>
          </div>
        </div>
        <div className={styles.headerActions}>
          <select
            className={styles.modelSelect}
            value={model}
            onChange={(e) => changeModel(e.target.value as ModelKey)}
            title="Modelo de IA"
          >
            {MODEL_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
          {messages.length > 0 && (
            <button className={styles.iconBtn} onClick={clear} title="Limpiar conversación">
              <Trash2 size={17} />
            </button>
          )}
          {onMaximize && (
            <button className={styles.iconBtn} onClick={onMaximize} title="Maximizar">
              <Maximize2 size={17} />
            </button>
          )}
          {onMinimize && (
            <button className={styles.iconBtn} onClick={onMinimize} title="Minimizar">
              <Minimize2 size={17} />
            </button>
          )}
          {onClose && (
            <button className={styles.iconBtn} onClick={onClose} title="Cerrar">
              <X size={18} />
            </button>
          )}
        </div>
      </header>

      <div className={styles.messages} ref={scrollRef}>
        {messages.length === 0 && (
          <div className={styles.welcome}>
            <LapicitoFace size={64} />
            <p className={styles.welcomeTitle}>¡Hola! Soy Lapicito ✏️</p>
            <p className={styles.welcomeText}>
              Pregúntame sobre tus ventas, productos, categorías o cajas. Consulto tus datos en tiempo real.
            </p>
            <div className={styles.suggestions}>
              {SUGGESTIONS.map((s) => (
                <button key={s} className={styles.suggestion} onClick={() => submit(s)}>{s}</button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`${styles.msg} ${m.role === 'user' ? styles.user : styles.assistant}`}>
            {m.role === 'assistant' && (
              <div className={styles.avatar}>
                <LapicitoFace size={26} />
              </div>
            )}
            <div className={`${styles.bubble} ${variant === 'page' ? styles.bubbleWide : ''}`}>
              {m.querying && (
                <div className={styles.querying}><Database size={13} /> Consultando la base de datos…</div>
              )}
              {m.content && (
                <div className={styles.text} dangerouslySetInnerHTML={{ __html: renderContent(m.content) }} />
              )}
              {m.streaming && !m.content && !m.querying && (
                <div className={styles.dots}><span /><span /><span /></div>
              )}
            </div>
          </div>
        ))}
      </div>

      <form
        className={styles.inputBar}
        onSubmit={(e) => { e.preventDefault(); submit(input); }}
      >
        <input
          className={styles.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escribe tu pregunta…"
          disabled={busy}
          autoFocus
        />
        <button className={styles.sendBtn} type="submit" disabled={busy || !input.trim()} title="Enviar">
          <Send size={18} />
        </button>
      </form>
    </>
  );
}
