const router = require('express').Router();
const db     = require('../db');
const auth   = require('../middleware/auth');

router.get('/', auth(), async (req, res) => {
  const { rows } = await db.query('SELECT * FROM empresas ORDER BY id');
  res.json(rows);
});

router.post('/', auth(['Administrador']), async (req, res) => {
  const { nombre } = req.body;
  const { rows } = await db.query(
    'INSERT INTO empresas (nombre) VALUES ($1) RETURNING *', [nombre]
  );
  res.json(rows[0]);
});

router.delete('/:id', auth(['Administrador']), async (req, res) => {
  await db.query('DELETE FROM empresas WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;