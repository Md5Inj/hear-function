// Vercel serverless: все запросы /api/* попадают сюда (см. vercel.json)
const { handle } = require('../server/api');
module.exports = (req, res) => handle(req, res);
