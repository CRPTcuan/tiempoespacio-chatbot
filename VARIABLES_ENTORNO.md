# Variables de Entorno Necesarias

Para configurar correctamente este proyecto, necesitas las siguientes variables de entorno:

## Variables Obligatorias

| Variable | Descripción |
| --- | --- |
| `SUPABASE_URL` | URL de tu proyecto Supabase (ej: https://tu-proyecto.supabase.co) |
| `SUPABASE_KEY` | Service Role Key de Supabase (no la clave anónima/pública) |
| `GROQ_API_KEY` | API Key para Groq |

## Variables Opcionales

| Variable | Descripción | Valor por defecto |
| --- | --- | --- |
| `PORT` | Puerto del servidor | 3000 |
| `KEEP_ALIVE_URL` | URL para el script keep-alive | http://localhost:[PORT]/keep-alive |
| `KEEP_ALIVE_INTERVAL` | Intervalo para el keep-alive (en ms) | 300000 (5 minutos) |
| `NODE_ENV` | Entorno de ejecución | development |

## Centralización de Variables

Todas las variables de entorno están centralizadas en un único archivo `.env` en la raíz del proyecto. Para tu comodidad, se incluye un archivo `.env.example` que puedes usar como plantilla.

### Para desarrollo local

1. Copia el archivo `.env.example` a `.env`:
   ```
   cp .env.example .env
   ```

2. Edita el archivo `.env` y añade tus propias claves:
   ```
   SUPABASE_URL=https://tu-proyecto-real.supabase.co
   SUPABASE_KEY=tu-clave-service-role-real
   GROQ_API_KEY=gsk_tu-clave-real
   ```

### Para producción

Configura estas mismas variables en las opciones de Environment Variables de tu proveedor de hosting (Render, Heroku, etc.).

## Notas Importantes

- **Nunca** compartas o subas a repositorios públicos el archivo `.env` con tus claves reales
- Asegúrate de usar la **Service Role Key** de Supabase, no la clave anónima
- El script de keep-alive es opcional y solo se activa en producción (`NODE_ENV=production`)
- Todas las variables son accesibles en el código mediante `process.env.NOMBRE_VARIABLE`

## Creación del archivo .env

Para configurar tu entorno local, crea un archivo `.env` en la raíz del proyecto con el siguiente contenido (reemplazando los valores con los tuyos):

```
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_KEY=tu-service-role-key
GROQ_API_KEY=gsk_tu-api-key
PORT=3000
KEEP_ALIVE_URL=https://tu-app.onrender.com/keep-alive
KEEP_ALIVE_INTERVAL=300000 