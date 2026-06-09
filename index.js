require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const app     = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use('/api/auth',     require('./routes/auth'));
app.use('/api/empresas', require('./routes/empresas'));
app.use('/api/casinos',  require('./routes/casinos'));
app.use('/api/usuarios', require('./routes/usuarios'));
app.use('/api/horarios', require('./routes/horarios'));
app.use('/api/logs',     require('./routes/logs'));

app.get('/api/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));