'use strict'

const { Movements, goals: { GoalFollow } } = require('mineflayer-pathfinder')
const pvp = require('mineflayer-pvp').plugin

// --- CONFIGURAÇÕES PADRÃO (pode ser sobrescrito em start) ---
const PASSWORD = process.env.PLASMA_PASSWORD || '***REMOVED***'
const CONFIG_ENTRADA = {
  idItemMao: 'diamond',
  idItemAlvo: 'golden_axe'
}
const CONFIG_COMBATE = {
  attackSpeed: 600,
  alcanceAtaque: 3.5,
  raioBuscaPvP: 20,
  whitelist: [] // será preenchida em start com dono/adm
}

// --- ESTADO ---
let loopLobby = null
let loopElevadorExterno = null
let estadoAutoClick = { ativo: false, timer: null }
let estadoElevador = { ativo: false, tipo: null, tempoFim: 0 }
let modoGuarda = false
let ultimoAtaque = 0
let jaFoiParaLoja = false
let ouvintes = [] // { event, fn, once }
let DONO = ''

// --- Login throttle ---
let lastLoginAttempt = 0
let loginAttempts = 0
const LOGIN_COOLDOWN_MS = 15000
const LOGIN_MAX_ATTEMPTS = 4

function feedback(bot, msg) {
  console.log(`[${DONO || '??'}] ${msg}`)
  if (DONO && bot && bot.chat) {
    try { bot.chat(`/tell ${DONO} ${msg}`) } catch (e) {}
  }
}

function addListener(bot, event, fn, once = false) {
  ouvintes.push({ event, fn, once })
  if (once) bot.once(event, fn); else bot.on(event, fn)
}

function removeAllListeners(bot) {
  for (const l of ouvintes) {
    try {
      bot.removeListener(l.event, l.fn)
    } catch (e) {}
  }
  ouvintes = []
}

