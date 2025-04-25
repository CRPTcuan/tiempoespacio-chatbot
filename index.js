require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Importar cliente de Supabase
const supabaseClient = require('./scripts/supabase-client-simple');

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

// Configuración keep-alive (opcional)
const KEEP_ALIVE_URL = process.env.KEEP_ALIVE_URL || `http://localhost:${PORT}/keep-alive`;
const KEEP_ALIVE_INTERVAL = parseInt(process.env.KEEP_ALIVE_INTERVAL || '300000', 10); // 5 minutos por defecto

// Función para mantener viva la aplicación (opcional)
function setupKeepAlive() {
  if (process.env.KEEP_ALIVE_URL) {
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
}

// Activar keep-alive si estamos en producción
if (process.env.NODE_ENV === 'production') {
  setupKeepAlive();
}

// System prompt para el asistente
const systemPrompt = `Eres el asistente virtual de Cápsulas QuantumVibe. Tu rol es promocionar las cápsulas, un proyecto innovador que ofrece sesiones terapéuticas en cápsulas físicas donde las personas experimentan sonido, frecuencia, vibración y luz para transformar y transmutar su energía, logrando una ascensión a la 5D en un mundo de cambios geopolíticos, sociales y espirituales. Tu personalidad es:

- Amigable, cercano y profesional
- Inspirador, con un enfoque espiritual
- Respetuoso y formal
- Siempre manteniendo el foco en Cápsulas QuantumVibe y su mensaje transformador

**Estilo de comunicación**:
- Sé conversacional y pausado
- Haz preguntas para entender los intereses específicos del usuario
- Entrega la información gradualmente, no todo de una vez
- Permite que el usuario guíe la conversación hacia los aspectos que más le interesan
- Usa respuestas breves y concisas, evitando párrafos muy extensos

**Acerca de Cápsulas QuantumVibe**:
Cápsulas QuantumVibe invita a las personas a entrar en una cápsula física diseñada para armonizar cuerpo, mente y espíritu en un contexto de cambios geopolíticos, sociales y espirituales. Durante 40 minutos, los usuarios reciben sonido a través de audífonos de alta calidad, junto con frecuencias y vibraciones de baja frecuencia (30-120 Hz) que se sienten en todo el cuerpo, promoviendo relajación profunda, autoreparación y elevación energética. Estas sesiones combinan tecnología moderna con principios ancestrales de sonido y vibración, creando una experiencia inmersiva que transforma y transmuta, conectando con la quinta dimensión (5D). Los mensajes clave del proyecto son:
- "Cápsulas QuantumVibe: Tu Portal a la 5D"
- "Experimenta un cambio más que socioeconómico"
- "Sino que energético vibracional"
- "Terapia cuántica"
- "Auto reparate"
- "Auto regenerate"
- "Manifiesta los cambios, sube la vibración"
- "Somos seres divinos"

**Ubicación**:
Las Cápsulas QuantumVibe están ubicadas en los alrededores de Metro Baquedano, Providencia, Chile. La dirección exacta SOLO se proporciona a quienes reserven una hora para una sesión.

**Programas de las Cápsulas**:
Cada sesión dura 40 minutos y los usuarios pueden elegir entre tres programas específicos:
- **Programa 1: Descanso Profundo** - Diseñado para inducir un estado de relajación profunda, reducir el estrés y promover la autoreparación.
- **Programa 2: Concentración y Foco** - Mejora la claridad mental, aumenta la capacidad de atención y optimiza el rendimiento cognitivo.
- **Programa 3: Creatividad** - Estimula la imaginación, desbloquea el potencial creativo y favorece nuevas conexiones neuronales.

Estos programas usan combinaciones únicas de frecuencias, vibraciones y sonidos para lograr efectos específicos en cuerpo y mente.

**Disponibilidad**:
- Solo hay 4 horas disponibles cada día para sesiones: 10:00, 12:00, 15:00 y 17:00
- Cada sesión dura 40 minutos exactos
- Disponible de martes a sábado
- Se requiere reserva previa
- En caso de no asistir a una reserva sin cancelar previamente, el cliente puede ser añadido a una lista de restricción

**Beneficios de las Cápsulas QuantumVibe**:
- Alivio del estrés y la tensión muscular, mejorando la salud articular y reduciendo dolores.
- Mejora en la memoria y retención de información, ideal para el aprendizaje.
- Reducción de distracciones internas, aumentando la claridad mental.
- Elevación de la vibración energética para la conexión con la 5D.
- Armonización holística de cuerpo, mente y espíritu.

**Cómo funcionan las terapias**:
Las sesiones de Cápsulas QuantumVibe son una forma de terapia vibroacústica, donde las vibraciones de baja frecuencia (30-120 Hz) viajan a través del cuerpo, estimulando las células y promoviendo relajación y sanación. Los audífonos entregan sonidos cuidadosamente diseñados, como tonos puros o música ambiental, que sincronizan las ondas cerebrales (por ejemplo, a 40 Hz para enfoque o 10 Hz para meditación). Las vibraciones se sienten en todo el cuerpo, viajando eficazmente a través del agua (el cuerpo es 60-70% agua), lo que amplifica el efecto terapéutico. 

Es importante destacar que NO es solo sonido lo que llega a tus oídos, sino una experiencia completa donde las frecuencias y vibraciones impactan directamente a tu cuerpo físico, activando un proceso de autoreparación y autorregenación a nivel celular. La combinación de sonido, frecuencia y vibración genera un efecto sinérgico que permite la transmutación energética y facilita la conexión con estados elevados de consciencia.

Los usuarios pueden experimentar estados meditativos profundos, alivio del dolor o una sensación de conexión espiritual, contribuyendo a transformar y transmutar su energía en un mundo en transición.

**Sistema de reservas**:
- Los usuarios pueden reservar una sesión para cualquier día de martes a sábado.
- Horarios disponibles: 10:00, 12:00, 15:00 y 17:00.
- Para reservar, se necesita nombre completo, teléfono y opcionalmente email.
- Las reservas están sujetas a disponibilidad.
- La dirección exacta se proporciona al confirmar la reserva.
- Si alguien no asiste a su reserva sin cancelar previamente, puede ser añadido a una lista de restricción.

**Instrucciones para el proceso de reserva**:
1. Cuando un usuario quiera reservar, pregúntale qué programa le interesa (Descanso Profundo, Concentración y Foco, o Creatividad).
2. Después, pregúntale qué día le gustaría asistir (debe ser de martes a sábado).
3. Muéstrale los horarios disponibles para ese día.
4. Una vez seleccionado el horario, solicita su nombre completo y número de teléfono (el email es opcional).
5. Pídele confirmación de los datos y completa la reserva.
6. Proporciona la dirección exacta y las instrucciones para llegar solo cuando la reserva esté confirmada.

**Reglas de conversación**:

1. Usa un lenguaje formal, profesional y respetuoso, evitando chilenismos o jerga informal. Por ejemplo:
   - "Saludos" para iniciar
   - "Por favor" y "gracias" cuando corresponda
   - "Entiendo" en lugar de "¿Entiendes?"
   - "Interesante" o "maravilloso" para expresar entusiasmo

2. Mantén un tono inspirador y profesional, invitando a los usuarios a conectarse con el propósito espiritual de QuantumVibe en un contexto de cambios globales.

3. IMPORTANTE - ENTREGA GRADUAL DE INFORMACIÓN:
   - Comienza con una introducción breve sobre Cápsulas QuantumVibe
   - Haz preguntas para entender qué le interesa al usuario: "¿Le interesa conocer más sobre los beneficios, cómo funciona la experiencia, o los programas disponibles?"
   - Espera a que el usuario indique qué quiere saber antes de entregar información detallada
   - Entrega información en pequeñas porciones, no más de 2-3 oraciones a la vez
   - Haz preguntas de seguimiento: "¿Qué aspecto le gustaría explorar más?"

4. NUNCA menciones que deben escanear un código QR para más información. En cambio, proporciona toda la información necesaria directamente en la conversación.

5. Si el usuario pregunta por la ubicación:
   - SOLO menciona que está "en los alrededores de Metro Baquedano, Providencia, Chile"
   - NO proporciones la dirección exacta a menos que el usuario confirme claramente que quiere reservar una hora
   - Si el usuario confirma que quiere reservar, diles que "La dirección exacta se proporciona al momento de confirmar la reserva"

6. Si el usuario muestra interés, anímalo a reservar una sesión, pero no le des todos los detalles de los programas de una vez. Pregunta: "¿Hay algún área específica en la que le gustaría trabajar: descanso, concentración o creatividad?" Y luego explica el programa correspondiente.

7. Cuando alguien pregunte por disponibilidad u horarios:
   - Informa que tenemos sesiones de martes a sábado
   - Horarios disponibles: 10:00, 12:00, 15:00 y 17:00
   - Cada sesión dura exactamente 40 minutos
   - Es necesario hacer una reserva previa
   - Consulta qué programa les interesa más: Descanso Profundo, Concentración y Foco, o Creatividad

8. Si el usuario menciona un interés espiritual o en transformación personal, relaciónalo con QuantumVibe: "Es maravilloso que busque crecimiento espiritual. Las cápsulas le ayudarán a transformar y transmutar su energía, conectando con su esencia divina en estos tiempos de cambio global."

9. **Reglas estrictas sobre información**:
   - NUNCA inventes números de teléfono
   - NUNCA inventes URLs o enlaces
   - NUNCA inventes correos electrónicos
   - NUNCA menciones escanear códigos QR
   - NO proporciones la dirección exacta, solo "alrededores de Metro Baquedano, Providencia, Chile"
   - Enfócate en proporcionar información completa y convincente directamente en la conversación

10. Tu objetivo principal es que el usuario tome una hora para una sesión, entonces prioriza explicar los beneficios y la experiencia única que ofrece QuantumVibe, pero hazlo de forma conversacional y gradual.

11. **Para reservas confirmadas**:
   - Una vez confirmada la reserva, proporciona la siguiente dirección exacta: "La dirección es Calle José Victorino Lastarria 94, local 5, Santiago, a pasos de Metro Baquedano."
   - Indícale que debe llegar 5 minutos antes de la hora reservada
   - Recuérdale que debe llamar al llegar al +56 9 4729 5678

**Recuerda**: Tu objetivo es inspirar a los usuarios a interesarse en Cápsulas QuantumVibe y tomar una hora para una sesión, pero entregando la información de manera pausada, según lo que el usuario quiera explorar. NO des toda la información de una vez, sino que permite que la conversación fluya naturalmente.`;

const initialAssistantMessage = '¡Saludos! Soy tu guía en Cápsulas QuantumVibe. 🌟 Te puedo contar sobre nuestra experiencia transformadora que combina sonido, frecuencias y vibraciones. ¿Qué te gustaría conocer primero: cómo funciona la experiencia, los beneficios que ofrece, o los distintos programas disponibles?';

// Rutas API para Supabase
app.get('/api/disponibilidad', async (req, res) => {
  try {
    const fecha = req.query.fecha ? new Date(req.query.fecha) : new Date();
    const disponibilidad = await supabaseClient.consultarDisponibilidad(fecha);
    res.json(disponibilidad);
  } catch (error) {
    console.error('Error al consultar disponibilidad:', error);
    res.status(500).json({ error: 'Error al consultar disponibilidad' });
  }
});

app.get('/api/fechas-disponibles', async (req, res) => {
  try {
    const fechas = await supabaseClient.obtenerProximasFechasDisponibles();
    res.json(fechas);
  } catch (error) {
    console.error('Error al obtener fechas disponibles:', error);
    res.status(500).json({ error: 'Error al obtener fechas disponibles' });
  }
});

app.post('/api/reserva', async (req, res) => {
  try {
    const resultado = await supabaseClient.crearReserva(req.body);
    res.json(resultado);
  } catch (error) {
    console.error('Error al crear reserva:', error);
    res.status(500).json({ error: 'Error al crear reserva' });
  }
});

// Middleware para procesar intenciones de reserva
const procesarIntencionReserva = async (mensaje, sessionId) => {
  // Verificar si el mensaje indica intención de reserva
  const patrones = [
    /\b(reservar|reserva|agendar|agenda|tomar|sacar)\b.*\b(hora|sesion|cita)\b/i,
    /\b(quiero|me.gustaría|puedo)\b.*\b(reservar|agendar|tomar)\b/i,
    /\bcomo\b.*\b(tomo|reservo|agendo)\b/i,
    /\b(disponibilidad|horarios|horas)\b/i
  ];
  
  const esIntencionReserva = patrones.some(patron => patron.test(mensaje));
  
  // Si el usuario tiene un estado de reserva en proceso, continuamos procesando independientemente del mensaje
  if (esIntencionReserva || reservationStates[sessionId]) {
    // Iniciar proceso de reserva si no existe
    if (!reservationStates[sessionId]) {
      reservationStates[sessionId] = {
        paso: 'inicio',
        fecha: null,
        hora: null,
        nombre: null,
        telefono: null,
        email: null
      };
      
      // Obtener fechas disponibles para los próximos días
      const fechasDisponibles = await supabaseClient.obtenerProximasFechasDisponibles();
      
      if (fechasDisponibles.length === 0) {
        return {
          mensajePersonalizado: "Lo siento, no hay horarios disponibles en los próximos días. Por favor, intenta más adelante o contacta directamente a nuestro equipo para opciones especiales."
        };
      }
      
      // Formatear fechas disponibles para mostrar de manera más clara
      let mensajeFechas = "Tenemos disponibilidad en los siguientes días:\n\n";
      
      fechasDisponibles.slice(0, 7).forEach(fechaInfo => {
        const fechaFormateada = supabaseClient.formatearFecha(fechaInfo.fecha);
        mensajeFechas += `📅 ${fechaFormateada}:\n`;
        
        // Formatear horarios disponibles
        fechaInfo.horarios.forEach(h => {
          const horaFormateada = h.hora.substring(0, 5);
          mensajeFechas += `   ⏰ ${horaFormateada}\n`;
        });
        
        mensajeFechas += "\n";
      });
      
      mensajeFechas += "Para reservar, necesito que me indiques:\n\n";
      mensajeFechas += "1️⃣ Fecha deseada (ejemplo: 'el jueves 20')\n";
      mensajeFechas += "2️⃣ Hora (ejemplo: '10:00')\n";
      mensajeFechas += "3️⃣ Tu nombre completo\n";
      mensajeFechas += "4️⃣ Número de teléfono\n";
      
      return {
        mensajePersonalizado: mensajeFechas
      };
    } else if (reservationStates[sessionId].paso === 'inicio') {
      // Procesar la respuesta del usuario según el paso del proceso de reserva
      
      // Ejemplo básico para detectar fecha y hora en el mensaje
      const fechaPatterns = [
        /\b(lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado)\b/i,
        /\b(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/i
      ];
      
      const horaPatterns = [
        /\b(10|12|15|17):?00\b/i,
        /\b(10|12|3|5)\s*(am|pm)\b/i
      ];
      
      // Identificar partes del mensaje
      const tieneFecha = fechaPatterns.some(p => p.test(mensaje));
      const tieneHora = horaPatterns.some(p => p.test(mensaje));
      
      // Extraer fecha aproximada (simplificado)
      if (tieneFecha) {
        // Detectar día de la semana mencionado
        const diasSemana = ['domingo', 'lunes', 'martes', 'miércoles', 'miercoles', 'jueves', 'viernes', 'sábado', 'sabado'];
        let diaMencionado = null;
        
        for (const dia of diasSemana) {
          if (mensaje.toLowerCase().includes(dia)) {
            diaMencionado = dia.replace('miercoles', 'miércoles').replace('sabado', 'sábado');
            break;
          }
        }
        
        if (diaMencionado) {
          // Calcular próxima fecha con ese día de la semana
          const diaNumerico = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'].indexOf(diaMencionado);
          if (diaNumerico !== -1) {
            const hoy = new Date();
            const diasParaSumar = (diaNumerico + 7 - hoy.getDay()) % 7;
            const fechaProxima = new Date(hoy);
            fechaProxima.setDate(hoy.getDate() + (diasParaSumar === 0 ? 7 : diasParaSumar));
            
            reservationStates[sessionId].fecha = fechaProxima.toISOString().split('T')[0];
          }
        }
      }
      
      // Extraer hora (simplificado)
      if (tieneHora) {
        // Buscar menciones de hora específicas
        const horasPermitidas = ['10:00', '12:00', '15:00', '17:00'];
        let horaMencionada = null;
        
        for (const hora of horasPermitidas) {
          if (mensaje.includes(hora)) {
            horaMencionada = hora;
            break;
          }
        }
        
        // También buscar formatos alternativos (3pm = 15:00)
        if (!horaMencionada) {
          if (mensaje.match(/\b3\s*pm\b/i)) horaMencionada = '15:00';
          if (mensaje.match(/\b5\s*pm\b/i)) horaMencionada = '17:00';
          if (mensaje.match(/\b10\s*am\b/i)) horaMencionada = '10:00';
          if (mensaje.match(/\b12\s*pm\b/i)) horaMencionada = '12:00';
        }
        
        if (horaMencionada) {
          reservationStates[sessionId].hora = horaMencionada;
        }
      }
      
      // Si tenemos suficiente información
      if (reservationStates[sessionId].fecha && 
          reservationStates[sessionId].hora) {
        reservationStates[sessionId].paso = 'datos_personales';
        
        const fechaFormateada = new Date(reservationStates[sessionId].fecha)
          .toLocaleDateString('es-ES', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          });
        
        return {
          mensajePersonalizado: `¡Excelente elección! Has seleccionado una sesión para el ${fechaFormateada} a las ${reservationStates[sessionId].hora}.\n\nAhora necesito tus datos personales. Por favor, indícame tu nombre completo y número de teléfono.`
        };
      } else {
        let mensajeFaltante = "Para continuar con la reserva, necesito ";
        
        if (!reservationStates[sessionId].fecha) mensajeFaltante += "la fecha que prefieres, ";
        if (!reservationStates[sessionId].hora) mensajeFaltante += "la hora que te gustaría, ";
        
        mensajeFaltante = mensajeFaltante.slice(0, -2) + ".";
        
        return {
          mensajePersonalizado: mensajeFaltante
        };
      }
    } else if (reservationStates[sessionId].paso === 'datos_personales') {
      // Extraer posible nombre y teléfono
      
      // Patrón simple para detectar nombres (2+ palabras)
      const nombrePattern = /\b([A-Za-zÀ-ÖØ-öø-ÿ]+(?:\s+[A-Za-zÀ-ÖØ-öø-ÿ]+)+)\b/;
      const nombreMatch = mensaje.match(nombrePattern);
      
      // Patrón para teléfonos chilenos (+569XXXXXXXX o 9XXXXXXXX)
      const telefonoPattern = /(?:\+?56\s?9|9)\s?\d{4}\s?\d{4}/;
      const telefonoMatch = mensaje.match(telefonoPattern);
      
      // Guardar datos si fueron encontrados
      if (nombreMatch) {
        reservationStates[sessionId].nombre = nombreMatch[0];
      }
      
      if (telefonoMatch) {
        // Normalizar formato del teléfono
        reservationStates[sessionId].telefono = telefonoMatch[0].replace(/\s+/g, '');
        if (!reservationStates[sessionId].telefono.startsWith('+')) {
          if (reservationStates[sessionId].telefono.startsWith('9')) {
            reservationStates[sessionId].telefono = '+56' + reservationStates[sessionId].telefono;
          }
        }
      }
      
      // Verificar si tenemos suficiente información
      if (reservationStates[sessionId].nombre && reservationStates[sessionId].telefono) {
        reservationStates[sessionId].paso = 'confirmacion';
        
        const fechaFormateada = new Date(reservationStates[sessionId].fecha)
          .toLocaleDateString('es-ES', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          });
        
        return {
          mensajePersonalizado: `Por favor, confirma los siguientes datos para tu reserva:\n\n` +
            `📅 Fecha: ${fechaFormateada}\n` +
            `⏰ Hora: ${reservationStates[sessionId].hora}\n` +
            `👤 Nombre: ${reservationStates[sessionId].nombre}\n` +
            `📱 Teléfono: ${reservationStates[sessionId].telefono}\n\n` +
            `¿Es correcta esta información? Responde SÍ para confirmar o NO para modificar algún dato.`
        };
      } else {
        let mensajeFaltante = "Aún necesito ";
        
        if (!reservationStates[sessionId].nombre) mensajeFaltante += "tu nombre completo, ";
        if (!reservationStates[sessionId].telefono) mensajeFaltante += "tu número de teléfono, ";
        
        mensajeFaltante = mensajeFaltante.slice(0, -2) + ".";
        
        return {
          mensajePersonalizado: mensajeFaltante
        };
      }
    } else if (reservationStates[sessionId].paso === 'confirmacion') {
      // Verificar confirmación
      if (/\b(s[iíÍ]|yes|confirmo|correcto|adelante)\b/i.test(mensaje)) {
        // Crear la reserva en el sistema
        try {
          const resultado = await supabaseClient.crearReserva({
            fecha: reservationStates[sessionId].fecha,
            hora: reservationStates[sessionId].hora,
            nombre_cliente: reservationStates[sessionId].nombre,
            telefono: reservationStates[sessionId].telefono,
            email: reservationStates[sessionId].email || null
          });
          
          // Limpiar el estado de reserva
          delete reservationStates[sessionId];
          
          if (resultado.exito) {
            return {
              mensajePersonalizado: `¡Reserva confirmada exitosamente! Tu número de reserva es: ${resultado.id}.\n\n` +
                `La dirección exacta es: Calle José Victorino Lastarria 94, local 5, Santiago, a pasos de Metro Baquedano.\n\n` +
                `Por favor, llega 5 minutos antes de tu hora reservada. Al llegar, llama al +56 9 4729 5678.\n\n` +
                `¡Esperamos verte pronto para tu experiencia QuantumVibe!`
            };
          } else {
            return {
              mensajePersonalizado: `Lo siento, hubo un problema al crear tu reserva: ${resultado.mensaje}. Por favor, intenta nuevamente o contáctanos directamente.`
            };
          }
        } catch (error) {
          console.error('Error al crear reserva:', error);
          return {
            mensajePersonalizado: "Lo siento, hubo un error al procesar tu reserva. Por favor, intenta nuevamente más tarde o contáctanos directamente."
          };
        }
      } else if (/\b(no|incorrecto|cambiar|modificar)\b/i.test(mensaje)) {
        // Volver al paso inicial
        reservationStates[sessionId].paso = 'inicio';
        return {
          mensajePersonalizado: "Entendido. Vamos a reiniciar el proceso de reserva. Por favor, indícame nuevamente qué fecha y hora te interesa."
        };
      } else {
        return {
          mensajePersonalizado: "Por favor, confirma si los datos son correctos respondiendo SÍ o NO."
        };
      }
    }
  }
  
  return null;
};

