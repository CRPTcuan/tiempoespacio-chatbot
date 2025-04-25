const nodemailer = require('nodemailer');

// Configuración de correo electrónico
const EMAIL_SISTEMA = 'QuantumVibeStgo@protonmail.com';

// Crear transporter con la configuración necesaria
// Este es un ejemplo básico - debe configurarse con los datos reales
let transporter = null;

async function inicializarEmailManager() {
  try {
    // Configuración para Protonmail Bridge o proveedor SMTP
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'localhost', // Usar valores de entorno o defaults
      port: process.env.EMAIL_PORT || 587,
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER || EMAIL_SISTEMA,
        pass: process.env.EMAIL_PASSWORD || ''
      }
    });
    
    // Verificar la conexión si estamos en modo de depuración
    if (process.env.NODE_ENV !== 'production') {
      console.log('Intentando verificar la configuración de correo...');
      try {
        // Solo verificamos en modo de desarrollo para evitar errores en producción
        // ya que la verificación puede fallar por restricciones del servidor
        await transporter.verify();
        console.log('Servidor de correo listo para enviar mensajes');
      } catch (error) {
        console.warn('No se pudo verificar el servidor de correo, pero continuamos:', error.message);
        // No lanzamos el error para permitir que la aplicación siga funcionando
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error al inicializar el gestor de correos:', error);
    // Fallar silenciosamente para permitir que la aplicación funcione sin correo
    return false;
  }
}

// Enviar correo de confirmación al cliente
async function enviarConfirmacionCliente(reserva, urlCalendario) {
  if (!transporter) {
    console.warn('Configuración de correo no inicializada. No se enviará correo.');
    return false;
  }

  try {
    const fecha = new Date(reserva.fecha);
    const fechaFormateada = fecha.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const mensaje = {
      from: `"Cápsulas QuantumVibe" <${EMAIL_SISTEMA}>`,
      to: reserva.email,
      subject: `Confirmación de tu reserva en Cápsulas QuantumVibe`,
      text: `
¡Hola ${reserva.nombre_cliente}!

Tu reserva en Cápsulas QuantumVibe ha sido confirmada exitosamente.

📅 Fecha: ${fechaFormateada}
⏰ Hora: ${reserva.hora}
🆔 Número de reserva: ${reserva.id}

📍 DIRECCIÓN:
Calle José Victorino Lastarria 94, local 5, Santiago
(A pasos de Metro Baquedano)

Por favor, llega 5 minutos antes de tu hora reservada. Al llegar, llama al +56 9 4729 5678.

Para agregar esta cita a tu calendario de Google, puedes usar este enlace:
${urlCalendario}

¡Esperamos verte pronto para tu experiencia QuantumVibe!

Si necesitas cambiar o cancelar tu reserva, por favor contáctanos respondiendo a este correo.

Saludos cordiales,
Equipo Cápsulas QuantumVibe
      `,
      html: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
  <h2 style="color: #6a0dad; text-align: center;">¡Tu reserva está confirmada!</h2>
  
  <p>¡Hola <strong>${reserva.nombre_cliente}</strong>!</p>
  
  <p>Tu reserva en Cápsulas QuantumVibe ha sido confirmada exitosamente.</p>
  
  <div style="background-color: #f8f8f8; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <p><strong>📅 Fecha:</strong> ${fechaFormateada}</p>
    <p><strong>⏰ Hora:</strong> ${reserva.hora}</p>
    <p><strong>🆔 Número de reserva:</strong> ${reserva.id}</p>
  </div>
  
  <div style="background-color: #f0e8ff; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <h3 style="color: #6a0dad; margin-top: 0;">📍 DIRECCIÓN:</h3>
    <p>Calle José Victorino Lastarria 94, local 5, Santiago<br>(A pasos de Metro Baquedano)</p>
    <p><strong>Por favor, llega 5 minutos antes de tu hora reservada.</strong><br>Al llegar, llama al +56 9 4729 5678.</p>
  </div>
  
  <p style="text-align: center;">
    <a href="${urlCalendario}" style="display: inline-block; background-color: #6a0dad; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 20px 0;">
      Añadir a Google Calendar
    </a>
  </p>
  
  <p>¡Esperamos verte pronto para tu experiencia QuantumVibe!</p>
  
  <p>Si necesitas cambiar o cancelar tu reserva, por favor contáctanos respondiendo a este correo.</p>
  
  <p>Saludos cordiales,<br>Equipo Cápsulas QuantumVibe</p>
</div>
      `
    };

    const info = await transporter.sendMail(mensaje);
    console.log(`Correo de confirmación enviado al cliente: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error('Error al enviar correo de confirmación al cliente:', error);
    return false;
  }
}

// Enviar notificación de nueva reserva al sistema
async function enviarNotificacionSistema(reserva) {
  if (!transporter) {
    console.warn('Configuración de correo no inicializada. No se enviará correo.');
    return false;
  }

  try {
    const fecha = new Date(reserva.fecha);
    const fechaFormateada = fecha.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const mensaje = {
      from: `"Sistema de Reservas" <${EMAIL_SISTEMA}>`,
      to: EMAIL_SISTEMA,
      subject: `NUEVA RESERVA: ${reserva.nombre_cliente} - ${fechaFormateada} ${reserva.hora}`,
      text: `
NUEVA RESERVA RECIBIDA

Fecha: ${fechaFormateada}
Hora: ${reserva.hora}
ID de Reserva: ${reserva.id}

DATOS DEL CLIENTE:
- Nombre: ${reserva.nombre_cliente}
- Email: ${reserva.email}
- Teléfono: ${reserva.telefono}

Fecha de creación: ${new Date(reserva.creada_en).toLocaleString('es-ES')}
      `,
      html: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
  <h2 style="color: #6a0dad; text-align: center;">NUEVA RESERVA RECIBIDA</h2>
  
  <div style="background-color: #f8f8f8; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <p><strong>Fecha:</strong> ${fechaFormateada}</p>
    <p><strong>Hora:</strong> ${reserva.hora}</p>
    <p><strong>ID de Reserva:</strong> ${reserva.id}</p>
  </div>
  
  <h3 style="color: #6a0dad;">DATOS DEL CLIENTE:</h3>
  <ul>
    <li><strong>Nombre:</strong> ${reserva.nombre_cliente}</li>
    <li><strong>Email:</strong> ${reserva.email}</li>
    <li><strong>Teléfono:</strong> ${reserva.telefono}</li>
  </ul>
  
  <p><small>Fecha de creación: ${new Date(reserva.creada_en).toLocaleString('es-ES')}</small></p>
</div>
      `
    };

    const info = await transporter.sendMail(mensaje);
    console.log(`Notificación de reserva enviada al sistema: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error('Error al enviar notificación de reserva al sistema:', error);
    return false;
  }
}

module.exports = {
  inicializarEmailManager,
  enviarConfirmacionCliente,
  enviarNotificacionSistema
}; 