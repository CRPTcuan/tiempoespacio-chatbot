require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Importar nuestro gestor de reservas basado en JSON
const reservasManager = require('./scripts/reservas-manager');

// Inicializar el sistema de reservas
(async function() {
  await reservasManager.inicializarSistema();
})();

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Objeto para almacenar las sesiones de chat temporalmente en memoria
const conversations = {};

// Objeto para almacenar estados de reserva en proceso
const reservationStates = {};

// Configuración de la API de GROQ
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_API_KEY = process.env.GROQ_API_KEY;

// Verificar si la API key está configurada
if (!GROQ_API_KEY) {
  console.error('ERROR: La variable de entorno GROQ_API_KEY no está configurada.');
  console.error('Por favor, configura esta variable en tu archivo .env o en el panel de tu proveedor de hosting');
}

// Configuración keep-alive (para evitar que Render apague el servicio)
const KEEP_ALIVE_URL = process.env.KEEP_ALIVE_URL || `http://localhost:${PORT}/keep-alive`;
const KEEP_ALIVE_INTERVAL = parseInt(process.env.KEEP_ALIVE_INTERVAL || '300000', 10); // 5 minutos por defecto

// Función para mantener viva la aplicación
function setupKeepAlive() {
  console.log(`Configurando keep-alive cada ${KEEP_ALIVE_INTERVAL / 60000} minutos a ${KEEP_ALIVE_URL}`);
  
  async function pingKeepAlive() {
    try {
      const response = await axios.get(KEEP_ALIVE_URL);
      console.log(`[${new Date().toISOString()}] Keep-alive ping exitoso`);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error en keep-alive ping:`, error.message);
    }
  }
  
  // Ejecutar el ping inmediatamente y luego cada intervalo
  pingKeepAlive();
  setInterval(pingKeepAlive, KEEP_ALIVE_INTERVAL);
}

// Activar keep-alive para evitar que se apague en Render
setupKeepAlive();

// Definimos un prompt del sistema para guiar las respuestas
const systemPrompt = `
Eres el asistente virtual para Cápsulas QuantumVibe, una experiencia revolucionaria que combina sonido, luz, vibración y frecuencias específicas para lograr efectos positivos en el cuerpo y mente.

SOBRE LAS CÁPSULAS QUANTUMVIBE:
------------------------------
Las Cápsulas QuantumVibe ofrecen una novedosa terapia de frecuencias que combina:
- Sonidos binaurales y frecuencias específicas
- Cromoterapia (terapia con luces de colores)
- Vibroacústica (vibración sincronizada con sonido)
- Aromaterapia (opcional)

Cada programa tiene una combinación única de frecuencias y vibraciones para lograr efectos específicos.

HORARIOS Y DURACIÓN:
------------------
- Horario: Martes a Sábado con sesiones a las 10:00, 12:00, 15:00 y 17:00 horas
- Duración: Cada sesión dura 40 minutos
- IMPORTANTE: NO es posible hacer reservas para el mismo día
- Reserva obligatoria con anticipación
- Las cancelaciones deben realizarse con un mínimo de 24 horas de antelación
- 3 faltas sin previo aviso resultan en la imposibilidad de reservar nuevamente

BENEFICIOS DE LAS CÁPSULAS:
--------------------------
- Reducción significativa del estrés y ansiedad
- Mejora en la calidad del sueño
- Incremento en la memoria y atención
- Aumento de la creatividad
- Armonización holística del ser
- Alivio de dolores crónicos
- Recuperación acelerada del sistema nervioso
- Mayor claridad mental
- Equilibrio energético

PROGRAMAS DISPONIBLES:
---------------------
1. RELAJACIÓN: Induce estados de tranquilidad profunda, reduce el estrés y la ansiedad.
2. ENERGIZACIÓN: Revitaliza, activa y aumenta los niveles de energía.
3. MEDITACIÓN: Facilita estados meditativos profundos y mayor conexión interior.
4. EQUILIBRIO: Armoniza los centros energéticos y balancea el sistema nervioso.
5. CREATIVIDAD: Estimula la imaginación y el pensamiento innovador.
6. SUEÑO PROFUNDO: Mejora la calidad del descanso y promueve un sueño reparador.
7. CLARIDAD MENTAL: Optimiza la concentración y la capacidad de enfoque.
8. SANACIÓN: Apoya procesos de recuperación física y emocional.
9. PERSONALIZADO: Programa adaptado a necesidades específicas tras evaluación.

CÓMO FUNCIONA LA TERAPIA:
------------------------
1. El cliente selecciona un programa específico según su necesidad
2. Se acomoda en la cápsula cómodamente vestido (no es necesario desvestirse)
3. La experiencia combina luz, sonido y vibración por 40 minutos
4. La cápsula está siempre abierta, no hay encierro
5. Es posible detener la sesión en cualquier momento
6. Después de la sesión se recomienda hidratarse bien

DETALLES PARA REALIZAR UNA RESERVA:
----------------------------------
- Para reservar se requiere: nombre, correo electrónico y teléfono
- Se requiere pago anticipado para confirmar la reserva
- Descuentos disponibles al adquirir paquetes de sesiones
- RECORDATORIO: No es posible reservar para el mismo día

ESTILO DE CONVERSACIÓN:
----------------------
- Mantén un tono amable, profesional y ligeramente espiritual
- No sobreexpliques conceptos técnicos a menos que te lo soliciten
- Utiliza un vocabulario relacionado con bienestar, armonía y equilibrio
- Sé paciente y empático con las dudas o preocupaciones
- Entrega la información de manera gradual, evitando saturar con demasiados detalles a la vez
- Incentiva la interacción preguntando sobre intereses o necesidades específicas
- Usa ejemplos para ilustrar los beneficios cuando sea apropiado

Tus respuestas deben ser informativas, claras y enfocadas en guiar a la persona hacia la experiencia QuantumVibe que mejor se ajuste a sus necesidades particulares.
`;

const initialAssistantMessage = '¡Saludos! Soy tu guía en Cápsulas QuantumVibe. 🌟 Te puedo contar sobre nuestra experiencia transformadora que combina sonido, frecuencias y vibraciones. ¿Qué te gustaría conocer primero: cómo funciona la experiencia, los beneficios que ofrece, o los distintos programas disponibles?';

// Rutas API para el sistema de reservas
app.get('/api/disponibilidad', async (req, res) => {
  try {
    const fecha = req.query.fecha ? new Date(req.query.fecha) : new Date();
    const disponibilidad = await reservasManager.consultarDisponibilidad(fecha);
    res.json(disponibilidad);
  } catch (error) {
    console.error('Error al consultar disponibilidad:', error);
    res.status(500).json({ error: 'Error al consultar disponibilidad' });
  }
});

app.get('/api/fechas-disponibles', async (req, res) => {
  try {
    const fechas = await reservasManager.obtenerProximasFechasDisponibles();
    res.json(fechas);
  } catch (error) {
    console.error('Error al obtener fechas disponibles:', error);
    res.status(500).json({ error: 'Error al obtener fechas disponibles' });
  }
});

app.post('/api/reserva', async (req, res) => {
  try {
    const resultado = await reservasManager.crearReserva(req.body);
    res.json(resultado);
  } catch (error) {
    console.error('Error al crear reserva:', error);
    res.status(500).json({ error: 'Error al crear reserva' });
  }
});

app.get('/api/reservas', async (req, res) => {
  try {
    const reservas = await reservasManager.obtenerTodasLasReservas();
    res.json(reservas);
  } catch (error) {
    console.error('Error al obtener todas las reservas:', error);
    res.status(500).json({ error: 'Error al obtener todas las reservas' });
  }
});

app.get('/api/reserva/:id', async (req, res) => {
  try {
    const reserva = await reservasManager.obtenerReservaPorId(req.params.id);
    if (!reserva) {
      return res.status(404).json({ error: 'Reserva no encontrada' });
    }
    res.json(reserva);
  } catch (error) {
    console.error('Error al obtener reserva por ID:', error);
    res.status(500).json({ error: 'Error al obtener reserva por ID' });
  }
});

app.put('/api/reserva/:id', async (req, res) => {
  try {
    const resultado = await reservasManager.actualizarReserva(req.params.id, req.body);
    if (!resultado.exito) {
      return res.status(404).json({ error: resultado.mensaje });
    }
    res.json(resultado);
  } catch (error) {
    console.error('Error al actualizar reserva:', error);
    res.status(500).json({ error: 'Error al actualizar reserva' });
  }
});

app.delete('/api/reserva/:id', async (req, res) => {
  try {
    const resultado = await reservasManager.eliminarReserva(req.params.id);
    if (!resultado) {
      return res.status(404).json({ error: 'Reserva no encontrada' });
    }
    res.json({ mensaje: 'Reserva eliminada con éxito' });
  } catch (error) {
    console.error('Error al eliminar reserva:', error);
    res.status(500).json({ error: 'Error al eliminar reserva' });
  }
});

// Ruta para crear respaldo manual
app.post('/api/backup', async (req, res) => {
  try {
    const resultado = await reservasManager.crearRespaldo();
    res.json(resultado);
  } catch (error) {
    console.error('Error al crear respaldo manual:', error);
    res.status(500).json({ error: 'Error al crear respaldo manual' });
  }
});

// Ruta para keep-alive
app.get('/keep-alive', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Función para obtener fechas disponibles en formato para mostrar al usuario
async function obtenerFechasDisponiblesFormateadas(diasAMostrar = 10) {
  try {
    console.log(`[${new Date().toISOString()}] Obteniendo próximas fechas disponibles (${diasAMostrar} días)`);
    
    // Obtener fechas disponibles desde el gestor de reservas
    const fechasDisponibles = await reservasManager.obtenerProximasFechasDisponibles(diasAMostrar);
    
    if (!fechasDisponibles || fechasDisponibles.length === 0) {
      console.log(`[${new Date().toISOString()}] No se encontraron fechas disponibles`);
      return [];
    }
    
    // Convertir la estructura de datos para que sea más fácil de usar en el chat
    const fechasFormateadas = fechasDisponibles.map(dia => {
      return {
        fecha: dia.fecha,
        horasDisponibles: dia.horarios
          .filter(h => h.disponible)
          .map(h => h.hora)
      };
    });
    
    console.log(`[${new Date().toISOString()}] Encontradas ${fechasFormateadas.length} fechas disponibles`);
    return fechasFormateadas;
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error al obtener fechas disponibles:`, error);
    return [];
  }
}