// Función para cargar conversación previa desde sistema (sin guardar en Supabase)
const inicializarConversacion = () => {
  return [
    { role: 'system', content: systemPrompt },
    { role: 'assistant', content: initialAssistantMessage }
  ];
};

app.post('/chat', async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    if (!sessionId || !message) {
      return res.status(400).json({ error: 'Se requiere sessionId y mensaje' });
    }

    // Verificar si la API key está configurada
    if (!GROQ_API_KEY) {
      return res.status(500).json({ error: 'Error de configuración del servidor: La API key de Groq no está configurada.' });
    }

    // Inicializar conversación si no existe
    if (!conversations[sessionId]) {
      conversations[sessionId] = inicializarConversacion();
    }

    // Agregar mensaje del usuario
    conversations[sessionId].push({ role: 'user', content: message });

    // Procesar intención de reserva
    const intencionReserva = await procesarIntencionReserva(message, sessionId);
    
    if (intencionReserva && intencionReserva.mensajePersonalizado) {
      // Usar mensaje personalizado en lugar de llamar a la API
      conversations[sessionId].push({ role: 'assistant', content: intencionReserva.mensajePersonalizado });
      
      return res.json({ reply: intencionReserva.mensajePersonalizado });
    }

    // Limitar el historial de conversación a los últimos 10 mensajes
    const messagesToSend = conversations[sessionId].slice(-10);

    const response = await axios.post(GROQ_API_URL, {
      model: 'llama3-8b-8192',
      messages: messagesToSend,
      temperature: 0.7,
      max_tokens: 1000
    }, {
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30 segundos de timeout
    });

    const reply = response.data.choices[0].message.content;

    // Agregar respuesta del asistente
    conversations[sessionId].push({ role: 'assistant', content: reply });
    
    res.json({ reply });
  } catch (error) {
    console.error('Error en la API de Groq:', error.response?.data || error.message);
    
    let errorMessage = 'Lo siento, hubo un error al procesar tu mensaje. ¿Podrías intentarlo de nuevo?';
    
    if (error.response?.status === 429) {
      errorMessage = 'Estamos recibiendo muchas solicitudes. Por favor, intenta de nuevo en unos minutos.';
    } else if (error.code === 'ECONNABORTED') {
      errorMessage = 'La solicitud tardó demasiado tiempo. Por favor, intenta de nuevo.';
    }
    
    res.status(500).json({ error: errorMessage });
  }
});

app.get('/keep-alive', (req, res) => {
  res.send('I\'m alive!');
});

// Añadir ruta para la página principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 