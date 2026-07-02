import Anthropic from '@anthropic-ai/sdk';
import { anthropic, resolveModel } from '@/lib/anthropic';
import { assertReadOnly } from '@/lib/sql-sandbox';
import pool from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_TOOL_ITERATIONS = 8;   // evita loops infinitos / costos descontrolados
const MAX_HISTORY_TURNS = 12;    // pares user/assistant que conservamos como contexto

// ── Esquema de la base de datos (BDPaperia) que el agente puede consultar ──────
const DB_SCHEMA = `
Base de datos MySQL del POS de La Paperia (papelería). Tablas y columnas relevantes:

tblVentas (v): IdVenta, IdApertura, Folio, Total(double), FechaVenta(datetime), Cliente, Nombre,
  Efectivo(double), Tarjeta(double), Transferencia(double), Envio(double), Descuento(double),
  Cancelada(int 0/1), IdVendedor, IdUsuarioPago, IdMesa, VentaEn.
  -> Una fila por ticket. Para ventas VÁLIDAS filtra SIEMPRE v.Cancelada = 0.
  -> IMPORTANTE: IdVenta NO es único por sí solo (es un folio secuencial POR apertura).
     La clave única de un ticket es (IdVenta, IdApertura). Para agregados de importe usa
     directamente tblVentas (v.Total); NO multipliques uniendo con detalle sin la clave completa.

tblDetalleVentas (d): IdDetalleVenta, IdVenta, IdProducto, Cantidad(double), Precio(double),
  Descuento(double), IVA(double), Fecha(datetime), IdApertura, EsExtra.
  -> Renglones de cada ticket. Importe del renglón = d.Cantidad * d.Precio. Une con tblVentas por IdVenta.

tblProductos (p): IdProducto, Producto(varchar), Precio1, Precio2, Precio3, IVA, Status(int), IdCategoria,
  CodigoBarras(varchar), Codigo(varchar), Costo(double), CantidadVentas(int).
  -> Status: 2 = eliminado/oculto. Para productos activos filtra p.Status <> 2.

tblCategorias (c): IdCategoria, Categoria(varchar), EsExtra(int).

tblUsuarios (u): IdUsuario, Usuario(varchar), IdPuesto(int: 1=Administrador,2=Cajero,3=Mesero), Login, Status.

tblAperturasCierres (a): IdApertura, FechaApertura, FechaCierre, IdCajero, FondoCaja, Efectivo,
  TotalVentas, Tarjeta, Descuentos, Devoluciones, Cancelados. -> Cortes de caja / aperturas.

tblRetiros: IdRetiro, IdApertura, Efectivo(double), Concepto, Fecha(datetime), IdSupervisor.

tblDetalleCancelaciones: IdCancelacion, IdApertura, IdProducto, Cantidad, Precio, FechaCancelacion, IdUsuarioCancelacion.

tblMovimientos/retiros se registran por apertura. Relaciones:
  tblDetalleVentas (d) con tblVentas (v): d.IdVenta = v.IdVenta AND d.IdApertura = v.IdApertura
    (SIEMPRE por la clave compuesta, de lo contrario los importes se inflan por fan-out)
  tblDetalleVentas.IdProducto = tblProductos.IdProducto
  tblProductos.IdCategoria = tblCategorias.IdCategoria
  tblVentas.IdVendedor / IdUsuarioPago = tblUsuarios.IdUsuario
`.trim();

function buildSystemPrompt(): string {
  const hoy = new Date().toLocaleDateString('es-MX', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  return `Eres "Lapicito", el asistente inteligente del punto de venta de La Paperia (una papelería).
Eres amable, directo y respondes SIEMPRE en español, con un tono cálido y cercano (la marca es alegre y colorida).

Fecha de hoy: ${hoy}.

Tu superpoder es consultar la base de datos del negocio para responder preguntas reales sobre ventas,
productos, categorías, cajas, cancelaciones y usuarios. Usa la herramienta "query_database" para ello.

REGLAS PARA CONSULTAR:
- Escribe SQL de MySQL, SOLO de lectura (SELECT / WITH). Nunca intentes modificar datos.
- Para ventas válidas filtra siempre v.Cancelada = 0.
- Para fechas usa funciones MySQL: CURDATE(), DATE(v.FechaVenta), DATE_SUB(CURDATE(), INTERVAL N DAY),
  DATE_FORMAT(...), HOUR(...), DAYOFWEEK(...).
- El importe de un producto vendido es d.Cantidad * d.Precio (en tblDetalleVentas).
- Agrupa, ordena y usa LIMIT cuando tenga sentido. Pide aclaración solo si la pregunta es realmente ambigua.
- Puedes hacer varias consultas si necesitas cruzar información.
- Después de obtener los datos, RESPONDE de forma clara: da el número/conclusión primero, con contexto útil.
  Usa montos en pesos (formato $1,234.50) y, cuando ayude, una tabla breve en markdown.

Si la pregunta NO requiere datos (saludo, ayuda, explicación), responde directamente sin consultar.

Esquema disponible:
${DB_SCHEMA}`;
}

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'query_database',
    description:
      'Ejecuta una consulta SQL de SOLO LECTURA (SELECT/WITH) contra la base de datos MySQL del POS de La Paperia y devuelve las filas en JSON. Úsala para responder preguntas sobre ventas, productos, categorías, cajas, cancelaciones y usuarios.',
    input_schema: {
      type: 'object',
      properties: {
        sql: {
          type: 'string',
          description: 'Consulta MySQL de solo lectura (SELECT o WITH). Un solo statement, sin punto y coma final.',
        },
      },
      required: ['sql'],
    },
  },
];

