const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const db      = require('../db');

router.post('/login', async (req, res) => {
  const { usuario, password } = req.body;
  try {
    const { rows } = await db.query(
      'SELECT * FROM usuarios WHERE usuario = $1', [usuario]
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Credenciales incorrectas' });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Credenciales incorrectas' });

    const { rows: ueRows } = await db.query(
      'SELECT empresa_id FROM usuario_empresas WHERE usuario_id = $1 ORDER BY empresa_id',
      [user.id]
    );
    const empresa_ids = ueRows.map(r => r.empresa_id);

    const { rows: rolRows } = await db.query('SELECT * FROM roles WHERE nombre = $1', [user.rol]);
    const rolInfo = rolRows[0];
    const permisos = rolInfo ? rolInfo.permisos : {};
    const asignacion = rolInfo ? rolInfo.asignacion : 'multi_empresa';

    const token = jwt.sign(
      { id: user.id, usuario: user.usuario, rol: user.rol,
        empresa_id: user.empresa_id, casino_id: user.casino_id, empresa_ids,
        permisos, asignacion },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );
    res.json({ token, id: user.id, usuario: user.usuario, rol: user.rol,
               empresa_id: user.empresa_id, casino_id: user.casino_id, empresa_ids,
               permisos, asignacion });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;