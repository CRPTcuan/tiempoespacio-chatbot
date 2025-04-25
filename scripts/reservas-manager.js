const fs = require('fs').promises;
const path = require('path');
const axios = require('axios'); // Para llamadas a la API de IA
const nodemailer = require('nodemailer');
const emailManager = require('./email-manager');

// Ruta al archivo JSON que almacenará las reservas
const RESERVAS_FILE = path.join(__dirname, '../data/reservas.json');
const DIAS_DISPONIBLES = ['martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const HORAS_DISPONIBLES = ['10:00', '12:00', '15:00', '17:00'];

// Configuración de correo electrónico
const EMAIL_SISTEMA = 'QuantumVibeStgo@protonmail.com';

// Asegurar que el directorio de datos exista
async function inicializarSistema() {
  try {
    const dataDir = path.join(__dirname, '../data');
    try {
      await fs.access(dataDir);
    } catch (error) {
      await fs.mkdir(dataDir, { recursive: true });
    }

    try {
      await fs.access(RESERVAS_FILE);
    } catch (error) {
      // Si el archivo no existe, lo creamos con una estructura inicial vacía
      await fs.writeFile(RESERVAS_FILE, JSON.stringify({ reservas: [] }));
    }
    
    // Inicializar el sistema de correos
    await emailManager.inicializarEmailManager();
    
    // Configurar respaldo automático diario
    configurarRespaldoAutomatico();
    
    console.log('Sistema de reservas inicializado correctamente');
    return true;
  } catch (error) {
    console.error('Error al inicializar el sistema de reservas:', error);
    return false;
  }
}

// Configurar respaldo automático diario a las 3 AM
function configurarRespaldoAutomatico() {
  const timer = setInterval(async () => {
    const ahora = new Date();
    if (ahora.getHours() === 3 && ahora.getMinutes() === 0) {
      try {
        const backupDir = path.join(__dirname, '../data/backups');
        try {
          await fs.access(backupDir);
        } catch (error) {
          await fs.mkdir(backupDir, { recursive: true });
        }
        
        const fecha = ahora.toISOString().split('T')[0];
        const backupFile = path.join(backupDir, `reservas-${fecha}.json`);
        
        // Hacer copia de seguridad
        const data = await fs.readFile(RESERVAS_FILE, 'utf8');
        await fs.writeFile(backupFile, data);
        
        console.log(`Respaldo creado exitosamente: ${backupFile}`);
      } catch (error) {
        console.error('Error al crear respaldo automático:', error);
      }
    }
  }, 60000); // Verificar cada minuto
  
  // No permitir que el intervalo mantenga la aplicación en ejecución
  timer.unref();
}

// Cargar las reservas existentes
async function cargarReservas() {
  try {
    const data = await fs.readFile(RESERVAS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error al cargar reservas:', error);
    return { reservas: [] };
  }
}

// Guardar las reservas en el archivo
async function guardarReservas(data) {
  try {
    await fs.writeFile(RESERVAS_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error al guardar reservas:', error);
    return false;
  }
}

// Comprobar si una fecha es un día de la semana disponible
function esDiaDisponible(fecha) {
  const dia = fecha.toLocaleDateString('es-ES', { weekday: 'long' }).toLowerCase();
  return DIAS_DISPONIBLES.includes(dia);
}

// Consultar disponibilidad para una fecha específica
async function consultarDisponibilidad(fecha) {
  // Asegurarse de que la fecha es un objeto Date
  if (!(fecha instanceof Date)) {
    fecha = new Date(fecha);
  }
  
  // Si la fecha no es válida o no es un día disponible, retornar vacío
  if (isNaN(fecha) || !esDiaDisponible(fecha)) {
    return { fecha: fecha.toISOString().split('T')[0], horarios: [] };
  }
  
  const fechaString = fecha.toISOString().split('T')[0]; // Formato YYYY-MM-DD
  
  // Cargar reservas existentes
  const data = await cargarReservas();
  
  // Filtrar las reservas para esta fecha
  const reservasDelDia = data.reservas.filter(r => r.fecha === fechaString);
  
  // Crear lista de horarios disponibles
  const horariosDisponibles = HORAS_DISPONIBLES.map(hora => {
    const ocupado = reservasDelDia.some(r => r.hora === hora);
    return {
      hora,
      disponible: !ocupado
    };
  });
  
  return {
    fecha: fechaString,
    horarios: horariosDisponibles
  };
}

// Obtener próximas fechas disponibles
async function obtenerProximasFechasDisponibles(diasAMostrar = 14) {
  const fechasDisponibles = [];
  const hoy = new Date();
  let fecha = new Date(hoy);
  fecha.setDate(fecha.getDate() + 1); // Empezar desde mañana, no desde hoy
  
  // Buscar días disponibles en los próximos X días
  while (fechasDisponibles.length < 7 && diasAMostrar > 0) {
    if (esDiaDisponible(fecha)) {
      const disponibilidad = await consultarDisponibilidad(fecha);
      
      // Solo incluir fechas con al menos un horario disponible
      if (disponibilidad.horarios.some(h => h.disponible)) {
        // Ordenar los horarios para mostrarlos de forma más clara
        const horariosDisponibles = disponibilidad.horarios
          .filter(h => h.disponible)
          .sort((a, b) => {
            // Ordenar por hora (ya están en formato HH:MM)
            return a.hora.localeCompare(b.hora);
          });
          
        fechasDisponibles.push({
          fecha: disponibilidad.fecha,
          horarios: horariosDisponibles
        });
      }
    }
    
    // Avanzar al siguiente día
    fecha.setDate(fecha.getDate() + 1);
    diasAMostrar--;
  }
  
  return fechasDisponibles;
}

// Validar reserva utilizando IA (Groq API)
async function validarReservaConIA(datosReserva) {
  try {
    // Solo validar con IA si tenemos una API key configurada
    if (!process.env.GROQ_API_KEY) {
      console.warn('GROQ_API_KEY no configurada. Omitiendo validación IA.');
      return { valido: true, errores: [] };
    }
    
    // Extraer día de la semana de la fecha
    const fecha = new Date(datosReserva.fecha);
    const diaSemana = fecha.toLocaleDateString('es-ES', { weekday: 'long' }).toLowerCase();
    
    const respuesta = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: 'llama3-8b-8192',
      messages: [
        {
          role: 'system',
          content: 'Eres un asistente especializado en validar reservas para Cápsulas QuantumVibe. Verifica que los datos sean coherentes y detecta posibles errores. Responde solo en formato JSON.'
        },
        {
          role: 'user',
          content: `Valida esta reserva para Cápsulas QuantumVibe:
          
Fecha: ${datosReserva.fecha} (día de la semana: ${diaSemana})
Hora: ${datosReserva.hora}
Nombre: ${datosReserva.nombre_cliente}
Email: ${datosReserva.email}
Teléfono: ${datosReserva.telefono}

Reglas de validación:
1. La hora debe ser exactamente: 10:00, 12:00, 15:00 o 17:00.
2. El día debe ser de martes a sábado (nunca domingo o lunes).
3. El correo electrónico debe tener formato válido.
4. El teléfono debe ser chileno (formato +569XXXXXXXX o similar).
5. El nombre debe tener al menos nombre y apellido.

Responde con JSON exactamente en este formato: {"valido": true/false, "errores": ["error1", "error2"]}`
        }
      ],
      temperature: 0.2,
      max_tokens: 150
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    try {
      // Intentar parsear respuesta JSON de la IA
      const contenido = respuesta.data.choices[0].message.content;
      const validacion = JSON.parse(contenido);
      return validacion;
    } catch (parseError) {
      // Si no podemos parsear la respuesta, asumimos que es válido pero lo registramos
      console.error('Error al parsear respuesta de la IA:', parseError);
      return { valido: true, errores: [] };
    }
  } catch (error) {
    console.error('Error al validar con IA:', error);
    // Si falla la validación IA, asumimos que es válido
    return { valido: true, errores: [] };
  }
}

// Enviar correo de confirmación
async function enviarCorreoConfirmacion(reserva, urlCalendario) {
  try {
    // Enviar correo al cliente
    await emailManager.enviarConfirmacionCliente(reserva, urlCalendario);
    
    // Enviar notificación al sistema
    await emailManager.enviarNotificacionSistema(reserva);
    
    return true;
  } catch (error) {
    console.error('Error al enviar correos de confirmación:', error);
    return false;
  }
}

// Generar evento para Google Calendar
function generarEventoCalendario(reserva) {
  const fechaISO = reserva.fecha;
  const horaInicio = reserva.hora;
  const horaFin = sumarMinutosAHora(horaInicio, 40);
  
  const fechaInicio = `${fechaISO}T${horaInicio}:00`;
  const fechaFin = `${fechaISO}T${horaFin}:00`;
  
  const evento = {
    title: 'Sesión en Cápsulas QuantumVibe',
    description: `Reserva para ${reserva.nombre_cliente}. Por favor, llega 5 minutos antes de tu hora reservada. Al llegar, llama al +56 9 4729 5678.`,
    location: 'Calle José Victorino Lastarria 94, local 5, Santiago',
    startTime: fechaInicio,
    endTime: fechaFin
  };
  
  // Generar URL para Google Calendar
  const googleCalendarUrl = 'https://calendar.google.com/calendar/render?' + 
    'action=TEMPLATE' + 
    `&text=${encodeURIComponent(evento.title)}` + 
    `&dates=${fechaInicio.replace(/[-:]/g, '')}/${fechaFin.replace(/[-:]/g, '')}` + 
    `&details=${encodeURIComponent(evento.description)}` + 
    `&location=${encodeURIComponent(evento.location)}` + 
    '&sf=true&output=xml';
  
  return {
    evento,
    googleCalendarUrl
  };
}

// Función auxiliar para sumar minutos a una hora
function sumarMinutosAHora(hora, minutos) {
  const [horas, minutosActuales] = hora.split(':').map(Number);
  
  let totalMinutos = (horas * 60 + minutosActuales) + minutos;
  const nuevasHoras = Math.floor(totalMinutos / 60);
  const nuevosMinutos = totalMinutos % 60;
  
  return `${nuevasHoras.toString().padStart(2, '0')}:${nuevosMinutos.toString().padStart(2, '0')}`;
}

// Crear una nueva reserva
async function crearReserva(datosReserva) {
  try {
    // Validar datos mínimos requeridos
    if (!datosReserva.fecha || !datosReserva.hora || !datosReserva.nombre_cliente || !datosReserva.telefono || !datosReserva.email) {
      return { 
        exito: false, 
        mensaje: 'Faltan datos requeridos para la reserva' 
      };
    }
    
    // Verificar disponibilidad
    const disponibilidad = await consultarDisponibilidad(new Date(datosReserva.fecha));
    const horarioSolicitado = disponibilidad.horarios.find(h => h.hora === datosReserva.hora);
    
    if (!horarioSolicitado || !horarioSolicitado.disponible) {
      return { 
        exito: false, 
        mensaje: 'El horario seleccionado no está disponible' 
      };
    }
    
    // Validar los datos con IA
    const validacionIA = await validarReservaConIA(datosReserva);
    if (!validacionIA.valido) {
      return {
        exito: false,
        mensaje: 'La validación de IA detectó problemas: ' + validacionIA.errores.join(', ')
      };
    }
    
    // Cargar reservas existentes
    const data = await cargarReservas();
    
    // Crear ID único para la reserva (timestamp + random)
    const reservaId = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    // Crear objeto de reserva
    const nuevaReserva = {
      id: reservaId,
      fecha: datosReserva.fecha,
      hora: datosReserva.hora,
      nombre_cliente: datosReserva.nombre_cliente,
      telefono: datosReserva.telefono,
      email: datosReserva.email,
      creada_en: new Date().toISOString()
    };
    
    // Agregar la reserva al array
    data.reservas.push(nuevaReserva);
    
    // Guardar cambios
    await guardarReservas(data);
    
    // Generar información para Google Calendar
    const infoCalendario = generarEventoCalendario(nuevaReserva);
    
    // Intentar enviar correo de confirmación
    await enviarCorreoConfirmacion(nuevaReserva, infoCalendario.googleCalendarUrl);
    
    return { 
      exito: true, 
      id: reservaId,
      mensaje: 'Reserva creada exitosamente',
      calendario: infoCalendario.googleCalendarUrl
    };
  } catch (error) {
    console.error('Error al crear reserva:', error);
    return { 
      exito: false, 
      mensaje: 'Error al procesar la reserva: ' + error.message
    };
  }
}

// Obtener todas las reservas
async function obtenerTodasLasReservas() {
  try {
    const data = await cargarReservas();
    return data.reservas;
  } catch (error) {
    console.error('Error al obtener todas las reservas:', error);
    throw error;
  }
}

// Obtener una reserva por ID
async function obtenerReservaPorId(id) {
  try {
    const data = await cargarReservas();
    return data.reservas.find(r => r.id.toString() === id.toString()) || null;
  } catch (error) {
    console.error('Error al obtener reserva por ID:', error);
    throw error;
  }
}

// Actualizar una reserva existente
async function actualizarReserva(id, datosActualizados) {
  try {
    if (!id || Object.keys(datosActualizados).length === 0) {
      return {
        exito: false,
        mensaje: 'Se requiere ID y al menos un campo para actualizar'
      };
    }
    
    // Cargar reservas existentes
    const data = await cargarReservas();
    
    // Buscar la reserva por ID
    const indice = data.reservas.findIndex(r => r.id.toString() === id.toString());
    
    if (indice === -1) {
      return {
        exito: false,
        mensaje: 'Reserva no encontrada'
      };
    }
    
    // Preparar campos a actualizar (solo permitir ciertos campos)
    const camposPermitidos = ['fecha', 'hora', 'nombre_cliente', 'telefono', 'email'];
    const reservaActualizada = { ...data.reservas[indice] };
    
    let seActualizo = false;
    for (const campo of camposPermitidos) {
      if (datosActualizados[campo] !== undefined) {
        reservaActualizada[campo] = datosActualizados[campo];
        seActualizo = true;
      }
    }
    
    if (!seActualizo) {
      return {
        exito: false,
        mensaje: 'No se proporcionaron campos válidos para actualizar'
      };
    }
    
    // Si se actualizó fecha u hora, verificar disponibilidad
    if ((datosActualizados.fecha && datosActualizados.fecha !== data.reservas[indice].fecha) ||
        (datosActualizados.hora && datosActualizados.hora !== data.reservas[indice].hora)) {
      
      // Verificar si la nueva fecha/hora está disponible
      const disponibilidad = await consultarDisponibilidad(new Date(reservaActualizada.fecha));
      
      // Debemos excluir la reserva actual de la verificación
      const horarioDisponible = disponibilidad.horarios.find(h => h.hora === reservaActualizada.hora);
      const estaOcupado = data.reservas.some(r => 
        r.id !== id && 
        r.fecha === reservaActualizada.fecha && 
        r.hora === reservaActualizada.hora
      );
      
      if (estaOcupado || !horarioDisponible || !horarioDisponible.disponible) {
        return {
          exito: false,
          mensaje: 'El nuevo horario seleccionado no está disponible'
        };
      }
    }
    
    // Validar los datos actualizados con IA
    if (seActualizo) {
      const validacionIA = await validarReservaConIA(reservaActualizada);
      if (!validacionIA.valido) {
        return {
          exito: false,
          mensaje: 'La validación de IA detectó problemas: ' + validacionIA.errores.join(', ')
        };
      }
    }
    
    // Actualizar la reserva
    data.reservas[indice] = reservaActualizada;
    
    // Guardar cambios
    await guardarReservas(data);
    
    return {
      exito: true,
      mensaje: 'Reserva actualizada exitosamente',
      reserva: reservaActualizada
    };
  } catch (error) {
    console.error('Error al actualizar reserva:', error);
    return {
      exito: false,
      mensaje: 'Error al actualizar la reserva: ' + error.message
    };
  }
}

// Eliminar una reserva
async function eliminarReserva(id) {
  try {
    // Cargar reservas existentes
    const data = await cargarReservas();
    
    // Buscar la reserva por ID
    const indice = data.reservas.findIndex(r => r.id.toString() === id.toString());
    
    if (indice === -1) {
      return false;
    }
    
    // Eliminar la reserva del array
    data.reservas.splice(indice, 1);
    
    // Guardar cambios
    await guardarReservas(data);
    
    return true;
  } catch (error) {
    console.error('Error al eliminar reserva:', error);
    throw error;
  }
}

// Formatear fecha para mostrar al usuario
function formatearFecha(fechaStr) {
  const fecha = new Date(fechaStr);
  return fecha.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });
}

// Hacer respaldo manual de las reservas
async function crearRespaldo() {
  try {
    const backupDir = path.join(__dirname, '../data/backups');
    try {
      await fs.access(backupDir);
    } catch (error) {
      await fs.mkdir(backupDir, { recursive: true });
    }
    
    const fecha = new Date().toISOString().split('T')[0];
    const hora = new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
    const backupFile = path.join(backupDir, `reservas-${fecha}-${hora}.json`);
    
    // Hacer copia de seguridad
    const data = await fs.readFile(RESERVAS_FILE, 'utf8');
    await fs.writeFile(backupFile, data);
    
    return {
      exito: true,
      mensaje: `Respaldo creado exitosamente: ${backupFile}`
    };
  } catch (error) {
    console.error('Error al crear respaldo manual:', error);
    return {
      exito: false,
      mensaje: 'Error al crear respaldo: ' + error.message
    };
  }
}

module.exports = {
  inicializarSistema,
  consultarDisponibilidad,
  obtenerProximasFechasDisponibles,
  crearReserva,
  obtenerTodasLasReservas,
  obtenerReservaPorId,
  actualizarReserva,
  eliminarReserva,
  formatearFecha,
  crearRespaldo
}; 