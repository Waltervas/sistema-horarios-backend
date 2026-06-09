const router = require('express').Router();
const db     = require('../db');
const auth   = require('../middleware/auth');

router.get('/', auth(), async (req, res) => {
  const { rows } = await db.query(
    'SELECT c.*, e.nombre as empresa_nombre FROM casinos c JOIN empresas e ON e.id = c.empresa_id ORDER BY c.id'
  );
  res.json(rows);
});

router.post('/', auth(['Administrador']), async (req, res) => {
  const { empresa_id, nombre } = req.body;
  const { rows } = await db.query(
    'INSERT INTO casinos (empresa_id, nombre) VALUES ($1,$2) RETURNING *',
    [empresa_id, nombre]
  );
  res.json(rows[0]);
});

router.delete('/:id', auth(['Administrador']), async (req, res) => {
  await db.query('DELETE FROM casinos WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;