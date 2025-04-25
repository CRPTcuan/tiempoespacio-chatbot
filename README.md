# Sistema de Chatbot con Reservas para Cápsulas QuantumVibe

Este proyecto implementa un chatbot para Cápsulas QuantumVibe que permite a los usuarios realizar reservas para sesiones terapéuticas mediante una conversación natural.

## Características principales

- Chatbot interactivo impulsado por la API de Groq (Llama 3)
- Sistema de reservas simple basado en archivos JSON
- Gestión de disponibilidad de horarios (4 horas diarias)
- Días disponibles: martes a sábado
- Interfaz de chat amigable

## Cómo funciona el sistema de reservas

El sistema almacena las reservas en un archivo JSON local (`data/reservas.json`), lo cual elimina la necesidad de una base de datos externa como Supabase. Esto hace que la implementación sea:

1. Más simple y autónoma
2. Sin problemas de conectividad IPv4/IPv6
3. Fácil de mantener sin dependencias externas

### Estructura de datos

Las reservas se almacenan en el siguiente formato:

```json
{
  "reservas": [
    {
      "id": "1672545138745-123",
      "fecha": "2023-06-15",
      "hora": "10:00",
      "nombre_cliente": "Juan Pérez",
      "telefono": "+56912345678",
      "email": "juan@ejemplo.com",
      "creada_en": "2023-06-10T15:30:45.123Z"
    }
  ]
}
```

### Flujo de reserva

1. **Detección de intención**: El chatbot detecta cuando un usuario quiere hacer una reserva.
2. **Mostrar disponibilidad**: Se muestran los días y horarios disponibles.
3. **Selección de fecha y hora**: El usuario elige cuándo quiere su sesión.
4. **Datos personales**: El chatbot pide nombre y teléfono.
5. **Confirmación**: Se confirman los datos y se crea la reserva.
6. **Finalización**: Se muestra la dirección y detalles finales.

## Configuración

1. Configura tu API key de Groq en el archivo `.env`:
   ```
   GROQ_API_KEY=tu_api_key_aquí
   ```

2. Instala las dependencias:
   ```
   npm install
   ```

3. Inicia el servidor:
   ```
   npm start
   ```

## Estructura de archivos

- `index.js`: Archivo principal de la aplicación.
- `scripts/reservas-manager.js`: Módulo de gestión de reservas.
- `public/`: Archivos estáticos y frontend.
- `data/reservas.json`: Almacenamiento de reservas (se crea automáticamente).

## Posibles mejoras futuras

1. Añadir interfaz de administración para ver y gestionar reservas.
2. Implementar notificaciones por email o SMS.
3. Mejorar el análisis de texto para extraer fechas y horas complejas.
4. Añadir una opción para cancelar reservas existentes. 