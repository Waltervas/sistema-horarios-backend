# Sistema de Horarios — Backend

API en Node.js/Express que da servicio al frontend de gestión de horarios para casinos. Se conecta a PostgreSQL en Supabase. El repo hermano `sistema-horarios-fronten` (un solo `index.html`) es el consumidor de esta API.

## Stack
- Node.js + Express
- PostgreSQL (Supabase), acceso vía `db.js` (pool de `pg`)
- Auth con JWT (`middleware/auth.js`)
- Permisos granulares por rol (`middleware/permiso.js`)
- Local: `node index.js`, puerto 3000. No desplegado actualmente (Railway se pausó por fin de trial gratis).

## Estructura
```
index.js                  # monta las rutas
db.js                      # conexión a Postgres
middleware/auth.js         # valida JWT, adjunta req.user (incluye permisos y asignación del rol)
middleware/permiso.js      # valida req.user.permisos[modulo][accion]
routes/
  auth.js                  # login — trae permisos/asignación del rol desde la tabla roles
  empresas.js               # CRUD empresas y casinos (mismo archivo)
  casinos.js
  usuarios.js               # CRUD usuarios (incluye nombre/apellido/cargo/correo, multi-empresa)
  horarios.js                # CRUD horarios + filas (horario_filas), liquidar
  roles.js                   # CRUD de roles — SIEMPRE auth(['Administrador']), nunca detrás de permiso() (evita escalar privilegios)
  logs.js                     # auditoría
```

## Tablas clave en Supabase
- `empresas`, `casinos` (con `nit`, `ciudad`)
- `usuarios` (con `empresa_id`, `casino_id`, `nombre`, `apellido`, `cargo`, `correo`)
- `usuario_empresas` — join table para usuarios multi-empresa (RRHH/Supervisor pueden tener 0+ empresas asignadas; ninguna marcada = acceso a todas)
- `roles` — `nombre`, `es_sistema` (bool, no se puede borrar/renombrar), `asignacion` (`multi_empresa` | `single_casino`), `permisos` (JSONB granular por módulo/acción)
- `horarios` — cabecera de cada registro de turno (empleado, empresa, casino, quincena, firmas base64 `sig_admin`/`sig_empleado`, estado: Pendiente/Procesado/Liquidado)
- `horario_filas` — cada día del horario: `fecha`, `estado` (Horario/Descanso/Compensatorio/Incapacidad/Vacaciones), `entrada`, `entrada_hasta`, `salida`, `salida_hasta` (rangos, no horas exactas — ver lógica de liquidación abajo), `orden`
- `logs` — auditoría de toda acción relevante, con `horario_id` opcional (ON DELETE SET NULL)

## Sistema de permisos (roles)
Cada rol tiene un objeto `permisos` con esta forma:
```json
{
  "empresas": {"ver":bool,"crear":bool,"editar":bool,"eliminar":bool},
  "usuarios": {"ver":bool,"crear":bool,"editar":bool,"eliminar":bool},
  "horarios_consulta": {"ver":bool},
  "horarios_registro": {"crear":bool,"editar":bool,"liquidar":bool,"eliminar":bool},
  "logs": {"ver":bool,"eliminar":bool}
}
```
El JWT embebe los permisos al login — si se editan los permisos de un rol, los usuarios logueados no lo ven hasta volver a iniciar sesión.

**Importante — separación editar vs liquidar**: `PUT /horarios/:id` exige específicamente `permisos.horarios_registro.liquidar` cuando el body pone `estado: 'Liquidado'`, y `editar` para cualquier otro cambio. Un horario ya liquidado no se puede volver a modificar por nadie. No relajar este chequeo.

## Lógica de liquidación (la parte más delicada del sistema)
Vive en el **frontend** (`clasificar()`, `liquidarUno()` en `index.html`), no en el backend — el backend solo persiste `entrada`/`entrada_hasta`/`salida`/`salida_hasta` por fila tal cual.