// --- API pública ---
module.exports = {
  start: (bot, args = {}) => {
    DONO = args.dono || DONO || ''
    console.log(`▶️ Worker Ativo. Dono: ${DONO} | Loja: ${args.loja || 'loja'}`)

    // Preenche whitelist do combate com dono + bot de debug
    CONFIG_COMBATE.whitelist = [DONO, 'WastoLord_13']

    if (!bot.pvp) bot.loadPlugin(pvp)

    const cmd = {
      seguir: 'vem',
      parar: 'parar',
      subir: 'subir',
      descer: 'desce',
      guarda: 'guarda',
      ataque: 'ataque',
      pararAtaque: 'paz',
      pix: 'pix',
      itens: 'itens',
      loja: 'loja',
      usar: 'usar',
      help: 'help'
    }

    // --- MOVIMENTO ---
    bot.physicsEnabled = true
    const mcData = require('minecraft-data')(bot.version)
    const moves = new Movements(bot, mcData)
    moves.canDig = false
    moves.canPlaceOn = false
    moves.allow1by1towers = false
    moves.allowParkour = true
    bot.pathfinder.setMovements(moves)

    // --- LOOP FÍSICO ---
    const physicsListener = () => {
      if (estadoElevador.ativo) { processarElevador(bot); return }
      loopGuarda(bot)
      gerenciarVida(bot)
    }
    addListener(bot, 'physicsTick', physicsListener)

    iniciarLoopLobby(bot, args)

    // --- PROCESSADOR DE COMANDOS ---
    const processarComando = (username, messageRaw) => {
      if (!username) return
      if (username !== DONO && username !== 'WastoLord_13') return

      const message = messageRaw.replace(/\./g, '').trim().toLowerCase()
      feedback(bot, `CMD Recebido: ${message}`)

      if (message === cmd.help || message === 'ajuda') {
        feedback(bot, '📜 COMANDOS: vem, parar, subir, descer, guarda, ataque, paz, usar <tempo>, itens, pix, loja')
      }

      if (message === cmd.seguir) {
        const target = bot.players[username]?.entity || bot.nearestEntity(e => e.type === 'player' && e.username === username)
        if (!target) { bot.chat(`/tell ${username} Não te vejo!`); return }
        bot.chat('Indo!')
        pararTudo(bot)
        bot.physicsEnabled = true
        bot.pathfinder.setMovements(moves)
        bot.pathfinder.setGoal(new GoalFollow(target, 1), true)
      }

      if (message === cmd.parar) {
        bot.chat('Parei.')
        pararTudo(bot)
      }

      if (message === cmd.subir) ativarElevador(bot, 'subir')
      if (message === cmd.descer) ativarElevador(bot, 'descer')

      if (message === cmd.guarda) {
        bot.chat('🛡️ Modo Guarda!')
        pararTudo(bot)
        bot.physicsEnabled = true
        modoGuarda = true
      }

      if (message === cmd.ataque) {
        let inimigo = bot.nearestEntity(e => e.type === 'player' && e.username !== DONO && e.position && bot.entity && e.position.distanceTo(bot.entity.position) <= CONFIG_COMBATE.raioBuscaPvP)
        if (!inimigo) inimigo = bot.nearestEntity(e => e.type === 'mob' && e.mobType !== 'Armor Stand' && e.position && bot.entity && e.position.distanceTo(bot.entity.position) <= CONFIG_COMBATE.raioBuscaPvP)

        if (inimigo) {
          bot.chat(`⚔️ Atacando!`)
          pararTudo(bot)
          bot.physicsEnabled = true
          if (bot.pvp && bot.pvp.attack) bot.pvp.attack(inimigo)
          else {
            try { bot.attack(inimigo) } catch (e) {}
          }
        } else {
          bot.chat(`Ninguém por perto.`)
        }
      }

      if (message === cmd.pararAtaque) {
        bot.chat('🏳️ Paz.')
        pararCombate(bot)
      }

      if (message === cmd.pix) {
        bot.chat(`/pix ${username} 7500`)
      }

      if (message === cmd.itens) {
        const playerEntity = bot.players[username]?.entity
        droparItensSeguro(bot, playerEntity)
      }

      if (message.startsWith(cmd.loja)) {
        const argumento = messageRaw.substring(cmd.loja.length).trim()
        if (argumento.length > 0) bot.chat(`/loja ${argumento}`)
        else bot.chat(`/loja`)
      }

      if (message.startsWith(cmd.usar)) {
        pararTudo(bot)
        const argumentos = message.split(' ')
        let tempo = parseFloat(argumentos[1]?.replace(',', '.') || '0')
        if (tempo > 0 && tempo < 0.2) tempo = 0.2

        if (!isNaN(tempo) && tempo > 0) {
          bot.chat(`🖱️ Auto-Click: ${tempo}s`)
          iniciarAutoClick(bot, tempo)
        } else {
          bot.chat(`❌ Tempo inválido.`)
        }
      }
    }

    // --- EVENTOS DE LEITURA ---
    addListener(bot, 'chat', (username, message) => {
      if (username === bot.username) return
      processarComando(username, message)
    })

    addListener(bot, 'message', (jsonMsg) => {
      const msg = jsonMsg.toString()
      const msgLower = msg.toLowerCase()

      if (msg.trim().length > 0 && !msg.includes('[Combate]')) {
        console.log(`[Server] ${msg}`)
      }

      const REGEX_CHAT = /[:\s]([a-zA-Z0-9_]+): (.+)/
      const matchChat = msg.match(REGEX_CHAT)
      if (matchChat) {
        const nick = matchChat[1]
        const text = matchChat[2]
        if (nick === DONO || nick === 'WastoLord_13') processarComando(nick, text)
      }

      const REGEX_TELL = /\[Privado\] Mensagem de (?:\[.*?\] )?([a-zA-Z0-9_]+): (.+)/i
      const matchTell = msg.match(REGEX_TELL)
      if (matchTell) {
        const nick = matchTell[1]
        const text = matchTell[2]
        feedback(bot, `TELL de ${nick}: ${text}`)
        processarComando(nick, text)
      }

      // auto login triggers (plain text) - com throttle para evitar spam
      if ((msg.includes('Utilize o comando /logar') || msg.includes('/login <senha>') || msgLower.includes('/logar')) && Date.now() - lastLoginAttempt > LOGIN_COOLDOWN_MS && loginAttempts < LOGIN_MAX_ATTEMPTS) {
        lastLoginAttempt = Date.now()
        loginAttempts++
        feedback(bot, `🔑 Tentativa de login #${loginAttempts}`)
        try { bot.chat(`/login ${PASSWORD}`) } catch (e) {}
      }

      if (msgLower.includes('/registrar') || msgLower.includes('/register') || msgLower.includes('registre-se') || msgLower.includes('não foi registrado')) {
        feedback(bot, "📝 Registrando...")
        setTimeout(() => { try { bot.chat(`/registrar ${PASSWORD} ${PASSWORD}`) } catch (e) {} }, 1500)
      }

      // Always try to handle clickEvent JSONs
      if (jsonMsg) {
        const handled = tratarLoginAuth(bot, jsonMsg)
        if (handled && loginAttempts > 0) {
          loginAttempts = 0
          lastLoginAttempt = 0
        }
      }

      if (msg.includes('Você não tem mais um apelido') && !jaFoiParaLoja) {
        jaFoiParaLoja = true
        feedback(bot, "Entrada confirmada! Indo para loja...")
        if (loopLobby) { clearInterval(loopLobby); loopLobby = null }

        setTimeout(() => {
          const lojaDestino = (args.loja && args.loja !== 'loja') ? args.loja : 'Plasma'
          try { bot.chat(`/loja ${lojaDestino}`) } catch (e) {}
        }, 5000)
      }
    })

    addListener(bot, 'windowOpen', (window) => {
      if (window.type === 'minecraft:inventory') return
      const alvo = window.slots.find(item => item && item.name && item.name.includes(CONFIG_ENTRADA.idItemAlvo))
      if (alvo) {
        feedback(bot, "Clicando no servidor Survival...")
        try { bot.clickWindow(alvo.slot, 0, 0) } catch (e) {}
        setTimeout(() => {
          if (bot.currentWindow) try { bot.closeWindow(bot.currentWindow) } catch (e) {}
          if (loopLobby) { clearInterval(loopLobby); loopLobby = null }
        }, 1000)
      }
    })

    addListener(bot, 'death', () => {
      feedback(bot, "Morri! Renascendo...")
      pararTudo(bot)
      setTimeout(() => {
        try { bot.respawn() } catch (e) {}
      }, 5000)
    })

    // Marca referência para eventual limpeza externa
    bot._plasmaWorkerStarted = true
  },

  encerrar: (bot) => {
    feedback(bot, "CONTRATO ENCERRADO.")
    // limpa timers e listeners
    pararTudo(bot)
    if (loopLobby) { clearInterval(loopLobby); loopLobby = null }
    if (loopElevadorExterno) { clearInterval(loopElevadorExterno); loopElevadorExterno = null }
    removeAllListeners(bot)

    // tenta depositar / despachar itens com segurança
    try { bot.chat('/home') } catch (e) {}
    setTimeout(async () => {
      try {
        const items = bot.inventory.items()
        for (const item of items) {
          try { await bot.tossStack(item); await bot.waitForTicks(2) } catch (e) {}
        }
      } catch (e) {}
      try { bot.chat("Adeus!") } catch (e) {}
      setTimeout(() => {
        try { process.exit(0) } catch (e) {}
      }, 3000)
    }, 5000)
  }
}

