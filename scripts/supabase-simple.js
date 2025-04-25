/*
Este archivo contiene el SQL para configurar la base de datos de Supabase para un sistema de reservas simplificado.
Solo incluye lo necesario para gestionar 4 horas al día, de martes a sábado, sin campos de programa.
*/

// PASO 1: Limpiar tablas existentes
const limpiarTablas = `
-- Primero eliminar las tablas existentes si las hay (en orden inverso para respetar las referencias)
DROP TABLE IF EXISTS conversaciones;
DROP TABLE IF EXISTS reservas;
DROP TABLE IF EXISTS clientes_blacklist;
DROP TABLE IF EXISTS horarios_disponibles;
`;

// PASO 2: Crear tabla de horarios disponibles
const crearTablaHorarios = `
CREATE TABLE horarios_disponibles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dia_semana INTEGER NOT NULL, -- 2=martes, 3=miércoles, 4=jueves, 5=viernes, 6=sábado
  hora TIME NOT NULL,
  disponible BOOLEAN DEFAULT TRUE,
  UNIQUE(dia_semana, hora)
);

-- Habilitamos RLS (Row Level Security)
ALTER TABLE horarios_disponibles ENABLE ROW LEVEL SECURITY;

-- Política para permitir lectura anónima
CREATE POLICY "Horarios disponibles son accesibles por todos" 
  ON horarios_disponibles FOR SELECT 
  USING (true);

-- Política para permitir actualización solo por servicio
CREATE POLICY "Solo el servicio puede actualizar horarios" 
  ON horarios_disponibles FOR UPDATE 
  USING (auth.role() = 'service_role');
`;

// PASO 3: Crear tabla de reservas simplificada (sin programa)
const crearTablaReservas = `
CREATE TABLE reservas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  horario_id UUID REFERENCES horarios_disponibles(id),
  nombre_cliente TEXT NOT NULL,
  telefono TEXT NOT NULL,
  email TEXT,
  fecha DATE NOT NULL,
  fecha_creacion TIMESTAMPTZ DEFAULT now()
);

-- Habilitamos RLS
ALTER TABLE reservas ENABLE ROW LEVEL SECURITY;

-- Política para permitir inserción anónima
CREATE POLICY "Cualquiera puede crear reservas" 
  ON reservas FOR INSERT 
  USING (true);

-- Política para permitir lectura solo al servicio
CREATE POLICY "Solo el servicio puede leer todas las reservas" 
  ON reservas FOR SELECT 
  USING (auth.role() = 'service_role');
`;

// PASO 4: Crear función para verificar disponibilidad simplificada
const crearFuncionVerificarDisponibilidad = `
CREATE OR REPLACE FUNCTION verificar_disponibilidad(
  p_dia_semana INTEGER,
  p_hora TIME,
  p_fecha DATE
) RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE
  v_horario_disponible BOOLEAN;
BEGIN
  -- Verificar si el horario está disponible
  SELECT disponible FROM horarios_disponibles 
  WHERE dia_semana = p_dia_semana 
  AND hora = p_hora 
  INTO v_horario_disponible;
  
  IF v_horario_disponible IS NULL OR NOT v_horario_disponible THEN
    RETURN FALSE;
  END IF;
  
  -- Verificar si ya existe una reserva para ese día y hora
  IF EXISTS (
    SELECT 1 FROM reservas 
    WHERE fecha = p_fecha 
    AND horario_id = (
      SELECT id FROM horarios_disponibles 
      WHERE dia_semana = p_dia_semana AND hora = p_hora
    )
  ) THEN
    RETURN FALSE;
  END IF;
  
  -- Si llegamos aquí, está disponible
  RETURN TRUE;
END;
$$;
`;

