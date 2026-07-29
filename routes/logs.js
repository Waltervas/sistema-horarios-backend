const router = require('express').Router();
const db     = require('../db');
const auth    = require('../middleware/auth');
const permiso = require('../middleware/permiso');

router.get('/', auth(), permiso('logs','ver'), async (req, res) => {
  const { rows } = await db.query(
    'SELECT * FROM logs ORDER BY ts DESC LIMIT 300'
  );
  res.json(rows);
});

router.get('/horario/:id', auth(), permiso('logs','ver'), async (req, res) => {
  const { rows } = await db.query(
    'SELECT * FROM logs WHERE horario_id = $1 ORDER BY ts ASC',
    [req.params.id]
  );
  res.json(rows);
});

router.post('/', auth(), async (req, res) => {
  const { tipo, descripcion, detalle, horario_id } = req.body;
  const { rows } = await db.query(
    'INSERT INTO logs (tipo, descripcion, detalle, usuario, horario_id) VALUES ($1,$2,$3,$4,$5) RETURNING *',
    [tipo, descripcion, detalle || null, req.user.usuario, horario_id || null]
  );
  res.json(rows[0]);
});

router.delete('/', auth(), permiso('logs','eliminar'), async (req, res) => {
  await db.query('DELETE FROM logs');
  res.json({ ok: true });
});

module.exports = router;
