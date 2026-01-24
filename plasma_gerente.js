'use strict'
const mineflayer = require('mineflayer')
const fs = require('fs')
const readline = require('readline')
const { exec } = require('child_process')
const path = require('path')

// --- CONFIGURAÇÃO ---
const CONFIG = {
  host: 'jogar.craftsapiens.com.br',
  port: 25565,
  username: 'Plasma_Gerente',
  password: process.env.GERENTE_PASSWORD || '***REMOVED***',
  auth: 'offline',
  version: '1.21.4',
  admins: ['WastoLord_13'],
  precoSemana: 5000000,
  idItemMao: 'diamond',
  idItemAlvo: 'golden_axe'
}

const BLOQUEAR_LOGS = ['PartialReadError', 'protodef', 'packet_world_particles', 'eval at compile', 'DeprecationWarning', 'punycode', 'physicTick', 'Chunk size', 'buffer :', 'ECONNRESET', 'ETIMEDOUT']
function deveBloquear(str) { if (!str) return false; return BLOQUEAR_LOGS.some(t => str.toString().includes(t)) }
const originalStderrWrite = process.stderr.write
process.stderr.write = function(chunk) { if (deveBloquear(chunk)) return false; return originalStderrWrite.apply(process.stderr, arguments) }
const originalConsoleError = console.error
console.error = function(...args) { if (args.some(arg => deveBloquear(arg))) return; originalConsoleError.apply(console, args) }
process.on('uncaughtException', (err) => { if (err && err.code === 'ECONNRESET') return })
process.on('unhandledRejection', () => {})

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
rl.on('line', (input) => {
  if (input.trim() === 'pendentes') return verificarPendencias()
  if (bot?.entity) { bot.chat(input); console.log(`[Gerente] > ${input}`) }
})

const DB_FILE = path.resolve(__dirname, 'plasma_db.json')
let db = { clientes: {}, negociacoes: {}, reembolsos: [] }
let bot = null, loopLobby = null, loopExpiracao = null

if (fs.existsSync(DB_FILE)) { try { const l = JSON.parse(fs.readFileSync(DB_FILE)); db = { ...db, ...l } } catch (e) { console.error('Erro lendo DB', e) } }
function salvarDB() { try { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)) } catch (e) { console.error('Erro salvando DB', e) } }

function iniciarGerente() {
  console.log(`🔌 Conectando Gerente...`)
  if (loopLobby) clearInterval(loopLobby); if (loopExpiracao) clearInterval(loopExpiracao)
  bot = mineflayer.createBot(CONFIG)

  bot.on('spawn', () => {
    console.log('✅ Gerente Online!')
    setTimeout(() => bot.chat('/login ' + CONFIG.password), 2000)
    loopExpiracao = setInterval(verificarExpiracoes, 600000)
    iniciarLoopLobby()
    setTimeout(restaurarSessoesAntigas, 5000)
  })

  bot.on('end', () => setTimeout(iniciarGerente, 15000))
  bot.on('error', (err) => { if (!deveBloquear(err?.message || '')) console.log(`🚨 Erro: ${err?.message || err}`) })

  bot.on('windowOpen', (w) => {
    if (w.type === 'minecraft:inventory') return
    const alvo = w.slots.find(i => i && i.name && i.name.includes(CONFIG.idItemAlvo))
    if (alvo) { bot.clickWindow(alvo.slot, 0, 0); setTimeout(() => { if (bot.currentWindow) bot.closeWindow(bot.currentWindow); if (loopLobby) clearInterval(loopLobby) }, 1000) }
  })

  bot.on('message', (jsonMsg) => {
    const msg = jsonMsg.toString(); if (msg.trim().length > 0) console.log(`[S] ${msg}`)
    if (jsonMsg) tratarLoginAuth(bot, jsonMsg)
    if (msg.toLowerCase().includes('/registrar') || msg.includes('não foi registrado')) setTimeout(() => bot.chat(`/register ${CONFIG.password} ${CONFIG.password}`), 1500)
    processarPagamento(msg)
  })
  bot.on('chat', (u, m) => { if (u !== bot.username) tratarComandosCliente(u, m) })
}

function iniciarLoopLobby() {
  if (loopLobby) clearInterval(loopLobby)
  loopLobby = setInterval(() => {
    if (!bot || !bot.inventory) return
    const item = bot.inventory.items().find(i => i && i.name && i.name.includes(CONFIG.idItemMao))
    if (item) bot.equip(item, 'hand').then(() => bot.activateItem()).catch(() => {})
  }, 15000)
}