// --- FUNÇÕES AUXILIARES ---

function iniciarLoopLobby(bot, args = {}) {
  if (loopLobby) { clearInterval(loopLobby); loopLobby = null }
  console.log("🔄 Iniciando Loop de Entrada (Lobby -> Survival)")

  loopLobby = setInterval(() => {
    if (jaFoiParaLoja || !bot || !bot.inventory) {
      if (jaFoiParaLoja && loopLobby) { clearInterval(loopLobby); loopLobby = null }
      return
    }

    const itemMenu = bot.inventory.items().find(i => i && i.name && i.name.includes(CONFIG_ENTRADA.idItemMao))
    if (itemMenu) {
      bot.equip(itemMenu, 'hand').then(() => {
        try { bot.activateItem() } catch (e) {}
        try { bot.setControlState('right', true) } catch (e) {}
        setTimeout(() => {
          try { bot.setControlState('right', false) } catch (e) {}
        }, 200)
      }).catch(() => {})
    }
  }, 5000)
}

/**
 * tratarLoginAuth:
 * - Varre o JSON procurando componentes com clickEvent;
 * - Se encontrar um componente cujo texto seja exatamente "[Não]" (exatamente com colchetes e acento),
 *   executa seu clickEvent.value (este é o comportamento solicitado).
 * - NÃO faz fallback para '/nao' — a detecção é estrita para "[Não]" por pedido.
 */
