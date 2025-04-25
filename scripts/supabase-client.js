require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Configuración de Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

// Crear cliente
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Consulta los horarios disponibles para una fecha específica
 * @param {Date} fecha - Fecha para consultar disponibilidad
 * @returns {Array} - Lista de horarios disponibles
 */
async function consultarDisponibilidad(fecha) {
  try {
    const { data, error } = await supabase.rpc('consultar_disponibilidad_fecha', {
      p_fecha: fecha.toISOString().split('T')[0]
    });
    
    if (error) throw error;
    
    // Filtrar solo horarios disponibles
    return data.filter(h => h.disponible).map(h => ({
      dia_semana: h.dia_semana,
      hora: h.hora,
      disponible: h.disponible
    }));
  } catch (error) {
    console.error('Error al consultar disponibilidad:', error);
    return [];
  }
}

/**
 * Verifica si un cliente está en la lista negra
 * @param {string} telefono - Número de teléfono del cliente
 * @param {string} email - Email del cliente
 * @returns {Object} - Resultado de la verificación { enBlacklist, motivo }
 */
async function verificarCliente(telefono, email) {
  try {
    const { data, error } = await supabase.rpc('verificar_disponibilidad', {
      p_dia_semana: 2, // Valor dummy, solo nos interesa la blacklist
      p_hora: '10:00:00',
      p_fecha: new Date().toISOString().split('T')[0],
      p_telefono: telefono,
      p_email: email
    });
    
    if (error) throw error;
    
    const resultado = data[0] || { disponible: true, motivo: null };
    return {
      enBlacklist: !resultado.disponible && resultado.motivo !== 'Horario no disponible' && resultado.motivo !== 'Ya existe una reserva para esta fecha y hora',
      motivo: resultado.motivo
    };
  } catch (error) {
    console.error('Error al verificar cliente:', error);
    return { enBlacklist: false, motivo: null };
  }
}

/**
 * Crea una nueva reserva
 * @param {Object} reserva - Datos de la reserva
 * @returns {Object} - Resultado de la creación { exito, id, mensaje }
 */
async function crearReserva(reserva) {
  try {
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
      p_programa: programa
    });
    
    if (error) throw error;
    
    return {
      exito: true,
      id: data,
      mensaje: 'Reserva creada exitosamente'
    };
  } catch (error) {
    console.error('Error al crear reserva:', error);
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
    
    return fechas;
  } catch (error) {
    console.error('Error al obtener fechas disponibles:', error);
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
  verificarCliente,
  crearReserva,
  obtenerProximasFechasDisponibles,
  diaSemanaATexto,
  formatearFecha
}; 