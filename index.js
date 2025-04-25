require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Importar cliente de Supabase
const supabaseClient = require('./scripts/supabase-client');

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Objeto para almacenar las sesiones de chat
const conversations = {};

// Objeto para almacenar estados de reserva en proceso
const reservationStates = {};

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_API_KEY = process.env.GROQ_API_KEY;

// Verificar si la API key está configurada
if (!GROQ_API_KEY) {
  console.error('ERROR: La variable de entorno GROQ_API_KEY no está configurada.');
  console.error('Por favor, configura esta variable en tu archivo .env o en el panel de Render.com');
}

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
    /\bcomo\b.*\b(tomo|reservo|agendo)\b/i
  ];
  
  const esIntencionReserva = patrones.some(patron => patron.test(mensaje));
  
  if (esIntencionReserva) {
    // Iniciar proceso de reserva si no existe
    if (!reservationStates[sessionId]) {
      reservationStates[sessionId] = {
        paso: 'inicio',
        programa: null,
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
      
      // Formatear fechas disponibles para mostrar
      const fechasFormateadas = fechasDisponibles.slice(0, 5).map(f => {
        return `- ${supabaseClient.formatearFecha(f.fecha)} a las ${f.horarios.map(h => h.hora.substring(0, 5)).join(', ')}`;
      }).join('\n');
      
      return {
        mensajePersonalizado: `¡Excelente elección! Puedes programar tu hora en Cápsulas QuantumVibe de varias maneras: **Reserva en línea** Puedes reservar tu hora en nuestro sitio web, en la sección "Reserva". Simplemente selecciona el día y la hora que prefieres, y proporciona tus datos personales. **Llamada o WhatsApp** Puedes llamar o enviar un WhatsApp a nuestro número de contacto (94 1234 5678) y pedir una hora disponible. Nuestro equipo estará encantado de asistirte. **Correos electrónicos** Puedes enviar un correo electrónico a info@quantumvibe.com con el título "Reserva de hora" y proporciona tus datos personales y la hora que prefieres. **Presencialmente** Puedes visitarnos en persona en nuestra ubicación en Metro Baquedano, Providencia, Chile, y pedir una hora disponible en nuestro mostrador. Nuestro equipo estará encantado de asistirte. Recuerda que es importante tener en cuenta que las horas de sesión pueden variar dependiendo de la demanda y la disponibilidad. ¡Esperamos verte pronto!`
      };
    }
  }
  
  return null;
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

    // Iniciar conversación si no existe
    if (!conversations[sessionId]) {
      conversations[sessionId] = [
        { role: 'system', content: systemPrompt },
        { role: 'assistant', content: initialAssistantMessage }
      ];
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