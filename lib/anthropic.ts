import Anthropic from '@anthropic-ai/sdk';

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Modelos disponibles para el asistente Lapicito.
 * El usuario elige entre los 3 desde el chat.
 *  - haiku  → el más rápido y económico (sin razonamiento profundo)
 *  - sonnet → equilibrio velocidad / inteligencia
 *  - opus   → el más potente (default)
 */
export type ModelKey = 'haiku' | 'sonnet' | 'opus';

interface ModelConfig {
  id: string;
  label: string;
  /** Soporta thinking adaptativo */
  thinking: boolean;
  /** Soporta el parámetro effort (output_config.effort) */
  effort: boolean;
}

export const MODELS: Record<ModelKey, ModelConfig> = {
  haiku:  {
    id: process.env.ANTHROPIC_MODEL_HAIKU || 'claude-haiku-4-5',
    label: 'Haiku · rápido',
    thinking: process.env.ANTHROPIC_MODEL_HAIKU_THINKING === 'true',
    effort: process.env.ANTHROPIC_MODEL_HAIKU_EFFORT === 'true'
  },
  sonnet: {
    id: process.env.ANTHROPIC_MODEL_SONNET || 'claude-sonnet-4-6',
    label: 'Sonnet · equilibrio',
    thinking: process.env.ANTHROPIC_MODEL_SONNET_THINKING !== 'false',
    effort: process.env.ANTHROPIC_MODEL_SONNET_EFFORT !== 'false'
  },
  opus:   {
    id: process.env.ANTHROPIC_MODEL_OPUS || 'claude-opus-4-8',
    label: 'Opus · potente',
    thinking: process.env.ANTHROPIC_MODEL_OPUS_THINKING !== 'false',
    effort: process.env.ANTHROPIC_MODEL_OPUS_EFFORT !== 'false'
  },
};

export function resolveModel(key: string | undefined | null): { key: ModelKey; config: ModelConfig } {
  const k: ModelKey = key === 'haiku' || key === 'sonnet' || key === 'opus' ? key : 'opus';
  const config = { ...MODELS[k] };
  if (process.env.ANTHROPIC_MODEL) {
    config.id = process.env.ANTHROPIC_MODEL;
  }
  return { key: k, config };
}
