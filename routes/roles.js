const router = require('express').Router();
const db     = require('../db');
const auth   = require('../middleware/auth');

const PERMISOS_DEFECTO = {
  empresas:          { ver: false, crear: false, editar: false, eliminar: false },
  usuarios:          { ver: false, crear: false, editar: false, eliminar: false },
  horarios_consulta: { ver: false },
  horarios_registro: { crear: false, editar: false, liquidar: false, eliminar: false },
  logs:              { ver: false, eliminar: false }
};

function normalizarPermisos(permisos) {
  const out = {};
  for (const mod of Object.keys(PERMISOS_DEFECTO)) {
    out[mod] = { ...PERMISOS_DEFECTO[mod] };
    if (permisos && permisos[mod]) {
      for (const accion of Object.keys(PERMISOS_DEFECTO[mod])) {
        if (typeof permisos[mod][accion] === 'boolean') out[mod][accion] = permisos[mod][accion];
      }
    }
  }
  return out;
}

// Gestión de roles: acción reservada al Administrador del sistema (no configurable),
// para evitar que un rol personalizado se otorgue a sí mismo más permisos.
router.get('/', auth(['Administrador']), async (req, res) => {
  const { rows } = await db.query('SELECT * FROM roles ORDER BY id');
  res.json(rows);
});

router.post('/', auth(['Administrador']), async (req, res) => {
  const { nombre, asignacion, permisos } = req.body;
  if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });
  try {
    const { rows } = await db.query(
      `INSERT INTO roles (nombre, es_sistema, asignacion, permisos)
       VALUES ($1, false, $2, $3) RETURNING *`,
      [nombre.trim(), asignacion === 'single_casino' ? 'single_casino' : 'multi_empresa', normalizarPermisos(permisos)]
    );
    res.json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(400).json({ error: 'Ya existe un rol con ese nombre' });
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', auth(['Administrador']), async (req, res) => {
  const { nombre, asignacion, permisos } = req.body;
  const { rows: [rolActual] } = await db.query('SELECT * FROM roles WHERE id=$1', [req.params.id]);
  if (!rolActual) return res.status(404).json({ error: 'Rol no encontrado' });

  const nuevoNombre = rolActual.es_sistema ? rolActual.nombre : (nombre?.trim() || rolActual.nombre);
  try {
    const { rows } = await db.query(
      `UPDATE roles SET nombre=$1, asignacion=$2, permisos=$3 WHERE id=$4 RETURNING *`,
      [nuevoNombre, asignacion === 'single_casino' ? 'single_casino' : 'multi_empresa', normalizarPermisos(permisos), req.params.id]
    );
    // Si cambió el nombre, propagar a los usuarios que tenían el rol viejo
    if (!rolActual.es_sistema && nuevoNombre !== rolActual.nombre) {
      await db.query('UPDATE usuarios SET rol=$1 WHERE rol=$2', [nuevoNombre, rolActual.nombre]);
    }
    res.json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(400).json({ error: 'Ya existe un rol con ese nombre' });
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', auth(['Administrador']), async (req, res) => {
  const { rows: [rol] } = await db.query('SELECT * FROM roles WHERE id=$1', [req.params.id]);
  if (!rol) return res.status(404).json({ error: 'Rol no encontrado' });
  if (rol.es_sistema) return res.status(400).json({ error: 'No se puede eliminar un rol del sistema' });
  const { rows: enUso } = await db.query('SELECT COUNT(*)::int as n FROM usuarios WHERE rol=$1', [rol.nombre]);
  if (enUso[0].n > 0) return res.status(400).json({ error: `Hay ${enUso[0].n} usuario(s) con este rol. Reasígnalos antes de eliminarlo.` });
  await db.query('DELETE FROM roles WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
