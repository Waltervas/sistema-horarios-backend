const router = require('express').Router();
const db     = require('../db');
const auth   = require('../middleware/auth');

router.get('/', auth(['Administrador']), async (req, res) => {
  const { rows } = await db.query(
    'SELECT * FROM logs ORDER BY ts DESC LIMIT 300'
  );
  res.json(rows);
});

router.post('/', auth(), async (req, res) => {
  const { tipo, descripcion, detalle } = req.body;
  await db.query(
    'INSERT INTO logs (tipo, descripcion, detalle, usuario) VALUES ($1,$2,$3,$4)',
    [tipo, descripcion, detalle || null, req.user.usuario]
  );
  res.json({ ok: true });
});

router.delete('/', auth(['Administrador']), async (req, res) => {
  await db.query('DELETE FROM logs');
  res.json({ ok: true });
});

module.exports = router;