const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db     = require('../db');
const auth   = require('../middleware/auth');

router.get('/', auth(['Administrador']), async (req, res) => {
  const { rows } = await db.query(
    'SELECT id, usuario, rol, empresa_id, casino_id FROM usuarios ORDER BY id'
  );
  res.json(rows);
});

router.post('/', auth(['Administrador']), async (req, res) => {
  const { usuario, password, rol, empresa_id, casino_id } = req.body;
  const hash = await bcrypt.hash(password, 10);
  const { rows } = await db.query(
    `INSERT INTO usuarios (usuario, password_hash, rol, empresa_id, casino_id)
     VALUES ($1,$2,$3,$4,$5) RETURNING id, usuario, rol, empresa_id, casino_id`,
    [usuario, hash, rol, empresa_id || null, casino_id || null]
  );
  res.json(rows[0]);
});

router.delete('/:id', auth(['Administrador']), async (req, res) => {
  await db.query('DELETE FROM usuarios WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;