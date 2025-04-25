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
      const fechasDisponibles = await reservasManager.obtenerProximasFechasDisponibles();
      
      if (fechasDisponibles.length === 0) {
        return {
          mensajePersonalizado: "Lo siento, no hay horarios disponibles en los próximos días. Por favor, intenta más adelante o contacta directamente a nuestro equipo para opciones especiales."
        };
      }
      
      // Formatear fechas disponibles para mostrar de manera más clara
      let mensajeFechas = "Tenemos disponibilidad en los siguientes días:\n\n";
      
      fechasDisponibles.slice(0, 5).forEach(fechaInfo => {
        const fechaFormateada = reservasManager.formatearFecha(fechaInfo.fecha);
        mensajeFechas += `📅 ${fechaFormateada}:\n`;
        
        // Recomendar solo algunos horarios por día (máximo 3)
        const horariosRecomendados = fechaInfo.horarios.slice(0, 3);
        
        horariosRecomendados.forEach(h => {
          mensajeFechas += `   ⏰ ${h.hora}\n`;
        });
        
        if (fechaInfo.horarios.length > 3) {
          mensajeFechas += `   (y ${fechaInfo.horarios.length - 3} horarios más disponibles)\n`;
        }
        
        mensajeFechas += "\n";
      });
      
      mensajeFechas += "Para reservar, necesito que me indiques:\n\n";
      mensajeFechas += "1️⃣ Fecha deseada (ejemplo: 'el jueves 20')\n";
      mensajeFechas += "2️⃣ Hora (ejemplo: '10:00')\n";
      mensajeFechas += "3️⃣ Tu nombre completo\n";
      mensajeFechas += "4️⃣ Tu correo electrónico\n";
      mensajeFechas += "5️⃣ Número de teléfono\n";
      
      mensajeFechas += "\nRecuerda que no es posible reservar para el mismo día.";
      
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
          // Patrones más flexibles para detectar horas
          if (mensaje.match(/\b3\s*pm\b/i) || mensaje.match(/\blas\s*3\b/i) || mensaje.match(/\ba\s*las\s*3\b/i) || mensaje.match(/\b15\b/i) || mensaje.match(/\b15:00\b/i) || mensaje.match(/\b3\s*$\b/i)) horaMencionada = '15:00';
          if (mensaje.match(/\b5\s*pm\b/i) || mensaje.match(/\blas\s*5\b/i) || mensaje.match(/\ba\s*las\s*5\b/i) || mensaje.match(/\b17\b/i) || mensaje.match(/\b17:00\b/i) || mensaje.match(/\b5\s*$\b/i)) horaMencionada = '17:00';
          if (mensaje.match(/\b10\s*am\b/i) || mensaje.match(/\blas\s*10\b/i) || mensaje.match(/\ba\s*las\s*10\b/i) || mensaje.match(/\b10\b/i) || mensaje.match(/\b10:00\b/i) || mensaje.match(/\b10\s*$\b/i)) horaMencionada = '10:00';
          if (mensaje.match(/\b12\s*pm\b/i) || mensaje.match(/\blas\s*12\b/i) || mensaje.match(/\ba\s*las\s*12\b/i) || mensaje.match(/\b12\b/i) || mensaje.match(/\b12:00\b/i) || mensaje.match(/\b12\s*$\b/i)) horaMencionada = '12:00';
          if (mensaje.match(/\b11\b/i) || mensaje.match(/\b11:00\b/i) || mensaje.match(/\blas\s*11\b/i) || mensaje.match(/\ba\s*las\s*11\b/i)) horaMencionada = '12:00'; // Mapear 11 a 12:00
          
          // Intentar detectar números y convertirlos a horas disponibles
          if (!horaMencionada) {
            const numeroPattern = /\b(\d{1,2})\b/;
            const numeroMatch = mensaje.match(numeroPattern);
            
            if (numeroMatch) {
              const numero = parseInt(numeroMatch[1], 10);
              // Mapear números cercanos a las horas disponibles
              if (numero >= 9 && numero <= 10) horaMencionada = '10:00';
              else if (numero >= 11 && numero <= 13) horaMencionada = '12:00';
              else if (numero >= 14 && numero <= 15) horaMencionada = '15:00';
              else if (numero >= 16 && numero <= 18) horaMencionada = '17:00';
            }
          }
        }
        
        if (horaMencionada) {
          reservationStates[sessionId].hora = horaMencionada;
        }
      } else {
        // Intentar detectar horas incluso si no se detectó con los patrones principales
        const numeroPattern = /\b(\d{1,2})\b/;
        const numeroMatch = mensaje.match(numeroPattern);
        
        if (numeroMatch) {
          const numero = parseInt(numeroMatch[1], 10);
          // Mapear números a las horas disponibles
          let horaMapeada = null;
          if (numero >= 9 && numero <= 10) horaMapeada = '10:00';
          else if (numero >= 11 && numero <= 13) horaMapeada = '12:00';
          else if (numero >= 14 && numero <= 15) horaMapeada = '15:00';
          else if (numero >= 16 && numero <= 18) horaMapeada = '17:00';
          
          if (horaMapeada) {
            reservationStates[sessionId].hora = horaMapeada;
          }
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
          mensajePersonalizado: `¡Excelente elección! Has seleccionado una sesión para el ${fechaFormateada} a las ${reservationStates[sessionId].hora}.\n\nAhora necesito tus datos personales.\n\nPor favor, indícame:\n\n1️⃣ Tu nombre completo\n2️⃣ Tu correo electrónico\n3️⃣ Tu número de teléfono`
        };
      } else {
        let mensajeFaltante = "Para continuar con la reserva, necesito ";
        
        if (!reservationStates[sessionId].fecha) mensajeFaltante += "la fecha que prefieres, ";
        if (!reservationStates[sessionId].hora) {
          // Intentar extraer un número directamente del mensaje
          const numeroPattern = /\b(\d{1,2})\b/;
          const numeroMatch = mensaje.match(numeroPattern);
          
          if (numeroMatch) {
            const numero = parseInt(numeroMatch[1], 10);
            // Mapear a la hora disponible más cercana
            if (numero >= 9 && numero <= 10) reservationStates[sessionId].hora = '10:00';
            else if (numero >= 11 && numero <= 13) reservationStates[sessionId].hora = '12:00';
            else if (numero >= 14 && numero <= 15) reservationStates[sessionId].hora = '15:00';
            else if (numero >= 16 && numero <= 18) reservationStates[sessionId].hora = '17:00';
            
            if (reservationStates[sessionId].hora) {
              // Si pudimos extraer y asignar una hora, actualizar el mensaje
              mensajeFaltante = `He registrado la hora ${reservationStates[sessionId].hora}. Ahora necesito `;
              if (!reservationStates[sessionId].fecha) mensajeFaltante += "la fecha que prefieres.";
              else {
                // Si ya tenemos fecha y hora, avanzar al siguiente paso
                reservationStates[sessionId].paso = 'datos_personales';
                
                const fechaFormateada = new Date(reservationStates[sessionId].fecha)
                  .toLocaleDateString('es-ES', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  });
                
                return {
                  mensajePersonalizado: `¡Excelente elección! Has seleccionado una sesión para el ${fechaFormateada} a las ${reservationStates[sessionId].hora}.\n\nAhora necesito tus datos personales.\n\nPor favor, indícame:\n\n1️⃣ Tu nombre completo\n2️⃣ Tu correo electrónico\n3️⃣ Tu número de teléfono`
                };
              }
            } else {
              mensajeFaltante += "la hora que te gustaría (disponibles: 10:00, 12:00, 15:00 o 17:00), ";
            }
          } else {
            mensajeFaltante += "la hora que te gustaría (disponibles: 10:00, 12:00, 15:00 o 17:00), ";
          }
        }
        
        mensajeFaltante = mensajeFaltante.slice(0, -2) + ".";
        
        return {
          mensajePersonalizado: mensajeFaltante
        };
      }
    } else if (reservationStates[sessionId].paso === 'datos_personales') {
      // Extraer posible nombre, email y teléfono
      
      // Patrón simple para detectar nombres (2+ palabras)
      const nombrePattern = /\b([A-Za-zÀ-ÖØ-öø-ÿ]+(?:\s+[A-Za-zÀ-ÖØ-öø-ÿ]+)+)\b/;
      const nombreMatch = mensaje.match(nombrePattern);
      
      // Patrón para teléfonos chilenos (+569XXXXXXXX o 9XXXXXXXX)
      const telefonoPattern = /(?:\+?56\s?9|9)\s?\d{4}\s?\d{4}/;
      const telefonoMatch = mensaje.match(telefonoPattern);
      
      // Patrón para correo electrónico
      const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
      const emailMatch = mensaje.match(emailPattern);
      
      // Guardar datos si fueron encontrados
      if (nombreMatch && !reservationStates[sessionId].nombre) {
        reservationStates[sessionId].nombre = nombreMatch[0];
      }
      
      if (telefonoMatch && !reservationStates[sessionId].telefono) {
        // Normalizar formato del teléfono
        reservationStates[sessionId].telefono = telefonoMatch[0].replace(/\s+/g, '');
        if (!reservationStates[sessionId].telefono.startsWith('+')) {
          if (reservationStates[sessionId].telefono.startsWith('9')) {
            reservationStates[sessionId].telefono = '+56' + reservationStates[sessionId].telefono;
          }
        }
      }
      
      if (emailMatch && !reservationStates[sessionId].email) {
        reservationStates[sessionId].email = emailMatch[0];
      }
      
      // Verificar si tenemos suficiente información
      if (reservationStates[sessionId].nombre && 
          reservationStates[sessionId].telefono && 
          reservationStates[sessionId].email) {
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
            `1️⃣ Nombre: ${reservationStates[sessionId].nombre}\n` +
            `2️⃣ Correo electrónico: ${reservationStates[sessionId].email}\n` +
            `3️⃣ Número de teléfono: ${reservationStates[sessionId].telefono}`
        };
      } else {
        let mensajeFaltante = "Para completar la reserva, necesitamos algunos datos más. Por favor, indícame:\n\n1️⃣ Tu nombre completo\n2️⃣ Tu correo electrónico\n3️⃣ Tu número de teléfono\n\nSi ya tienes estos datos, por favor, confírmalos. Si no, por favor, proporcionármelos para que podamos continuar con tu reserva.";
        
        return {
          mensajePersonalizado: mensajeFaltante
        };
      }
    } else if (reservationStates[sessionId].paso === 'confirmacion') {
      // Procesar la confirmación de la reserva
      const confirmacion = mensaje.toLowerCase().includes('confirmo');
      if (confirmacion) {
        const fechaFormateada = new Date(reservationStates[sessionId].fecha)
          .toLocaleDateString('es-ES', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          });
        
        return {
          mensajePersonalizado: `¡Gracias por confirmar tu reserva! Te esperamos el ${fechaFormateada} a las ${reservationStates[sessionId].hora} en nuestras Cápsulas QuantumVibe. ¡Te esperamos con mucho entusiasmo!`
        };
      } else {
        let mensajeFaltante = `Por favor, confirma tu reserva para continuar. ¿Estás seguro de que quieres reservar una sesión en Cápsulas QuantumVibe el ${fechaFormateada} a las ${reservationStates[sessionId].hora}?`;
        
        return {
          mensajePersonalizado: mensajeFaltante
        };
      }
    }
  }
};

// Ruta para procesar mensajes de chat
app.post('/api/chat', async (req, res) => {
  const { mensaje, sessionId } = req.body;
  try {
    const respuesta = await procesarIntencionReserva(mensaje, sessionId);
    res.json(respuesta);
  } catch (error) {
    console.error('Error al procesar mensaje:', error);
    res.status(500).json({ error: 'Error al procesar mensaje' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});