/*
Este archivo contiene el SQL para configurar la base de datos de Supabase para las reservas de QuantumVibe.
Para ejecutarlo, copia y pega cada bloque SQL en el editor SQL de Supabase.
*/

// PASO 1: Crear tabla de horarios disponibles
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

// PASO 2: Crear tabla de reservas
const crearTablaReservas = `
CREATE TABLE reservas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  horario_id UUID REFERENCES horarios_disponibles(id),
  nombre_cliente TEXT NOT NULL,
  telefono TEXT NOT NULL,
  email TEXT,
  programa TEXT NOT NULL CHECK (programa IN ('descanso_profundo', 'concentracion_foco', 'creatividad')),
  fecha DATE NOT NULL,
  asistio BOOLEAN DEFAULT NULL,
  fecha_creacion TIMESTAMPTZ DEFAULT now(),
  notas TEXT
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

// PASO 3: Crear tabla de clientes blacklist
const crearTablaBlacklist = `
CREATE TABLE clientes_blacklist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  telefono TEXT,
  email TEXT,
  motivo TEXT NOT NULL,
  fecha_creacion TIMESTAMPTZ DEFAULT now(),
  CHECK (telefono IS NOT NULL OR email IS NOT NULL)
);

-- Habilitamos RLS
ALTER TABLE clientes_blacklist ENABLE ROW LEVEL SECURITY;

-- Política para permitir lectura al servicio
CREATE POLICY "Solo el servicio puede leer la blacklist" 
  ON clientes_blacklist FOR SELECT 
  USING (auth.role() = 'service_role');

-- Política para permitir inserción solo al servicio
CREATE POLICY "Solo el servicio puede añadir a la blacklist" 
  ON clientes_blacklist FOR INSERT 
  USING (auth.role() = 'service_role');
`;

// PASO 4: Crear función para verificar disponibilidad
const crearFuncionVerificarDisponibilidad = `
CREATE OR REPLACE FUNCTION verificar_disponibilidad(
  p_dia_semana INTEGER,
  p_hora TIME,
  p_fecha DATE,
  p_telefono TEXT,
  p_email TEXT
) RETURNS TABLE (
  disponible BOOLEAN,
  motivo TEXT
) LANGUAGE plpgsql AS $$
DECLARE
  v_en_blacklist BOOLEAN;
  v_motivo TEXT;
  v_horario_disponible BOOLEAN;
BEGIN
  -- Verificar si el cliente está en blacklist
  SELECT EXISTS (
    SELECT 1 FROM clientes_blacklist 
    WHERE (telefono = p_telefono AND p_telefono IS NOT NULL) 
    OR (email = p_email AND p_email IS NOT NULL)
  ) INTO v_en_blacklist;
  
  IF v_en_blacklist THEN
    SELECT motivo FROM clientes_blacklist 
    WHERE (telefono = p_telefono AND p_telefono IS NOT NULL) 
    OR (email = p_email AND p_email IS NOT NULL)
    LIMIT 1 INTO v_motivo;
    
    RETURN QUERY SELECT false AS disponible, v_motivo;
    RETURN;
  END IF;
  
  -- Verificar si el horario está disponible
  SELECT disponible FROM horarios_disponibles 
  WHERE dia_semana = p_dia_semana 
  AND hora = p_hora 
  INTO v_horario_disponible;
  
  IF v_horario_disponible IS NULL OR NOT v_horario_disponible THEN
    RETURN QUERY SELECT false AS disponible, 'Horario no disponible' AS motivo;
    RETURN;
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
    RETURN QUERY SELECT false AS disponible, 'Ya existe una reserva para esta fecha y hora' AS motivo;
    RETURN;
  END IF;
  
  -- Si llegamos aquí, está disponible
  RETURN QUERY SELECT true AS disponible, NULL AS motivo;
END;
$$;
`;

// PASO 5: Crear función para crear reserva
const crearFuncionCrearReserva = `
CREATE OR REPLACE FUNCTION crear_reserva(
  p_dia_semana INTEGER,
  p_hora TIME,
  p_fecha DATE,
  p_nombre_cliente TEXT,
  p_telefono TEXT,
  p_email TEXT,
  p_programa TEXT
) RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE
  v_horario_id UUID;
  v_reserva_id UUID;
  v_disponible BOOLEAN;
  v_motivo TEXT;
