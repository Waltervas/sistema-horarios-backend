const router  = require('express').Router();
const db      = require('../db');
const auth    = require('../middleware/auth');
const permiso = require('../middleware/permiso');

router.get('/', auth(), async (req, res) => {
  const { rows } = await db.query('SELECT * FROM empresas ORDER BY id');
  res.json(rows);
});

router.post('/', auth(), permiso('empresas', 'crear'), async (req, res) => {
  const { nombre, nit } = req.body;
  const { rows } = await db.query(
    'INSERT INTO empresas (nombre, nit) VALUES ($1,$2) RETURNING *', [nombre, nit || null]
  );
  res.json(rows[0]);
});

router.put('/:id', auth(), permiso('empresas', 'editar'), async (req, res) => {
  const { nombre, nit } = req.body;
  const { rows } = await db.query(
    'UPDATE empresas SET nombre=$1, nit=$2 WHERE id=$3 RETURNING *',
    [nombre, nit || null, req.params.id]
  );
  res.json(rows[0]);
});

router.delete('/:id', auth(), permiso('empresas', 'eliminar'), async (req, res) => {
  await db.query('DELETE FROM empresas WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
