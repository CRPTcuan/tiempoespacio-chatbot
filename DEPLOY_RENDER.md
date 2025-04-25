# Despliegue en Render y Configuración de Supabase

Este documento explica cómo configurar correctamente el sistema en Render.com y crear automáticamente las tablas necesarias en Supabase.

## 1. Configuración inicial en Render

1. Crear un nuevo Web Service en Render conectado a tu repositorio de GitHub
2. Configurar las variables de entorno necesarias
3. Ejecutar temporalmente el script de configuración de Supabase
4. Volver al servicio web principal

## 2. Configurar variables de entorno en Render

Configura las siguientes variables de entorno en la sección "Environment" de tu servicio en Render:

| Variable | Valor | Descripción |
|----------|-------|-------------|
| `SUPABASE_URL` | `https://tu-proyecto.supabase.co` | URL de tu proyecto Supabase |
| `SUPABASE_KEY` | `eyJhbGc...` | **Service Role Key** de Supabase (no la anon/public) |
| `GROQ_API_KEY` | `gsk_...` | API Key de Groq para el modelo de lenguaje |

> ⚠️ **IMPORTANTE**: Debes usar la "Service Role Key" de Supabase, no la clave anónima/pública. Esta clave tiene permisos para crear tablas y funciones.

## 3. Ejecutar el script de configuración de Supabase

Para crear automáticamente todas las tablas y funciones en Supabase, sigue estos pasos:

1. En tu servicio de Render, cambia temporalmente el comando de inicio a:
   ```
   npm run setup-supabase
   ```

2. Guarda los cambios y despliega

3. Una vez que el servicio esté en ejecución, accede a la URL de tu servicio de Render
   - Verás una interfaz web con un botón "Iniciar Configuración"
   - Haz clic en ese botón para ejecutar el proceso de configuración
   - Espera a que se complete el proceso (verás los resultados en pantalla)

4. Verifica que todo se haya creado correctamente haciendo clic en "Probar Conexión a Supabase"
   - Deberías ver las tablas y horarios inicializados

5. Una vez verificado, cambia el comando de inicio de vuelta a:
   ```
   npm start
   ```

6. Guarda los cambios y vuelve a desplegar

## 4. Posibles errores y soluciones

### Error: "function "run_sql" does not exist"

Este error ocurre porque Supabase necesita una función especial para ejecutar SQL desde la API. Para crear esta función:

1. Ve al panel de Supabase > SQL Editor
2. Ejecuta el siguiente SQL:

```sql
CREATE OR REPLACE FUNCTION run_sql(sql_query text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql_query;
  RETURN json_build_object('success', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM,
      'errorDetail', SQLSTATE
    );
END;
$$;
```

3. Vuelve a intentar la configuración automática

### Error de conexión

Si hay errores de conexión a Supabase:

1. Verifica que las variables de entorno `SUPABASE_URL` y `SUPABASE_KEY` estén correctamente configuradas
2. Asegúrate de usar la "Service Role Key" de Supabase, no la clave anónima
3. Comprueba que la URL de Supabase no tenga espacios o caracteres adicionales

## 5. Verificación final

Una vez completada la configuración y vuelto al comando de inicio normal, verifica que todo funcione correctamente:

1. Accede a tu aplicación
2. Intenta realizar una reserva completa
3. Comprueba en el panel de Supabase que la reserva se ha guardado correctamente

Si encuentras algún problema, revisa los logs en Render para identificar el error específico. 