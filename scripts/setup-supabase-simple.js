require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3002;

// Importar los scripts SQL simplificados
const sqlScripts = require('./supabase-simple');

// Configuración de Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('ERROR: Variables de entorno SUPABASE_URL y/o SUPABASE_KEY no configuradas');
  console.error('Asegúrate de que estas variables estén configuradas en Render o en un archivo .env');
  process.exit(1);
}

// Crear cliente de Supabase
const supabase = createClient(supabaseUrl, supabaseKey);

// Función asincrónica para ejecutar los scripts SQL
async function ejecutarScriptsSQL() {
  const resultados = {};
  
  try {
    // Primero crear la función run_sql
    const crearFuncionRunSQL = `
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
    `;

    // Intentar crear la función directamente
    try {
      const { data, error } = await supabase.from('horarios_disponibles').select('id').limit(1);
      console.log('Verificando conexión a Supabase...');
      
      // Si no hay error de conexión, intentar crear la función run_sql
      if (!error || error.code === 'PGRST109') {
        console.log('Intentando crear función run_sql...');
        
        try {
          const { error: sqlError } = await supabase.rpc('run_sql', {
            sql_query: crearFuncionRunSQL
          });
          
          if (sqlError) {
            console.log('Error al crear función run_sql, intentando otro método...');
          } else {
            console.log('✅ Función run_sql creada correctamente');
            resultados['crearFuncionRunSQL'] = { estado: 'OK' };
          }
        } catch (e) {
          console.log('Error al llamar a run_sql, intentando otro método...');
        }
      }
    } catch (e) {
      console.log('Error al verificar conexión, intentando otro método...');
    }

    // Ejecutar los scripts SQL en orden
    const scripts = [
      { nombre: 'Limpiar tablas', script: sqlScripts.limpiarTablas },
      { nombre: 'Crear tabla horarios', script: sqlScripts.crearTablaHorarios },
      { nombre: 'Crear tabla reservas', script: sqlScripts.crearTablaReservas },
      { nombre: 'Crear función verificar disponibilidad', script: sqlScripts.crearFuncionVerificarDisponibilidad },
      { nombre: 'Crear función crear reserva', script: sqlScripts.crearFuncionCrearReserva },
      { nombre: 'Crear función consultar disponibilidad', script: sqlScripts.crearFuncionConsultarDisponibilidad },
      { nombre: 'Crear función inicializar horarios', script: sqlScripts.crearFuncionInicializarHorarios },
      { nombre: 'Inicializar horarios', script: sqlScripts.ejecutarInicializacion }
    ];

    for (const { nombre, script } of scripts) {
      console.log(`Ejecutando: ${nombre}...`);
      
      try {
        const { error } = await supabase.rpc('run_sql', { sql_query: script });
        
        if (error) {
          console.error(`Error al ejecutar ${nombre}: ${error.message}`);
          resultados[nombre] = { estado: 'Error', mensaje: error.message };
        } else {
          console.log(`✅ ${nombre} ejecutado correctamente`);
          resultados[nombre] = { estado: 'OK' };
        }
      } catch (error) {
        console.error(`Error al ejecutar ${nombre}: ${error.message}`);
        resultados[nombre] = { estado: 'Error', mensaje: error.message };
      }
    }
    
    return resultados;
  } catch (error) {
    console.error('Error general:', error.message);
    return { error: error.message };
  }
}

// Ruta para ejecutar la configuración
app.get('/setup', async (req, res) => {
  try {
    const resultados = await ejecutarScriptsSQL();
    res.json({
      mensaje: 'Proceso de configuración completado',
      resultados
    });
  } catch (error) {
    res.status(500).json({
      error: 'Error durante la configuración',
      mensaje: error.message
    });
  }
});

// Ruta para la página principal
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Configuración Simplificada de Supabase</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; line-height: 1.6; }
          h1 { color: #333; }
          button { background: #4CAF50; color: white; border: none; padding: 10px 15px; cursor: pointer; border-radius: 4px; }
          button:hover { background: #45a049; }
          pre { background: #f5f5f5; padding: 15px; border-radius: 4px; overflow: auto; }
          .error { color: #D32F2F; }
          .success { color: #388E3C; }
          .warning { color: #FF9800; background-color: #FFF3E0; padding: 10px; border-radius: 4px; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <h1>Configuración Simplificada de Supabase para Reservas</h1>
        <p>Este asistente configurará las tablas y funciones necesarias para un sistema de reservas simple con 4 horas al día, de martes a sábado.</p>
        
        <div class="warning">
          <strong>⚠️ Importante:</strong>
          <ul>
            <li>Asegúrate de que las variables de entorno SUPABASE_URL y SUPABASE_KEY estén configuradas correctamente.</li>
            <li>Debes usar la <strong>Service Role Key</strong> de Supabase (no la clave anónima).</li>
            <li>Este script eliminará las tablas existentes y creará una estructura simplificada.</li>
          </ul>
        </div>
        
        <button id="setupButton">Iniciar Configuración</button>
        <div id="result" style="margin-top: 20px;"></div>
        
        <script>
          document.getElementById('setupButton').addEventListener('click', async () => {
            const resultDiv = document.getElementById('result');
            resultDiv.innerHTML = '<p>Configurando Supabase... Por favor, espera.</p>';
            
            try {
              const response = await fetch('/setup');
              const data = await response.json();
              
              if (data.error) {
                resultDiv.innerHTML = \`
                  <h2 class="error">❌ Error en la Configuración</h2>
                  <p>\${data.error}</p>
                  <p><strong>Detalles:</strong> \${data.mensaje || 'Sin detalles adicionales'}</p>
                \`;
              } else {
                let resultadosHTML = '<ul>';
                for (const [nombre, resultado] of Object.entries(data.resultados)) {
                  const iconoEstado = resultado.estado === 'OK' ? '✅' : '❌';
                  resultadosHTML += \`<li>\${iconoEstado} <strong>\${nombre}:</strong> \${resultado.estado} \${resultado.mensaje ? '- ' + resultado.mensaje : ''}</li>\`;
                }
                resultadosHTML += '</ul>';
                
                resultDiv.innerHTML = \`
                  <h2 class="success">🎉 Configuración Completada</h2>
                  <p>\${data.mensaje}</p>
                  <h3>Resultados:</h3>
                  \${resultadosHTML}
                  
                  <div class="warning">
                    <p><strong>Próximos pasos:</strong></p>
                    <ol>
                      <li>Una vez verificado que todo funciona correctamente, regresa al panel de Render</li>
                      <li>Cambia el comando de inicio de vuelta a <code>npm start</code></li>
                      <li>Haz clic en "Deploy" para aplicar los cambios</li>
                    </ol>
                  </div>
                \`;
              }
            } catch (error) {
              resultDiv.innerHTML = \`
                <h2 class="error">❌ Error</h2>
                <p>No se pudo completar la configuración: \${error.message}</p>
              \`;
            }
          });
        </script>
      </body>
    </html>
  `);
});

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Servidor de configuración simplificada ejecutándose en http://localhost:${PORT}`);
  console.log('Accede a esta URL en tu navegador para configurar Supabase');
}); 