function tratarLoginAuth(bot, jsonMsg) {
  if (!jsonMsg) return false
  const seen = new WeakSet()
  let foundCmd = null
  let matchedTextComponent = null

  function varrer(obj) {
    if (!obj || (typeof obj !== 'object' && typeof obj !== 'string')) return false
    if (typeof obj === 'string') return false
    if (seen.has(obj)) return false
    seen.add(obj)

    // Checagem direta: texto exatamente "[Não]"
    if (typeof obj.text === 'string') {
      if (obj.text === '[Não]') {
        if (obj.clickEvent && obj.clickEvent.action && typeof obj.clickEvent.value === 'string') {
          foundCmd = obj.clickEvent.value
          matchedTextComponent = obj.text
          return true
        }
      }
    }

    // verificar arrays 'extra' / 'with' / outros filhos
    if (Array.isArray(obj.extra)) {
      for (const child of obj.extra) if (varrer(child)) return true
    }
    if (Array.isArray(obj.with)) {
      for (const child of obj.with) if (varrer(child)) return true
    }

    // verificação genérica em propriedades
    for (const k of Object.keys(obj)) {
      try { if (varrer(obj[k])) return true } catch (e) {}
    }
    return false
  }

  try {
    if (!varrer(jsonMsg)) {
      // fallback simples: procurar literal "[Não]" no JSON string e extrair um run_command value se houver
      const txt = JSON.stringify(jsonMsg)
      if (txt.includes('[Não]')) {
        const match = txt.match(/"value"\s*:\s*"(\/[^"]+)"/i) || txt.match(/run_command[^"]*"(\/[^"]+)"/i)
        if (match) foundCmd = match[1]
      }
    }
  } catch (e) {
    // ignore
  }

  if (foundCmd) {
    feedback(bot, `🖱️ Clicando no componente exato "[Não]": ${foundCmd}`)
    setTimeout(() => {
      try { bot.chat(foundCmd) } catch (e) {}
    }, 1000)
    return true
  }

  return false
}

function pararTudo(bot) {
  try { if (bot.pathfinder) bot.pathfinder.setGoal(null) } catch (e) {}
  try { if (bot.pvp && bot.pvp.stop) bot.pvp.stop() } catch (e) {}
  estadoElevador.ativo = false
  modoGuarda = false
  estadoAutoClick.ativo = false
  if (estadoAutoClick.timer) { clearTimeout(estadoAutoClick.timer); estadoAutoClick.timer = null }
  if (loopElevadorExterno) { clearInterval(loopElevadorExterno); loopElevadorExterno = null }
  try { bot.clearControlStates() } catch (e) {}
  try { if (bot.setControlState) bot.setControlState('right', false) } catch (e) {}
}

function ativarElevador(bot, direcao) {
  pararTudo(bot)
  estadoElevador.ativo = true
  estadoElevador.tipo = direcao
  estadoElevador.tempoFim = Date.now() + (direcao === 'subir' ? 1500 : 4000)
  bot.chat(direcao === 'subir' ? '⬆️' : '⬇️')
  if (loopElevadorExterno) clearInterval(loopElevadorExterno)
  loopElevadorExterno = setInterval(() => processarElevador(bot), 50)
}