BEGIN
  -- Verificar disponibilidad
  SELECT * FROM verificar_disponibilidad(p_dia_semana, p_hora, p_fecha, p_telefono, p_email)
  INTO v_disponible, v_motivo;
  
  IF NOT v_disponible THEN
    RAISE EXCEPTION 'No es posible realizar la reserva: %', v_motivo;
  END IF;
  
  -- Obtener ID del horario
  SELECT id FROM horarios_disponibles 
  WHERE dia_semana = p_dia_semana AND hora = p_hora
  INTO v_horario_id;
  
  -- Crear la reserva
  INSERT INTO reservas (
    horario_id, nombre_cliente, telefono, email, programa, fecha
  ) VALUES (
    v_horario_id, p_nombre_cliente, p_telefono, p_email, p_programa, p_fecha
  ) RETURNING id INTO v_reserva_id;
  
  RETURN v_reserva_id;
END;
$$;
`;

// PASO 6: Crear función para inicializar horarios disponibles
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

// PASO 7: Crear función para marcar asistencia o inasistencia
const crearFuncionMarcarAsistencia = `
CREATE OR REPLACE FUNCTION marcar_asistencia(
  p_reserva_id UUID,
  p_asistio BOOLEAN,
  p_agregar_blacklist BOOLEAN DEFAULT FALSE,
  p_motivo TEXT DEFAULT NULL
) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  v_telefono TEXT;
  v_email TEXT;
BEGIN
  -- Actualizar estado de asistencia
  UPDATE reservas
  SET asistio = p_asistio
  WHERE id = p_reserva_id
  RETURNING telefono, email INTO v_telefono, v_email;
  
  -- Si no asistió y se debe agregar a blacklist
  IF NOT p_asistio AND p_agregar_blacklist THEN
    INSERT INTO clientes_blacklist (telefono, email, motivo)
    VALUES (v_telefono, v_email, COALESCE(p_motivo, 'No asistió a una reserva sin cancelar'));
  END IF;
END;
$$;
`;

// PASO 8: Crear función para consultar disponibilidad para fechas específicas
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
    (h.disponible AND NOT EXISTS (
      SELECT 1 FROM reservas r 
      WHERE r.horario_id = h.id 
      AND r.fecha = p_fecha
    )) AS disponible
  FROM horarios_disponibles h
  WHERE h.dia_semana = v_dia_semana
  ORDER BY h.hora;
END;
$$;
`;

// PASO 9: Ejecutar inicialización
const ejecutarInicializacion = `
-- Crear horarios iniciales
SELECT inicializar_horarios_semanales();
`;

console.log("Copia y pega estos bloques SQL en el Editor SQL de Supabase:");
console.log("\n--- PASO 1: Crear tabla de horarios disponibles ---\n");
console.log(crearTablaHorarios);
console.log("\n--- PASO 2: Crear tabla de reservas ---\n");
console.log(crearTablaReservas);
console.log("\n--- PASO 3: Crear tabla de clientes blacklist ---\n");
console.log(crearTablaBlacklist);
console.log("\n--- PASO 4: Crear función para verificar disponibilidad ---\n");
console.log(crearFuncionVerificarDisponibilidad);
console.log("\n--- PASO 5: Crear función para crear reserva ---\n");
console.log(crearFuncionCrearReserva);
console.log("\n--- PASO 6: Crear función para inicializar horarios disponibles ---\n");
console.log(crearFuncionInicializarHorarios);
console.log("\n--- PASO 7: Crear función para marcar asistencia ---\n");
console.log(crearFuncionMarcarAsistencia);
console.log("\n--- PASO 8: Crear función para consultar disponibilidad para fechas ---\n");
console.log(crearFuncionConsultarDisponibilidad);
console.log("\n--- PASO 9: Ejecutar inicialización ---\n");
console.log(ejecutarInicializacion); 