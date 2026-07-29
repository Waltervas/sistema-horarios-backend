const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db     = require('../db');
const auth    = require('../middleware/auth');
const permiso = require('../middleware/permiso');

async function getEmpresaIds(usuarioId) {
  const { rows } = await db.query(
    'SELECT empresa_id FROM usuario_empresas WHERE usuario_id = $1 ORDER BY empresa_id',
    [usuarioId]
  );
  return rows.map(r => r.empresa_id);
}

async function setEmpresaIds(usuarioId, empresaIds) {
  await db.query('DELETE FROM usuario_empresas WHERE usuario_id = $1', [usuarioId]);
  if (Array.isArray(empresaIds) && empresaIds.length) {
    for (const eid of empresaIds) {
      await db.query(
        'INSERT INTO usuario_empresas (usuario_id, empresa_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
        [usuarioId, eid]
      );
    }
  }
}

router.get('/', auth(), permiso('usuarios','ver'), async (req, res) => {
  const { rows } = await db.query(
    `SELECT u.id, u.usuario, u.rol, u.empresa_id, u.casino_id,
            COALESCE(array_agg(ue.empresa_id) FILTER (WHERE ue.empresa_id IS NOT NULL), '{}') as empresa_ids
     FROM usuarios u
     LEFT JOIN usuario_empresas ue ON ue.usuario_id = u.id
     GROUP BY u.id
     ORDER BY u.id`
  );
  res.json(rows);
});

router.post('/', auth(), permiso('usuarios','crear'), async (req, res) => {
  const { usuario, password, rol, empresa_id, casino_id, empresa_ids } = req.body;
  const hash = await bcrypt.hash(password, 10);
  const { rows } = await db.query(
    `INSERT INTO usuarios (usuario, password_hash, rol, empresa_id, casino_id)
     VALUES ($1,$2,$3,$4,$5) RETURNING id, usuario, rol, empresa_id, casino_id`,
    [usuario, hash, rol, empresa_id || null, casino_id || null]
  );
  await setEmpresaIds(rows[0].id, empresa_ids);
  res.json({ ...rows[0], empresa_ids: empresa_ids || [] });
});

router.put('/:id', auth(), permiso('usuarios','editar'), async (req, res) => {
  const { usuario, password, rol, empresa_id, casino_id, empresa_ids } = req.body;
  let usuarioRow;
  if (password) {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await db.query(
      `UPDATE usuarios SET usuario=$1, password_hash=$2, rol=$3, empresa_id=$4, casino_id=$5
       WHERE id=$6 RETURNING id, usuario, rol, empresa_id, casino_id`,
      [usuario, hash, rol, empresa_id || null, casino_id || null, req.params.id]
    );
    usuarioRow = rows[0];
  } else {
    const { rows } = await db.query(
      `UPDATE usuarios SET usuario=$1, rol=$2, empresa_id=$3, casino_id=$4
       WHERE id=$5 RETURNING id, usuario, rol, empresa_id, casino_id`,
      [usuario, rol, empresa_id || null, casino_id || null, req.params.id]
    );
    usuarioRow = rows[0];
  }
  await setEmpresaIds(req.params.id, empresa_ids);
  res.json({ ...usuarioRow, empresa_ids: empresa_ids || [] });
});

router.delete('/:id', auth(), permiso('usuarios','eliminar'), async (req, res) => {
  await db.query('DELETE FROM usuarios WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
