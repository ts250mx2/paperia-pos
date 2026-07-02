# La Paperia POS

Sistema de Punto de Venta para **La Paperia · Papelería y algo más**, construido con
[Next.js](https://nextjs.org). Es una adaptación del sistema *tapioki-pos* conectada a la
base de datos **BDPaperia** (MySQL) del servidor `hlsistemas.com`.

## Funcionalidades

- **POS / Venta** con carrito, múltiples precios y formas de pago (efectivo, tarjeta, transferencia).
- **Dashboard** de ventas (KPIs, tendencias, mapa de calor por hora, desglose por categoría/producto).
- **Caja / Cortes**: apertura, cierre e impresión de corte.
- **Movimientos** de efectivo (entradas/salidas).
- **Catálogo** de productos y categorías.
- **Usuarios** con roles (Administrador, Cajero, Mesero).
- **Configuración de ticket** (encabezados/pies de página).
- **Impresión** de tickets, cocina, corte, apertura y movimientos.
- **Asistente inteligente "Lapi"** (IA con Anthropic) que consulta la base de datos en solo lectura.

## Configuración

Copia `.env.example` a `.env` y completa los valores:

```env
DB_HOST=hlsistemas.com
DB_USER=kyk
DB_PASSWORD=********
DB_NAME=BDPaperia
DB_PORT=3306

ANTHROPIC_API_KEY=sk-ant-...   # para el asistente Lapi
```

## Desarrollo

```bash
npm install
npm run dev      # http://localhost:3017
```

## Producción

```bash
npm run build
npm run start    # http://localhost:3018
```

## Usuario administrador

La tabla `tblUsuarios` de BDPaperia puede estar vacía. Para crear el administrador por defecto
(`admin` / `admin123`) ejecuta una sola vez:

```bash
npx tsx seed.ts
```

> El seed **no** modifica el catálogo de productos ni categorías existentes; solo crea el usuario
> administrador si no hay ninguno.

## Notas sobre la base de datos

BDPaperia es una base de datos de producción. Para soportar todas las funciones de tapioki-pos se
agregaron columnas **aditivas** (no destructivas) que el sistema VB6 original ignora:

- `tblCategorias.EsExtra`
- `tblDetalleVentas.EsExtra`, `tblDetalleVentas.IdDetallePadre`
- `tblProductos.ArchivoImagen`
- `tblAperturasCierres.Transferencia`

La columna de fecha de `tblRetiros` en BDPaperia es `Fecha` (en tapioki era `FechaRetiro`); el código
ya está adaptado a `Fecha`.
