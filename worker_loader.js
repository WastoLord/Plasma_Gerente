'use strict'
// USO: node worker_loader.js <Dono> <NickBot> <LojaID>
const mineflayer = require('mineflayer')
const readline = require('readline')
const fs = require('fs')
const { pathfinder } = require('mineflayer-pathfinder')
const pvp = require('mineflayer-pvp').plugin
const path = require('path')

// --- LEITURA DE ARGUMENTOS ---
const args = process.argv.slice(2)
const DONO = args[0] || 'WastoLord_13'
const BOT_NICK = args[1] || 'Plasma_Teste'
const LOJA_ID = args[2] || 'loja'

console.log(`🤖 Iniciando Worker Simples. Dono: ${DONO} | Nick: ${BOT_NICK}`)

// --- CONFIGURAÇÃO CONNECT ---
const connConfig = {
  host: 'jogar.craftsapiens.com.br',
  port: 25565,
  username: BOT_NICK,
  auth: 'offline',
  version: '1.21.4'
}

const LOGIC_FILE = path.resolve(__dirname, './worker_logic.js')

let bot = null
let currentLogic = null

// =========================================================================
// SILENCIADOR
// =========================================================================
const BLOQUEAR_LOGS = [
  'PartialReadError', 'Read error for undefined', 'protodef', 'packet_world_particles',
  'eval at compile', 'ExtensionError', 'Method Not Allowed', 'DeprecationWarning',
  'punycode', 'physicTick', 'src/compiler.js', 'src/utils.js',
  'Chunk size is', 'partial packet', 'entity_teleport', 'buffer :',
  'was read', 'ECONNRESET', 'ETIMEDOUT'
]

function deveBloquear(str) {
  if (!str) return false
  return BLOQUEAR_LOGS.some(termo => str.toString().includes(termo))
}

const originalStderrWrite = process.stderr.write
process.stderr.write = function(chunk) { if (deveBloquear(chunk)) return false; return originalStderrWrite.apply(process.stderr, arguments) }
const originalConsoleError = console.error
console.error = function(...args) { if (args.some(arg => deveBloquear(arg))) return; originalConsoleError.apply(console, args) }
process.on('uncaughtException', (err) => { if (err && err.code === 'ECONNRESET') return console.log('Conexão resetada.'); console.error(err) })
process.on('unhandledRejection', (r) => { console.error('UnhandledRejection', r) })
// =========================================================================

// --- INPUT MANUAL ---
const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
rl.on('line', (input) => {
  if (input.trim() === 'encerrar_contrato') {
    if (currentLogic && currentLogic.encerrar) {
      try { currentLogic.encerrar(bot) } catch (e) {}
    } else {
      if (bot) try { bot.quit() } catch (e) {}
      process.exit()
    }
  } else if (bot?.entity) {
    try { bot.chat(input) } catch (e) {}
  }
})

// --- INICIALIZAÇÃO ---
function iniciarBot() {
  console.log(`🔌 Conectando ${BOT_NICK}...`)

  bot = mineflayer.createBot(connConfig)

  bot.loadPlugin(pathfinder)
  bot.loadPlugin(pvp)

  bot.on('login', () => {
    console.log('🔑 Login de rede aceito. Entrando...')
  })

  bot.once('spawn', () => {
    console.log(`✅ ${BOT_NICK} online e spawnado!`)
    carregarLogica()
  })

  bot.on('end', (reason) => {
    console.log(`❌ Conexão perdida: ${reason}. Reconectando em 15s...`)
    try { if (currentLogic && currentLogic.encerrar) currentLogic.encerrar(bot) } catch (e) {}
    setTimeout(iniciarBot, 15000)
  })

  bot.on('error', (err) => {
    if (err && err.code === 'ECONNRESET') return
    if (!deveBloquear(err?.message || '')) {
      console.log(`🚨 Erro: ${err?.message || err}`)
    }
  })
}

function carregarLogica() {
  try {
    if (currentLogic && typeof currentLogic.encerrar === 'function') {
      console.log('♻️ Encerrando lógica antiga antes de recarregar...')
      try { currentLogic.encerrar(bot) } catch (e) { console.error('Erro ao encerrar lógica antiga', e) }
    }
  } catch (e) {}

  delete require.cache[require.resolve(LOGIC_FILE)]
  try {
    const novaLogica = require(LOGIC_FILE)
    if (novaLogica.start) {
      novaLogica.start(bot, { dono: DONO, loja: LOJA_ID })
      currentLogic = novaLogica
      console.log('✨ Lógica (re)carregada com sucesso.')
    } else {
      console.warn('Arquivo de lógica não exporta start().')
    }
  } catch (e) { console.log("Erro ao carregar lógica:", e) }
}

// Watcher para atualizar lógica sem reiniciar
let debounce = false
try {
  fs.watch(LOGIC_FILE, (e, f) => {
    if (!f) return
    if (debounce) return
    debounce = true
    setTimeout(() => debounce = false, 500)
    if (bot?.entity) carregarLogica()
  })
} catch (e) {
  console.warn('Watcher de arquivo não pôde ser iniciado:', e)
}

// lidar com sinais para terminar limpo
process.on('SIGINT', () => {
  console.log('SIGINT recebido — encerrando...')
  try { if (currentLogic && currentLogic.encerrar) currentLogic.encerrar(bot) } catch (e) {}
  setTimeout(() => process.exit(0), 2000)
})

iniciarBot()