function tratarComandosCliente(username, messageRaw) {
  const message = messageRaw.replace(/\./g, '').trim().toLowerCase()
  if (message === 'negociar') {
    if (db.clientes[username]) bot.chat(`/tell ${username} Já possui bot! Para renovar digite confirmar.`)
    else bot.chat(`/tell ${username} Aluguel: $${formatarDinheiro(CONFIG.precoSemana)}. Digite: confirmar`)
    db.negociacoes[username] = { estado: 'aguardando_confirmacao', timestamp: Date.now() }
    salvarDB()
  } else if (message === 'confirmar') {
    if (db.negociacoes[username]?.estado === 'aguardando_confirmacao') {
      bot.chat(`/tell ${username} Mande PIX de $${formatarDinheiro(CONFIG.precoSemana)} (/pix ${bot.username} ${CONFIG.precoSemana}).`)
      db.negociacoes[username].estado = 'aguardando_pagamento'
      salvarDB()
    }
  }
}

function processarPagamento(msg) {
  const match = msg.match(/\[PIX\] Você recebeu ([\d.,]+) de (\w+)/i)
  if (match) {
    const valor = parseFloat(match[1].replace(/\./g, '').replace(',', '.'))
    const pagador = match[2]
    console.log(`💰 PIX: ${valor} de ${pagador}`)

    if (db.negociacoes[pagador]?.estado === 'aguardando_pagamento') {
      if (Math.abs(valor - CONFIG.precoSemana) < 100) aceitarContrato(pagador)
      else reembolsarSeguro(pagador, valor, "Valor incorreto")
    } else reembolsarSeguro(pagador, valor, "Sem negociação")
  }
}

function reembolsarSeguro(cliente, valor, motivo) {
  if (!db.reembolsos) db.reembolsos = []
  db.reembolsos.push({ id: Date.now(), cliente, valor, status: 'PENDENTE' })
  salvarDB()
  setTimeout(() => {
    bot.chat(`/pix ${cliente} ${valor}`)
    setTimeout(() => bot.chat(`/tell ${cliente} Reembolso: ${motivo}`), 1000)
  }, 2000)
}

function aceitarContrato(cliente) {
  const duracao = 7 * 24 * 60 * 60 * 1000
  const nickLimpo = cliente.replace(/[^a-zA-Z0-9_]/g, '').substring(0, 8)
  const botName = `Plasma_${nickLimpo}`.substring(0, 15)

  if (db.clientes[cliente]) {
    db.clientes[cliente].dataFim = Math.max(Date.now(), db.clientes[cliente].dataFim) + duracao
    bot.chat(`/tell ${cliente} Renovado!`)
    iniciarSessaoTmux(cliente, db.clientes[cliente].botName, true)
  } else {
    bot.chat(`/tell ${cliente} Criando bot ${botName}...`)
    db.clientes[cliente] = { botName, dataInicio: Date.now(), dataFim: Date.now() + duracao, lojaId: 'loja' }
    iniciarSessaoTmux(cliente, botName)
  }
  delete db.negociacoes[cliente]
  salvarDB()
}

function iniciarSessaoTmux(cliente, botName, restauracao = false) {
  const clienteSanit = cliente.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase().substring(0, 8)
  const sessionName = `plasma_${clienteSanit}`
  const comando = `tmux new-session -d -s ${sessionName} "node worker_loader.js ${cliente} ${botName} loja"`

  console.log(`[SYSTEM] Executando: ${comando}`)
  exec(comando, (error, stdout, stderr) => {
    if (error) {
      console.error('Erro ao criar sessão tmux', error)
      return
    }
    if (!error && !restauracao) {
      setTimeout(() => {
        bot.chat(`/tell ${cliente} Bot online: ${botName}. Mande 'help' no tell dele.`)
      }, 5000)
    }
  })
}

function restaurarSessoesAntigas() {
  console.log("♻️ Restaurando bots...")
  for (const [cliente, dados] of Object.entries(db.clientes)) {
    if (dados.dataFim > Date.now()) iniciarSessaoTmux(cliente, dados.botName, true)
    else delete db.clientes[cliente]
  }
  salvarDB()
}

function verificarExpiracoes() {
  for (const [cliente, dados] of Object.entries(db.clientes)) {
    if (Date.now() > dados.dataFim) {
      const sessionName = `plasma_${cliente.toLowerCase().substring(0, 8)}`
      exec(`tmux send-keys -t ${sessionName} "encerrar_contrato" Enter`)
      setTimeout(() => { exec(`tmux kill-session -t ${sessionName}`); delete db.clientes[cliente]; salvarDB() }, 30000)
    }
  }
}

function tratarLoginAuth(bot, jsonMsg) {
  if (!JSON.stringify(jsonMsg).includes('clickEvent')) return
  const txt = JSON.stringify(jsonMsg).toLowerCase()
  if ((txt.includes('não') || txt.includes('nao')) && txt.includes('run_command')) {
    const match = txt.match(/"value":"(\/[^"]+)"/)
    if (match) bot.chat(match[1])
  }
}

function verificarPendencias() { console.log(db.reembolsos) }
function formatarDinheiro(v) { return v.toLocaleString('pt-BR') }

iniciarGerente()
