const router = require('express').Router();
const db     = require('../db');
const auth    = require('../middleware/auth');
const permiso = require('../middleware/permiso');

// Listar horarios con sus filas
router.get('/', auth(), async (req, res) => {
  const { empresa_id, casino_id, quincena_key } = req.query;
  let where = [];
  let vals  = [];
  let i = 1;
  if (empresa_id)   { where.push(`h.empresa_id = $${i++}`);   vals.push(empresa_id); }
  if (casino_id)    { where.push(`h.casino_id = $${i++}`);    vals.push(casino_id); }
  if (quincena_key) { where.push(`h.quincena_key = $${i++}`); vals.push(quincena_key); }

  const whereStr = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const { rows: horarios } = await db.query(
    `SELECT h.*, c.nombre as casino_nombre, e.nombre as empresa_nombre
     FROM horarios h
     LEFT JOIN casinos  c ON c.id = h.casino_id
     LEFT JOIN empresas e ON e.id = h.empresa_id
     ${whereStr} ORDER BY h.id DESC`,
    vals
  );

  for (const h of horarios) {
    const { rows: filas } = await db.query(
      'SELECT * FROM horario_filas WHERE horario_id = $1 ORDER BY orden, id',
      [h.id]
    );
    h.rows = filas;
  }
  res.json(horarios);
});

// Crear horario
router.post('/', auth(), permiso('horarios_registro','crear'), async (req, res) => {
  const { empleado_nombre, empleado_documento, empleado_cargo,
          empresa_id, casino_id, quincena_year, quincena_mes,
          quincena_q, quincena_key, sig_admin, rows } = req.body;

  const { rows: [h] } = await db.query(
    `INSERT INTO horarios
     (empleado_nombre, empleado_documento, empleado_cargo,
      empresa_id, casino_id, quincena_year, quincena_mes,
      quincena_q, quincena_key, sig_admin, creado_por)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [empleado_nombre, empleado_documento, empleado_cargo,
     empresa_id, casino_id, quincena_year, quincena_mes,
     quincena_q, quincena_key, sig_admin || null, req.user.id]
  );

  if (rows?.length) {
    for (let idx = 0; idx < rows.length; idx++) {
      const r = rows[idx];
      await db.query(
        'INSERT INTO horario_filas (horario_id, fecha, estado, entrada, salida, orden) VALUES ($1,$2,$3,$4,$5,$6)',
        [h.id, r.fecha || null, r.estado, r.entrada || null, r.salida || null, idx]
      );
    }
  }
  h.rows = rows || [];
  res.json(h);
});

// Actualizar horario (RRHH edita / liquida)
router.put('/:id', auth(), async (req,res,next)=>{
  const p=req.user?.permisos?.horarios_registro||{};
  const { rows: [actual] } = await db.query('SELECT estado FROM horarios WHERE id=$1', [req.params.id]);
  if (!actual) return res.status(404).json({ error: 'Horario no encontrado' });
  const pasaALiquidado = req.body.estado === 'Liquidado' && actual.estado !== 'Liquidado';
  if (pasaALiquidado) {
    if (!p.liquidar) return res.status(403).json({ error: 'Sin permiso para liquidar' });
  } else {
    if (actual.estado === 'Liquidado') return res.status(403).json({ error: 'Este horario ya está liquidado y no se puede modificar' });
    if (!p.editar) return res.status(403).json({ error: 'Sin permiso para esta acción' });
  }
  next();
}, async (req, res) => {
  const { empleado_nombre, empleado_documento, empleado_cargo,
          empresa_id, casino_id, estado, sig_admin, sig_empleado, rows } = req.body;

  await db.query(
    `UPDATE horarios SET
     empleado_nombre=$1, empleado_documento=$2, empleado_cargo=$3,
     empresa_id=$4, casino_id=$5, estado=$6,
     sig_admin=COALESCE($7, sig_admin),
     sig_empleado=COALESCE($8, sig_empleado)
     WHERE id=$9`,
    [empleado_nombre, empleado_documento, empleado_cargo,
     empresa_id, casino_id, estado,
     sig_admin || null, sig_empleado || null, req.params.id]
  );

  if (rows) {
    await db.query('DELETE FROM horario_filas WHERE horario_id = $1', [req.params.id]);
    for (let idx = 0; idx < rows.length; idx++) {
      const r = rows[idx];
      await db.query(
        'INSERT INTO horario_filas (horario_id, fecha, estado, entrada, salida, orden) VALUES ($1,$2,$3,$4,$5,$6)',
        [req.params.id, r.fecha || null, r.estado, r.entrada || null, r.salida || null, idx]
      );
    }
  }
  res.json({ ok: true });
});

// Firma del empleado (portal público — sin auth)
router.patch('/:id/firma-empleado', async (req, res) => {
  const { sig_empleado } = req.body;
  const { rows: [h] } = await db.query(
    'UPDATE horarios SET sig_empleado=$1 WHERE id=$2 RETURNING empleado_nombre',
    [sig_empleado, req.params.id]
  );
  if (h) {
    await db.query(
      'INSERT INTO logs (tipo, descripcion, detalle, usuario, horario_id) VALUES ($1,$2,$3,$4,$5)',
      ['firma-emp', `Firma recibida — horario #${req.params.id}`, `Empleado: ${h.empleado_nombre}`, 'Empleado (portal)', req.params.id]
    );
  }
  res.json({ ok: true });
});

// Eliminar
router.delete('/:id', auth(), permiso('horarios_registro','eliminar'), async (req, res) => {
  await db.query('DELETE FROM horarios WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// Obtener un horario por id (para portal de firma pública)
router.get('/:id', async (req, res) => {
  const { rows: [h] } = await db.query(
    `SELECT h.*, c.nombre as casino_nombre, e.nombre as empresa_nombre
     FROM horarios h
     LEFT JOIN casinos  c ON c.id = h.casino_id
     LEFT JOIN empresas e ON e.id = h.empresa_id
     WHERE h.id=$1`,
    [req.params.id]
  );
  if (!h) return res.status(404).json({ error: 'No encontrado' });
  const { rows: filas } = await db.query(
    'SELECT * FROM horario_filas WHERE horario_id=$1 ORDER BY orden,id', [req.params.id]
  );
  h.rows = filas;
  res.json(h);
});

module.exports = router;