# QuantumVibe - Chatbot de Reservas

Sistema de chatbot para gestionar reservas de las Cápsulas QuantumVibe, un espacio innovador que ofrece sesiones terapéuticas donde las personas experimentan sonido, frecuencia, vibración y luz para transformar su energía.

## Características

- 💬 Chatbot interactivo para información y reservas
- 📅 Sistema de gestión de disponibilidad y reservas
- 🛎️ Programas específicos: Descanso Profundo, Concentración y Foco, Creatividad
- ⏰ Horarios disponibles: 10:00, 12:00, 15:00 y 17:00 (martes a sábado)
- 🔒 Seguridad con validación de clientes y lista de restricciones

## Arquitectura

El sistema utiliza:
- **Frontend**: HTML/CSS/JavaScript para la interfaz de chat
- **Backend**: Node.js con Express
- **Base de datos**: Supabase (PostgreSQL)
- **Modelo de lenguaje**: Groq (API compatible con OpenAI)

## Despliegue en Render

Para desplegar este proyecto en Render.com:

1. **Preparación**:
   - Haz un fork o clona este repositorio en GitHub
   - Crea una cuenta en [Supabase](https://supabase.com) si aún no tienes una
   - Crea una cuenta en [Render](https://render.com) si aún no tienes una
   - Obtén una API key de [Groq](https://groq.ai) para el modelo de lenguaje

2. **Configuración inicial en Render**:
   - Crea un nuevo Web Service vinculado a tu repositorio de GitHub
   - Configura tu proyecto con:
     - **Runtime**: Node.js
     - **Build Command**: `npm install`
     - **Start Command**: `npm run setup-simple` (temporalmente)
     - **Environment Variables**: Todas las listadas en el archivo `.env.example`

3. **Configuración de Supabase**:
   - Una vez desplegado el servicio, accede a la URL proporcionada por Render
   - Sigue las instrucciones en pantalla para configurar automáticamente la base de datos
   - Verifica que la configuración se haya completado correctamente
   - Si encuentras algún error, consulta el archivo `DEPLOY_RENDER.md`

4. **Finalización**:
   - Regresa al panel de Render
   - Cambia el comando de inicio a: `npm start`
   - Despliega nuevamente la aplicación

Para instrucciones detalladas, consulta el archivo `DEPLOY_RENDER.md` en este repositorio.

## Variables de Entorno

Todas las variables de entorno están centralizadas en el archivo `.env` para desarrollo local y en las variables de entorno de tu proveedor de hosting para producción. Consulta el archivo `.env.example` para ver todas las variables requeridas y opcionales.

### Variables Obligatorias

| Variable | Descripción |
|----------|-------------|
| `SUPABASE_URL` | URL de tu proyecto Supabase (ej: https://tu-proyecto.supabase.co) |
| `SUPABASE_KEY` | Service Role Key de Supabase (no la anon/public) |
| `GROQ_API_KEY` | API Key de Groq para el modelo de lenguaje |

### Variables Opcionales

| Variable | Descripción | Valor por defecto |
|----------|-------------|-------------------|
| `PORT` | Puerto para el servidor | 3000 |
| `KEEP_ALIVE_URL` | URL para el script keep-alive | http://localhost:[PORT]/keep-alive |
| `KEEP_ALIVE_INTERVAL` | Intervalo para el keep-alive (ms) | 300000 (5 minutos) |

## Desarrollo Local

Para desarrollo local:

1. Clona el repositorio
   ```
   git clone https://github.com/tu-usuario/5D-chatbot.git
   cd 5D-chatbot
   ```

2. Instala las dependencias
   ```
   npm install
   ```

3. Crea un archivo `.env` basado en `.env.example` con tus propias variables

4. Inicia el servidor en modo desarrollo
   ```
   npm run dev
   ```

## Mantenimiento

Para mantener el sistema:

1. **Actualizaciones**: Push a GitHub y Render desplegará automáticamente
2. **Monitoreo**: Usa la sección "Logs" en Render para supervisar actividad y errores
3. **Reservas**: Puedes acceder a las reservas directamente desde Supabase

## Estructura del Proyecto

- `/public` - Archivos estáticos públicos
- `/scripts` - Scripts para configuración y utilidades
- `index.js` - Punto de entrada principal
- `DEPLOY_RENDER.md` - Guía detallada de despliegue
- `VARIABLES_ENTORNO.md` - Documentación de las variables de entorno
- `.env.example` - Ejemplo de configuración de variables de entorno 