const jwt = require('jsonwebtoken');

function auth(roles = []) {
  return (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Sin token' });
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (roles.length && !roles.includes(decoded.rol)) {
        return res.status(403).json({ error: 'Sin permiso' });
      }
      req.user = decoded;
      next();
    } catch {
      res.status(401).json({ error: 'Token inválido' });
    }
  };
}

module.exports = auth;