// PASO 5: Crear función para crear reserva simplificada
const crearFuncionCrearReserva = `
CREATE OR REPLACE FUNCTION crear_reserva(
  p_dia_semana INTEGER,
  p_hora TIME,
  p_fecha DATE,
  p_nombre_cliente TEXT,
  p_telefono TEXT,
  p_email TEXT
) RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE
  v_horario_id UUID;
  v_reserva_id UUID;
  v_disponible BOOLEAN;
BEGIN
  -- Verificar disponibilidad
  SELECT verificar_disponibilidad(p_dia_semana, p_hora, p_fecha) INTO v_disponible;
  
  IF NOT v_disponible THEN
    RAISE EXCEPTION 'No es posible realizar la reserva: Horario no disponible';
  END IF;
  
  -- Obtener ID del horario
  SELECT id FROM horarios_disponibles 
  WHERE dia_semana = p_dia_semana AND hora = p_hora
  INTO v_horario_id;
  
  -- Crear la reserva
  INSERT INTO reservas (
    horario_id, nombre_cliente, telefono, email, fecha
  ) VALUES (
    v_horario_id, p_nombre_cliente, p_telefono, p_email, p_fecha
  ) RETURNING id INTO v_reserva_id;
  
  RETURN v_reserva_id;
END;
$$;
`;

// PASO 6: Crear función para consultar disponibilidad para fechas específicas
const crearFuncionConsultarDisponibilidad = `
CREATE OR REPLACE FUNCTION consultar_disponibilidad_fecha(
  p_fecha DATE
) RETURNS TABLE (
  dia_semana INTEGER,
  hora TIME,
  disponible BOOLEAN
) LANGUAGE plpgsql AS $$
DECLARE
  v_dia_semana INTEGER := EXTRACT(DOW FROM p_fecha)::INTEGER;
BEGIN
  RETURN QUERY
  SELECT 
    h.dia_semana,
    h.hora,
    h.disponible AND NOT EXISTS (
      SELECT 1 FROM reservas r
      WHERE r.fecha = p_fecha
      AND r.horario_id = h.id
    ) AS disponible
  FROM horarios_disponibles h
  WHERE h.dia_semana = v_dia_semana
  ORDER BY h.hora;
END;
$$;
`;

// PASO 7: Crear función para inicializar horarios
const crearFuncionInicializarHorarios = `
CREATE OR REPLACE FUNCTION inicializar_horarios_semanales() RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  v_dias INTEGER[] := ARRAY[2, 3, 4, 5, 6]; -- Martes a sábado
  v_horas TIME[] := ARRAY['10:00:00'::TIME, '12:00:00'::TIME, '15:00:00'::TIME, '17:00:00'::TIME];
  v_dia INTEGER;
  v_hora TIME;
BEGIN
  -- Limpiar tabla existente
  DELETE FROM horarios_disponibles;
  
  -- Crear horarios para cada día y hora
  FOREACH v_dia IN ARRAY v_dias LOOP
    FOREACH v_hora IN ARRAY v_horas LOOP
      INSERT INTO horarios_disponibles (dia_semana, hora, disponible)
      VALUES (v_dia, v_hora, TRUE);
    END LOOP;
  END LOOP;
END;
$$;
`;

// PASO 8: Inicializar horarios
const ejecutarInicializacion = `
-- Inicializar los horarios
SELECT inicializar_horarios_semanales();
`;

console.log("Copia y pega estos bloques SQL en el Editor SQL de Supabase:");
console.log("\n--- PASO 1: Limpiar tablas existentes ---\n");
console.log(limpiarTablas);

console.log("\n--- PASO 2: Crear tabla de horarios disponibles ---\n");
console.log(crearTablaHorarios);

console.log("\n--- PASO 3: Crear tabla de reservas (simplificada) ---\n");
console.log(crearTablaReservas);

console.log("\n--- PASO 4: Crear función para verificar disponibilidad (simplificada) ---\n");
console.log(crearFuncionVerificarDisponibilidad);

console.log("\n--- PASO 5: Crear función para crear reserva (simplificada) ---\n");
console.log(crearFuncionCrearReserva);

console.log("\n--- PASO 6: Crear función para consultar disponibilidad ---\n");
console.log(crearFuncionConsultarDisponibilidad);

console.log("\n--- PASO 7: Crear función para inicializar horarios ---\n");
console.log(crearFuncionInicializarHorarios);

console.log("\n--- PASO 8: Inicializar horarios ---\n");
console.log(ejecutarInicializacion);

// Exportar para uso en otros scripts
module.exports = {
  limpiarTablas,
  crearTablaHorarios,
  crearTablaReservas,
  crearFuncionVerificarDisponibilidad,
  crearFuncionCrearReserva,
  crearFuncionConsultarDisponibilidad,
  crearFuncionInicializarHorarios,
  ejecutarInicializacion
}; 