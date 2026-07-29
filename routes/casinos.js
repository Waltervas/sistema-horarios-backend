const router  = require('express').Router();
const db      = require('../db');
const auth    = require('../middleware/auth');
const permiso = require('../middleware/permiso');

router.get('/', auth(), async (req, res) => {
  const { rows } = await db.query(
    'SELECT c.*, e.nombre as empresa_nombre FROM casinos c JOIN empresas e ON e.id = c.empresa_id ORDER BY c.id'
  );
  res.json(rows);
});

router.post('/', auth(), permiso('empresas', 'crear'), async (req, res) => {
  const { empresa_id, nombre, ciudad } = req.body;
  const { rows } = await db.query(
    'INSERT INTO casinos (empresa_id, nombre, ciudad) VALUES ($1,$2,$3) RETURNING *',
    [empresa_id, nombre, ciudad || null]
  );
  res.json(rows[0]);
});

router.put('/:id', auth(), permiso('empresas', 'editar'), async (req, res) => {
  const { nombre, ciudad } = req.body;
  const { rows } = await db.query(
    'UPDATE casinos SET nombre=$1, ciudad=$2 WHERE id=$3 RETURNING *',
    [nombre, ciudad || null, req.params.id]
  );
  res.json(rows[0]);
});

router.delete('/:id', auth(), permiso('empresas', 'eliminar'), async (req, res) => {
  await db.query('DELETE FROM casinos WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
