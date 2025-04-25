const fs = require('fs').promises;
const path = require('path');
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
    
    console.log('Sistema de reservas inicializado correctamente');
    return true;
  } catch (error) {
    console.error('Error al inicializar el sistema de reservas:', error);
    return false;
  }
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
  
  // Buscar días disponibles en los próximos X días
  while (fechasDisponibles.length < 7 && diasAMostrar > 0) {
    if (esDiaDisponible(fecha)) {
      const disponibilidad = await consultarDisponibilidad(fecha);
      
      // Solo incluir fechas con al menos un horario disponible
      if (disponibilidad.horarios.some(h => h.disponible)) {
        fechasDisponibles.push({
          fecha: disponibilidad.fecha,
          horarios: disponibilidad.horarios.filter(h => h.disponible)
        });
      }
    }
    
    // Avanzar al siguiente día
    fecha.setDate(fecha.getDate() + 1);
    diasAMostrar--;
  }
  
  return fechasDisponibles;
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
      mensaje: 'Error al procesar la reserva' 
    };
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

// Exportar funciones
module.exports = {
  inicializarSistema,
  consultarDisponibilidad,
  obtenerProximasFechasDisponibles,
  crearReserva,
  formatearFecha
}; 