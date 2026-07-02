'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

export type ModelKey = 'haiku' | 'sonnet' | 'opus';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
  querying?: boolean;
}

interface LapicitoChatCtx {
  model: ModelKey;
  changeModel: (m: ModelKey) => void;
  messages: ChatMessage[];
  busy: boolean;
  send: (text: string) => Promise<void>;
  clear: () => void;
}

const LapicitoChatContext = createContext<LapicitoChatCtx | null>(null);

// Comparte la conversación entre el widget flotante y la página de pantalla
// completa "/agente-inteligente", para que "maximizar" no pierda el hilo.
export function LapicitoChatProvider({ children }: { children: ReactNode }) {
  const [model, setModel] = useState<ModelKey>('opus');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const m = localStorage.getItem('lapicito_model');
    if (m === 'haiku' || m === 'sonnet' || m === 'opus') setModel(m);
  }, []);

  const changeModel = (m: ModelKey) => {
    setModel(m);
    localStorage.setItem('lapicito_model', m);
  };

  const clear = () => setMessages([]);

  const send = async (text: string) => {
    const prompt = text.trim();
    if (!prompt || busy) return;

    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: prompt },
      { role: 'assistant', content: '', streaming: true },
    ]);
    setBusy(true);

    const patchLast = (patch: Partial<ChatMessage>) =>
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === 'assistant') next[next.length - 1] = { ...last, ...patch };
        return next;
      });

    const appendText = (chunk: string) =>
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === 'assistant') {
          next[next.length - 1] = { ...last, content: last.content + chunk, querying: false };
        }
        return next;
      });

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, model, history }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        let msg = 'No pude conectarme. Revisa la configuración del asistente.';
        try { msg = (await res.json())?.error || msg; } catch { /* ignore */ }
        patchLast({ content: `⚠️ ${msg}`, streaming: false, querying: false });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          let evt: any;
          try { evt = JSON.parse(trimmed); } catch { continue; }
          if (evt.type === 'text') appendText(evt.text);
          else if (evt.type === 'tool') patchLast({ querying: true });
          else if (evt.type === 'error') patchLast({ content: `⚠️ ${evt.message}`, streaming: false, querying: false });
          else if (evt.type === 'done') patchLast({ streaming: false, querying: false });
        }
      }
      patchLast({ streaming: false, querying: false });
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        patchLast({ content: '⚠️ Se interrumpió la conexión.', streaming: false, querying: false });
      } else {
        patchLast({ streaming: false, querying: false });
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  return (
    <LapicitoChatContext.Provider value={{ model, changeModel, messages, busy, send, clear }}>
      {children}
    </LapicitoChatContext.Provider>
  );
}

export function useLapicitoChat(): LapicitoChatCtx {
  const ctx = useContext(LapicitoChatContext);
  if (!ctx) throw new Error('useLapicitoChat debe usarse dentro de <LapicitoChatProvider>');
  return ctx;
}
