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
    return res.json({
      ativos: 0,
      negociando: 0,
      historico: 0,
      clientes: []
    })
  }

  const db = JSON.parse(fs.readFileSync(DB))
  const agora = Date.now()

  const clientes = Object.entries(db.clientes || {}).map(([nome, dados]) => {
    const restanteMs = dados.dataFim - agora
    const horas = Math.floor(restanteMs / (1000 * 60 * 60))
    const minutos = Math.floor((restanteMs % (1000 * 60 * 60)) / (1000 * 60))

    return {
      nome,
      expira: new Date(dados.dataFim).toLocaleString('pt-BR'),
      restante: `${horas}h ${minutos}min`
    }
  })

  res.json({
    ativos: clientes.length,
    negociando: Object.keys(db.negociacoes || {}).length,
    historico: Object.keys(db.historico || {}).length,
    clientes
  })
})


app.listen(PORT, () => {
  console.log(`📊 Painel Plasma rodando em http://localhost:${PORT}`)
})
