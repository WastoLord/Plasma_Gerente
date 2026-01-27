const express = require('express')
const fs = require('fs')
const path = require('path')

const app = express()
const PORT = 3000
const DB = path.join(__dirname, '..', 'plasma_db.json')

// servir o HTML
app.use(express.static(__dirname))

app.get('/status', (req, res) => {
  if (!fs.existsSync(DB)) {
    return res.json({ ativos: 0, negociando: 0, historico: 0 })
  }

  const db = JSON.parse(fs.readFileSync(DB))

  res.json({
    ativos: Object.keys(db.clientes || {}).length,
    negociando: Object.keys(db.negociacoes || {}).length,
    historico: Object.keys(db.historico || {}).length
  })
})

app.listen(PORT, () => {
  console.log(`📊 Painel Plasma rodando em http://localhost:${PORT}`)
})