function processarElevador(bot) {
  if (Date.now() > estadoElevador.tempoFim) {
    estadoElevador.ativo = false
    if (loopElevadorExterno) { clearInterval(loopElevadorExterno); loopElevadorExterno = null }
    try { bot.clearControlStates() } catch (e) {}
    return
  }
  try { if (bot.pathfinder) bot.pathfinder.setGoal(null) } catch (e) {}
  if (estadoElevador.tipo === 'subir') {
    try { bot.setControlState('sneak', false); bot.setControlState('jump', true) } catch (e) {}
  } else {
    try { bot.setControlState('jump', false); bot.setControlState('sneak', true) } catch (e) {}
  }
}

function loopGuarda(bot) {
  if (!modoGuarda || !bot.entity) return
  const agora = Date.now()
  if (agora - ultimoAtaque < CONFIG_COMBATE.attackSpeed) return

  const alvo = bot.nearestEntity(entity => {
    if (!entity || !entity.position || !bot.entity) return false
    if (entity.type === 'player' && CONFIG_COMBATE.whitelist.includes(entity.username)) return false
    if (entity.type === 'mob' && (entity.name === 'armor_stand' || entity.mobType === 'Armor Stand')) return false
    const dist = entity.position.distanceTo(bot.entity.position)
    return dist <= CONFIG_COMBATE.alcanceAtaque
  })

  if (alvo) {
    const dist = alvo.position.distanceTo(bot.entity.position)
    if (dist > CONFIG_COMBATE.alcanceAtaque) return
    equiparEspada(bot)
    try { bot.lookAt(alvo.position.offset(0, (alvo.height || 1) * 0.6, 0), true) } catch (e) {}
    try {
      if (bot.pvp && bot.pvp.attack) bot.pvp.attack(alvo)
      else bot.attack(alvo)
      bot.swingArm()
      ultimoAtaque = Date.now()
    } catch (e) {}
  }
}

function gerenciarVida(bot) {
  if (!bot.entity) return
  try {
    if (bot.health < 10) {
      // placeholder
    }
    if (bot.food !== undefined && bot.food < 16 && !bot.usingHeldItem) {
      const comida = bot.inventory.items().find(i => i.name && i.name.includes('cooked_beef'))
      if (comida) bot.equip(comida, 'hand').then(() => bot.consume()).catch(()=>{})
    }
  } catch (e) {}
}

function equiparEspada(bot) {
  try {
    const mao = bot.heldItem
    if (!mao || !mao.name || !mao.name.includes('sword')) {
      const espada = bot.inventory.items().find(item => item.name && item.name.includes('sword'))
      if (espada) bot.equip(espada, 'hand').catch(() => {})
    }
  } catch (e) {}
}

async function droparItensSeguro(bot, playerEntity) {
  if (!playerEntity) return
  bot.chat("📦")
  try { await bot.lookAt(playerEntity.position.offset(0, 1.6, 0), true) } catch (e) {}
  const inventario = bot.inventory.items()
  for (const item of inventario) {
    if (!item || !item.name) continue
    if (item.name.includes('diamond') || item.name.includes('sword') || item.name.includes('helmet') || item.name.includes('chestplate') || item.name.includes('leggings') || item.name.includes('boots')) continue
    try { await bot.tossStack(item); await bot.waitForTicks(2) } catch (e) {}
  }
}

function iniciarAutoClick(bot, tempo) {
  estadoAutoClick.ativo = true
  if (estadoAutoClick.timer) clearTimeout(estadoAutoClick.timer)

  const clicar = async () => {
    if (!estadoAutoClick.ativo) return
    try {
      const bloco = bot.blockAtCursor(4)
      if (bloco) {
        bot.activateBlock(bloco).catch(()=>{})
      }
      try { bot.setControlState('right', true) } catch (e) {}
      setTimeout(() => { try { bot.setControlState('right', false) } catch (e) {} }, 50)
      try { bot.swingArm() } catch (e) {}
    } catch (e) {}
    if (estadoAutoClick.ativo) estadoAutoClick.timer = setTimeout(clicar, Math.max(50, tempo * 1000))
  }
  clicar()
}