Reglas de negocio vigentes (confirmadas con el cliente, no cambiar sin que lo pida explícitamente):
- **Entrada y Salida son bloques de trabajo reales** (ej. turno partido), no horas exactas — se suma la duración de cada bloque.
- **Jornada diaria: 7 horas** (no 8). Todo lo que exceda 7h acumuladas en el día es "extra".
- **Recargo nocturno (HRN): 7pm a 6am.**
- **Domingo/festivo se determina por el minuto real del calendario**, no por la fecha fija de la fila — un turno que cruza medianoche hacia un domingo divide correctamente sus horas entre el día normal y el festivo.
- **HRFD/HRFN (recargo festivo compensado) vs HRFDSC/HRFNSC (sin compensar)**: se decide revisando si el empleado tiene un día `Compensatorio` registrado en la **semana siguiente** a ese domingo/festivo trabajado (no por "3+ domingos al mes", esa regla vieja ya no aplica).
- Un día `Compensatorio` cuenta como 7 horas de jornada normal para el total semanal (comparado contra las 42h/semana legales).
- 9 conceptos de nómina discriminados: HRN, HED, HEN, HEFD, HEFN, HRFD, HRFN, HRFDSC, HRFNSC. La liquidación **solo muestra cantidad de horas por concepto, nunca valor en pesos** (decisión explícita del cliente).

## Convenciones
- Nombres de columnas en snake_case tal cual llegan del frontend en los bodies (`empresa_id`, `casino_id`, `entrada_hasta`, etc.) — no hay capa de transformación camelCase↔snake_case en las rutas de horarios.
- Todas las rutas mutantes registran en `logs` vía el frontend (`addLog`), no desde el backend (excepción: nada especial aquí, el backend es tonto respecto a logs, solo persiste lo que le mandan).
- Antes de escribir SQL nuevo (ALTER TABLE, etc.), recordar que las migraciones de sesiones anteriores a veces **no se corrieron realmente en Supabase** aunque se hayan compartido — si algo falla con "column does not exist" o "relation does not exist", lo primero es verificar en el Table Editor de Supabase antes de asumir que el código está mal.

## Cómo correr esto en VS Code

1. Abre esta carpeta (`sistema-horarios-backend`) como workspace en VS Code (`File → Open Folder`).
2. Terminal integrada (`` Ctrl+` ``): `npm install` la primera vez.
3. Confirma que exista un archivo `.env` en la raíz con:
   ```
   DATABASE_URL=postgresql://...   # connection string de Supabase (Settings → Database → Connection string)
   JWT_SECRET=algo-largo-y-secreto
   PORT=3000
   ```
   Si no existe, créalo — nunca lo subas a git (ya está en `.gitignore`).
4. Arranca el servidor: `node index.js` (o `npm start` si existe ese script). Debe imprimir algo como "Servidor en puerto 3000" sin errores.
5. Deja esta terminal corriendo mientras trabajas — el frontend le pega directo a `http://localhost:3000/api`.
6. Si cambias algo en `routes/*.js`, hay que **reiniciar manualmente** (`Ctrl+C` y volver a correr `node index.js`) salvo que instales `nodemon` (`npm i -D nodemon`, y correr `npx nodemon index.js` en su lugar para que reinicie solo al guardar).

### Gotchas ya vividos en este proyecto
- Varias veces una migración SQL se dio por corrida pero **nunca se ejecutó realmente en Supabase** — si algo falla con `relation "X" does not exist` o `column "X" does not exist`, ve primero al **Table Editor de Supabase** a confirmar que la tabla/columna existe antes de asumir que el código tiene un bug.
- Si el login falla con `password authentication failed` o similar, revisa que `DATABASE_URL` en `.env` tenga la contraseña correcta y esté bien copiada (sin saltos de línea ni comillas de más).
- Los errores 500 casi siempre traen el mensaje real en el **body de la respuesta**, no solo en la consola del navegador — revisa la pestaña Network → click en la petición fallida → Response, ahí sale el error de Postgres tal cual (ej. "column X does not exist").

## Credenciales (rotar en algún momento, están en texto plano en `.env` local)
Ver `.env` local — no committeado (ya se corrigió el `.gitignore` que antes tenía comillas literales inválidas).
