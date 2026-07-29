function permiso(modulo, accion) {
  return (req, res, next) => {
    const permisos = req.user?.permisos || {};
    const ok = permisos[modulo] && permisos[modulo][accion];
    if (!ok) return res.status(403).json({ error: 'Sin permiso para esta acción' });
    next();
  };
}

module.exports = permiso;
