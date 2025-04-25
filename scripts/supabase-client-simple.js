require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Configuración de Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

// Verificar que las variables de entorno estén configuradas
if (!supabaseUrl || !supabaseKey) {
  console.error('ERROR: Variables de entorno SUPABASE_URL y/o SUPABASE_KEY no configuradas');
  console.error('Asegúrate de que estas variables estén configuradas en tu archivo .env o en tu proveedor de hosting');
}

// Crear cliente con opciones específicas para garantizar compatibilidad con Render
const supabase = createClient(supabaseUrl, supabaseKey, {
  db: {
    schema: 'public'
  },
  auth: {
    persistSession: false
  },
  global: {
    // Estas opciones ayudan a resolver problemas de conexión en entornos como Render
    fetch: (...args) => fetch(...args)
  }
});

console.log('Inicializando cliente de Supabase con URL:', supabaseUrl);

/**
 * Consulta los horarios disponibles para una fecha específica
 * @param {Date} fecha - Fecha para consultar disponibilidad
 * @returns {Array} - Lista de horarios disponibles
 */
async function consultarDisponibilidad(fecha) {
  try {
    console.log(`Consultando disponibilidad para fecha: ${fecha.toISOString().split('T')[0]}`);
    const { data, error } = await supabase.rpc('consultar_disponibilidad_fecha', {
      p_fecha: fecha.toISOString().split('T')[0]
    });
    
    if (error) {
      console.error('Error al consultar disponibilidad (detalle):', error);
      throw error;
    }
    
    console.log(`Disponibilidad encontrada: ${data ? data.length : 0} horarios`);
    
    // Filtrar solo horarios disponibles
    return data.filter(h => h.disponible).map(h => ({
      dia_semana: h.dia_semana,
      hora: h.hora,
      disponible: h.disponible
    }));
  } catch (error) {
    console.error('Error al consultar disponibilidad:', error.message);
    return [];
  }
}

/**
 * Crea una nueva reserva simplificada (sin programa)
 * @param {Object} reserva - Datos de la reserva
 * @returns {Object} - Resultado de la creación { exito, id, mensaje }
 */
async function crearReserva(reserva) {
  try {
    console.log('Intentando crear reserva con datos:', JSON.stringify(reserva, null, 2));
    const { 
      fecha, 
      hora, 
      nombre_cliente, 
      telefono, 
      email,
      programa
    } = reserva;
    
    const fechaObj = new Date(fecha);
    const diaSemana = fechaObj.getDay();
    
    const { data, error } = await supabase.rpc('crear_reserva', {
      p_dia_semana: diaSemana,
      p_hora: hora,
      p_fecha: fecha,
      p_nombre_cliente: nombre_cliente,
      p_telefono: telefono,
      p_email: email,
      p_programa: programa || null // Asegurar que programa sea opcional
    });
    
    if (error) {
      console.error('Error al crear reserva (detalle):', error);
      throw error;
    }
    
    console.log('Reserva creada exitosamente con ID:', data);
    
    return {
      exito: true,
      id: data,
      mensaje: 'Reserva creada exitosamente'
    };
  } catch (error) {
    console.error('Error al crear reserva:', error.message);
    return {
      exito: false,
      id: null,
      mensaje: error.message || 'Error al crear la reserva'
    };
  }
}

/**
 * Obtiene próximas fechas disponibles (siguientes 14 días)
 * @returns {Array} - Lista de fechas disponibles (objetos Date)
 */
async function obtenerProximasFechasDisponibles() {
  try {
    console.log('Consultando próximas fechas disponibles...');
    const fechas = [];
    const hoy = new Date();
    
    // Consultamos los próximos 14 días
    for (let i = 0; i < 14; i++) {
      const fecha = new Date(hoy);
      fecha.setDate(hoy.getDate() + i);
      
      // Solo martes a sábado (2-6)
      const diaSemana = fecha.getDay();
      if (diaSemana >= 2 && diaSemana <= 6) {
        const disponibilidad = await consultarDisponibilidad(fecha);
        if (disponibilidad.length > 0) {
          fechas.push({
            fecha,
            horarios: disponibilidad
          });
        }
      }
    }
    
    console.log(`Encontradas ${fechas.length} fechas disponibles`);
    return fechas;
  } catch (error) {
    console.error('Error al obtener fechas disponibles:', error.message);
    return [];
  }
}

/**
 * Convierte un día de la semana numérico a texto
 * @param {number} diaSemana - Número del día (0-6, donde 0 es domingo)
 * @returns {string} - Nombre del día
 */
function diaSemanaATexto(diaSemana) {
  const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  return dias[diaSemana];
}

/**
 * Formatea una fecha para mostrar al usuario
 * @param {Date} fecha - Fecha a formatear
 * @returns {string} - Fecha formateada (ej: "Martes, 12 de mayo de 2023")
 */
function formatearFecha(fecha) {
  const opciones = { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  };
  return fecha.toLocaleDateString('es-ES', opciones);
}

module.exports = {
  consultarDisponibilidad,
  crearReserva,
  obtenerProximasFechasDisponibles,
  diaSemanaATexto,
  formatearFecha
}; 