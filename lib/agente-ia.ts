import Anthropic from '@anthropic-ai/sdk';
import { HlClienteError, configProxy, obtenerAgente } from './hl-cliente';

export type ProveedorIA = 'claude';

export interface CredencialIA {
  proveedor: ProveedorIA;
  modelo: string;
  baseURL: string;
  headers: Record<string, string>;
}

export const ERROR_SIN_IA =
  'El servicio de IA no está disponible en este momento. Intenta de nuevo en unos minutos.';

export async function credencialDeAgente(opciones: { forzar?: boolean } = {}): Promise<CredencialIA> {
  const { proveedor, modelo } = await obtenerAgente(opciones);
  if (proveedor.trim().toLowerCase() !== 'claude') {
    throw new HlClienteError(
      `HL Console asignó a Lapicito el proveedor "${proveedor}", pero esta aplicación solo admite Claude`,
    );
  }
  return { proveedor: 'claude', modelo, ...configProxy() };
}

export async function credencialParaRuta(): Promise<
  { ok: true; credencial: CredencialIA } | { ok: false; error: string }
> {
  try {
    return { ok: true, credencial: await credencialDeAgente() };
  } catch (error) {
    console.error('[hl] sin credencial para Lapicito:', error);
    return { ok: false, error: ERROR_SIN_IA };
  }
}

export function clienteAnthropic(credencial: CredencialIA): Anthropic {
  return new Anthropic({
    baseURL: credencial.baseURL,
    apiKey: 'hl',
    defaultHeaders: credencial.headers,
  });
}

function headerDeError(error: unknown, nombre: string): string | null {
  const headers = (error as { headers?: unknown }).headers;
  if (!headers) return null;
  if (typeof (headers as Headers).get === 'function') return (headers as Headers).get(nombre);
  const plano = headers as Record<string, string | undefined>;
  return plano[nombre] ?? plano[nombre.toLowerCase()] ?? null;
}

export function esCambioDeProveedor(error: unknown): boolean {
  const status = error instanceof Anthropic.APIError ? error.status : undefined;
  return status === 422 && headerDeError(error, 'x-hl-error') === 'PROVEEDOR_CAMBIADO';
}

export function refrescarCredencial(): Promise<CredencialIA> {
  return credencialDeAgente({ forzar: true });
}