// Middleware para procesar intenciones de reserva
async function procesarIntencionReserva(mensaje, sessionId) {
  console.log(`[${new Date().toISOString()}] Procesando intención de reserva para: "${mensaje}" (sessionId: ${sessionId})`);
  
  // Logs del estado actual de la reserva
  if (reservationStates[sessionId]) {
    console.log(`[${new Date().toISOString()}] Estado actual de reserva:`, JSON.stringify(reservationStates[sessionId]));
  } else {
    console.log(`[${new Date().toISOString()}] No hay estado de reserva para esta sesión`);
    reservationStates[sessionId] = {};
  }
  
  const patrones = [
    /\b(reservar?|agendar?|cita|turno|horario|disponibilidad|cuando hay|cuando (?:tienen|tienes))\b/i,
    /\b(cuándo|cuando|que dias|qué días|horarios?)\b/i,
    /\b(capsula|capsulas|quantumvibe|terapia)\b/i
  ];

  const tieneIntencionReserva = patrones.some(patron => patron.test(mensaje));
  
  // Si ya tenemos fecha y hora, avanzar automáticamente para completar la reserva
  if (reservationStates[sessionId].fecha && reservationStates[sessionId].hora) {
    console.log(`[${new Date().toISOString()}] Ya tenemos fecha y hora, avanzando al siguiente paso`);
    
    // Analizar si el mensaje contiene datos de contacto
    if (!reservationStates[sessionId].nombre) {
      // Intentar extraer nombre, correo y teléfono del mensaje
      const nombrePattern = /(?:me\s+llamo|soy|nombre\s+es|nombre:)\s+([A-Za-zÁáÉéÍíÓóÚúÑñ\s]+)(?:\s*,|\s+y|\s+mi|\s+con|\b)/i;
      const correoPattern = /(?:correo|email|mail|e-mail)(?:\s+es|\s*:\s*|\s+)([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i;
      const telefonoPattern = /(?:teléfono|telefono|celular|móvil|movil|tel|fono)(?:\s+es|\s*:\s*|\s+)((?:\+?56|0)?\s*9?\s*[0-9\s]{8,})/i;
      
      const nombreMatch = mensaje.match(nombrePattern);
      const correoMatch = mensaje.match(correoPattern);
      const telefonoMatch = mensaje.match(telefonoPattern);
      
      // Si encontramos datos de contacto en el mensaje, guardarlos
      if (nombreMatch) {
        const nombreCompleto = nombreMatch[1].trim();
        // Asegurarnos que sea un nombre válido (al menos 5 caracteres y dos palabras)
        if (nombreCompleto.length >= 5 && nombreCompleto.includes(' ')) {
          reservationStates[sessionId].nombre = nombreCompleto;
          console.log(`[${new Date().toISOString()}] Nombre detectado: ${nombreCompleto}`);
        }
      }
      
      if (correoMatch) {
        const correo = correoMatch[1].trim();
        reservationStates[sessionId].email = correo;
        console.log(`[${new Date().toISOString()}] Correo detectado: ${correo}`);
      }
      
      if (telefonoMatch) {
        // Limpiar el teléfono (quitar espacios y asegurar formato)
        let telefono = telefonoMatch[1].replace(/\s+/g, '');
        // Asegurar formato +569XXXXXXXX o similar
        if (!telefono.startsWith('+') && !telefono.startsWith('9')) {
          telefono = '9' + telefono;
        }
        if (!telefono.includes('+56')) {
          telefono = '+56' + telefono.replace(/^0+/, '');
        }
        
        reservationStates[sessionId].telefono = telefono;
        console.log(`[${new Date().toISOString()}] Teléfono detectado: ${telefono}`);
      }
      
      // Si tenemos todos los datos, crear la reserva
      if (reservationStates[sessionId].nombre && 
          reservationStates[sessionId].email && 
          reservationStates[sessionId].telefono) {
        
        // Intentar crear la reserva
        try {
          const resultado = await reservasManager.crearReserva({
            fecha: reservationStates[sessionId].fecha,
            hora: reservationStates[sessionId].hora,
            nombre_cliente: reservationStates[sessionId].nombre,
            email: reservationStates[sessionId].email,
            telefono: reservationStates[sessionId].telefono
          });
          
          if (resultado.exito) {
            // Resetear el estado de reserva después de crearla exitosamente
            delete reservationStates[sessionId];
            
            return {
              mensajePersonalizado: `¡Reserva confirmada! Hemos agendado tu sesión para el ${formatearFecha(resultado.fecha)} a las ${resultado.hora}. Te hemos enviado un correo de confirmación a ${resultado.email} con todos los detalles. ¡Esperamos recibirte pronto!`
            };
          } else {
            return {
              mensajePersonalizado: `Lo siento, ha ocurrido un error al crear tu reserva: ${resultado.mensaje}. Por favor, intenta nuevamente o contáctanos directamente por teléfono.`
            };
          }
        } catch (error) {
          console.error('Error al crear la reserva:', error);
          return {
            mensajePersonalizado: `Lo siento, ha ocurrido un error inesperado al procesar tu reserva. Por favor, intenta nuevamente o contáctanos directamente al +56947295678.`
          };
        }
      }
      
      // Si no tenemos todos los datos, solicitar los que faltan
      let datosRequeridos = [];
      if (!reservationStates[sessionId].nombre) datosRequeridos.push("nombre completo");
      if (!reservationStates[sessionId].email) datosRequeridos.push("correo electrónico");
      if (!reservationStates[sessionId].telefono) datosRequeridos.push("número de teléfono");
      
      // Si detectamos algunos datos pero no todos, personalizar el mensaje
      if (datosRequeridos.length > 0) {
        return `¡Perfecto! Tengo una reserva para el ${formatearFecha(reservationStates[sessionId].fecha)} a las ${reservationStates[sessionId].hora}. Para completar la reserva, necesito: ${datosRequeridos.join(", ")}.`;
      }
      
      // Si no detectamos ningún dato, mostrar el mensaje completo de solicitud
      return `¡Perfecto! Tengo una reserva para el ${formatearFecha(reservationStates[sessionId].fecha)} a las ${reservationStates[sessionId].hora}. Para completar la reserva, por favor proporciónanos:
      
✨ Tu nombre completo
✨ Tu correo electrónico
✨ Tu número de teléfono

Ejemplo: "Me llamo Juan Pérez, mi correo es juan@example.com y mi teléfono es 6123456789"`;
    }
    // Si ya tenemos nombre, intentar completar la reserva
    else {
      // Aquí podríamos añadir más lógica para avanzar en los siguientes pasos
      return `Gracias ${reservationStates[sessionId].nombre}, estamos procesando tu reserva para el ${formatearFecha(reservationStates[sessionId].fecha)} a las ${reservationStates[sessionId].hora}. Te enviaremos una confirmación por correo electrónico.`;
    }
  }
  
  // Verificar si estamos buscando disponibilidad
  if (tieneIntencionReserva || mensaje.toLowerCase().includes('disponib') || mensaje.toLowerCase().includes('reserv')) {
    console.log(`[${new Date().toISOString()}] Detectada intención de reserva`);
    
    // Obtener próximos días disponibles
    const fechasDisponibles = await obtenerFechasDisponiblesFormateadas(10); // Próximos 10 días disponibles
    
    if (fechasDisponibles.length === 0) {
      return "Lo siento, no tenemos horarios disponibles en los próximos días. Por favor, intenta más adelante.";
    }
    
    // Formatear las fechas disponibles de manera más visual y organizada
    let respuesta = `✨ **Horarios Disponibles** ✨\n\n`;
    
    fechasDisponibles.forEach(dia => {
      const fecha = new Date(dia.fecha);
      const nombreDia = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][fecha.getDay()];
      const fechaFormateada = `${fecha.getDate()}/${fecha.getMonth() + 1}/${fecha.getFullYear()}`;
      
      // Formatear las horas disponibles para ese día
      const horasDisponibles = dia.horasDisponibles.map(hora => hora).join(' | ');
      
      respuesta += `📅 **${nombreDia} ${fechaFormateada}**\n`;
      respuesta += `⏰ ${horasDisponibles}\n\n`;
    });
    
    respuesta += `Para reservar, indícame el día y la hora que prefieras. Por ejemplo: "Quiero reservar el martes a las 10:00".\n\nNecesitaré tu nombre, correo electrónico y teléfono para completar la reserva.`;
    
    return respuesta;
  }
  
  // Si llegamos aquí, no hay intención clara de reserva
  return null;
}

// Función para formatear la fecha en formato legible
function formatearFecha(fechaISO) {
  const fecha = new Date(fechaISO);
  const diasSemana = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  
  const diaSemana = diasSemana[fecha.getDay()];
  const dia = fecha.getDate();
  const mes = meses[fecha.getMonth()];
  
  return `${diaSemana} ${dia} de ${mes}`;
}

// Ruta para procesar mensajes de chat
app.post('/api/chat', async (req, res) => {
  // Aceptar tanto 'message' como 'mensaje' para compatibilidad
  const mensaje = req.body.mensaje || req.body.message;
  const sessionId = req.body.sessionId;
  
  // Verificar que tenemos los datos necesarios
  if (!mensaje || !sessionId) {
    return res.status(400).json({ 
      error: 'Falta mensaje o sessionId', 
      reply: "Lo siento, ha ocurrido un error. Por favor, intenta nuevamente."
    });
  }
  
  console.log(`[${new Date().toISOString()}] Mensaje recibido (${sessionId}): ${mensaje}`);
  console.log(`[${new Date().toISOString()}] Estado actual de reserva:`, 
    reservationStates[sessionId] ? 
    JSON.stringify(reservationStates[sessionId]) : 
    "No existe estado para esta sesión");
  
  try {
    const respuesta = await procesarIntencionReserva(mensaje, sessionId);
    
    console.log(`[${new Date().toISOString()}] Respuesta generada:`, respuesta ? JSON.stringify(respuesta) : "null");
    
    // Asegurarse de que siempre enviamos una respuesta válida
    if (!respuesta) {
      let respuestaPredeterminada;
      
      // Si el usuario mencionó reserva pero no pudimos procesarla
      if (mensaje.toLowerCase().includes('reserv') || 
          mensaje.toLowerCase().includes('hora') || 
          mensaje.toLowerCase().includes('cita')) {
        respuestaPredeterminada = "Parece que quieres hacer una reserva. Para ayudarte, necesito que me digas qué día y hora te gustaría reservar. Por ejemplo: 'me gustaría reservar para el jueves a las 3 de la tarde'.";
      } else {
        respuestaPredeterminada = "Estoy aquí para ayudarte con información sobre Cápsulas QuantumVibe o para asistirte con tu reserva. ¿En qué puedo ayudarte hoy?";
      }
      
      res.json({
        reply: respuestaPredeterminada
      });
    } else if (respuesta.mensajePersonalizado) {
      // Si es un mensaje personalizado del sistema de reservas, lo enviamos como reply
      res.json({
        reply: respuesta.mensajePersonalizado
      });
    } else {
      // Si es otro tipo de respuesta, la enviamos tal cual
      res.json(respuesta);
    }
  } catch (error) {
    console.error('Error al procesar mensaje:', error);
    res.status(500).json({ 
      error: 'Error al procesar mensaje: ' + error.message, 
      reply: "Lo siento, ha ocurrido un error procesando tu mensaje. Por favor, intenta nuevamente o escribe tu solicitud de otra forma."
    });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});