interface IncomingTurn {
  role: 'user' | 'assistant';
  content: string;
}

async function runQuery(sql: string): Promise<{ ok: boolean; text: string }> {
  let clean: string;
  try {
    clean = assertReadOnly(sql);
  } catch (e: any) {
    return { ok: false, text: e.message };
  }
  try {
    const [rows] = await pool.query(clean);
    const arr = Array.isArray(rows) ? (rows as any[]) : [];
    const capped = arr.slice(0, 200);
    let json = JSON.stringify(capped);
    if (json.length > 60000) json = json.slice(0, 60000) + ' …(truncado)';
    const note = arr.length > capped.length ? ` (mostrando ${capped.length} de ${arr.length} filas)` : '';
    return { ok: true, text: `Filas: ${arr.length}${note}\n${json}` };
  } catch (e: any) {
    return { ok: false, text: `Error de SQL: ${e.message}` };
  }
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: 'Falta configurar ANTHROPIC_API_KEY en el archivo .env del servidor.' },
      { status: 500 },
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Cuerpo inválido' }, { status: 400 });
  }

  const prompt: string = (body?.prompt ?? '').toString().trim();
  if (!prompt) {
    return Response.json({ error: 'Falta el mensaje (prompt)' }, { status: 400 });
  }

  const { config } = resolveModel(body?.model);
  const rawHistory: IncomingTurn[] = Array.isArray(body?.history) ? body.history : [];

  // Construye los mensajes: historial reciente + el turno actual del usuario
  const messages: Anthropic.MessageParam[] = rawHistory
    .filter((t) => (t.role === 'user' || t.role === 'assistant') && typeof t.content === 'string' && t.content.trim())
    .slice(-MAX_HISTORY_TURNS * 2)
    .map((t) => ({ role: t.role, content: t.content.slice(0, 8000) }));
  messages.push({ role: 'user', content: prompt });

  const system = buildSystemPrompt();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
        } catch {
          /* stream cerrado */
        }
      };

      try {
        for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
          const params: Anthropic.MessageCreateParamsStreaming = {
            model: config.id,
            max_tokens: 8000,
            system,
            tools: TOOLS,
            messages,
            stream: true,
          };
          if (config.thinking) {
            (params as any).thinking = { type: 'adaptive' };
          }
          if (config.effort) {
            (params as any).output_config = { effort: 'medium' };
          }

          const mstream = anthropic.messages.stream(params);

          for await (const event of mstream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              send({ type: 'text', text: event.delta.text });
            }
          }

          const msg = await mstream.finalMessage();
          // Preserva el contenido completo (incluye bloques de thinking firmados)
          messages.push({ role: 'assistant', content: msg.content });

          if (msg.stop_reason !== 'tool_use') {
            break;
          }

          const toolUses = msg.content.filter(
            (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
          );

          const toolResults: Anthropic.ToolResultBlockParam[] = [];
          for (const tu of toolUses) {
            if (tu.name === 'query_database') {
              const sql = (tu.input as any)?.sql ?? '';
              send({ type: 'tool', sql });
              const result = await runQuery(sql);
              toolResults.push({
                type: 'tool_result',
                tool_use_id: tu.id,
                content: result.text,
                is_error: !result.ok,
              });
            } else {
              toolResults.push({
                type: 'tool_result',
                tool_use_id: tu.id,
                content: `Herramienta desconocida: ${tu.name}`,
                is_error: true,
              });
            }
          }

          messages.push({ role: 'user', content: toolResults });
        }

        send({ type: 'done' });
      } catch (e: any) {
        console.error('[agent] error:', e);
        const message =
          e instanceof Anthropic.AuthenticationError
            ? 'La llave de Anthropic (ANTHROPIC_API_KEY) es inválida o falta.'
            : e instanceof Anthropic.RateLimitError
            ? 'Demasiadas solicitudes. Intenta de nuevo en unos segundos.'
            : e?.message || 'Ocurrió un error inesperado.';
        send({ type: 'error', message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
