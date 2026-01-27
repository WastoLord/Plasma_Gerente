const mineflayer = require('mineflayer')
const fs = require('fs')
const readline = require('readline') 
const { exec } = require('child_process')

// --- VALIDAÇÃO DE SEGURANÇA ---
const SENHA_BOT = process.env.BOT_PASSWORD;
if (!SENHA_BOT) {
    console.error("\n❌ ERRO CRÍTICO DE SEGURANÇA ❌");
    console.error("A senha não foi definida na variável de ambiente 'BOT_PASSWORD'.");
    console.error("Use: export BOT_PASSWORD='SuaSenhaAqui' && node plasma_gerente.js\n");
    process.exit(1);
}

// --- CONFIGURAÇÃO ---
const CONFIG = {
    host: 'jogar.craftsapiens.com.br',
    port: 25565,
    username: 'Plasma_GDebug',
    password: SENHA_BOT, 
    auth: 'offline',
    version: '1.21.4',
    admins: ['WastoLord_13'], 
    precoSemana: 5000000, 
    idItemMao: 'diamond',      
    idItemAlvo: 'golden_axe'   
}

// ================= FILA GLOBAL DE CHAT =================
let filaChat = []
let processandoFila = false

function enviarSequencia(mensagens, delay = 3500) {
    mensagens.forEach(msg => filaChat.push({ msg, delay }))
    processarFila()
}

function processarFila() {
    if (processandoFila || filaChat.length === 0) return
    processandoFila = true
    const { msg, delay } = filaChat.shift()
    if (bot && bot.entity) bot.chat(msg)
    setTimeout(() => {
        processandoFila = false
        processarFila()
    }, delay)
}

// ================= BANCO =================
const DB_FILE = 'plasma_db.json'
let db = { clientes: {}, negociacoes: {}, reembolsos: [], interacoes: {} }

if (fs.existsSync(DB_FILE)) {
    try { db = { ...db, ...JSON.parse(fs.readFileSync(DB_FILE)) } }
    catch { console.log("DB novo criado.") }
}

function salvarDB() {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2))
}

// ================= BOT =================
let bot = null
let loopLobby = null 
let loopExpiracao = null

function iniciarGerente() {
    console.log(`🔌 Conectando em ${CONFIG.host}...`)
    if (loopLobby) clearInterval(loopLobby)
    if (loopExpiracao) clearInterval(loopExpiracao)

    bot = mineflayer.createBot(CONFIG)

    bot.on('spawn', () => {
        console.log('✅ Gerente Plasma online!')
        setTimeout(() => bot.chat('/login ' + CONFIG.password), 2000)
        loopExpiracao = setInterval(verificarExpiracoes, 10 * 60 * 1000)
        iniciarLoopLobby()
        setTimeout(restaurarSessoesAntigas, 10000)
    })

    bot.on('end', () => {
        console.log(`❌ Conexão perdida. Reconectando em 15s...`)
        setTimeout(iniciarGerente, 15000)
    })

    bot.on('windowOpen', (window) => {
        if (window.type === 'minecraft:inventory') return
        const alvo = window.slots.find(item => item && item.name.includes(CONFIG.idItemAlvo))
        if (alvo) {
            bot.clickWindow(alvo.slot, 0, 0)
            setTimeout(() => bot.currentWindow && bot.closeWindow(bot.currentWindow), 1000)
        }
    })

    bot.on('message', (jsonMsg) => {
        const msg = jsonMsg.toString()

        // PAGAMENTOS
        processarPagamento(msg)

        // SOMENTE TELL
        const REGEX_TELL = /\[Privado\] Mensagem de (?:\[.*?\] )?(\w+): (.+)/i
        const matchTell = msg.match(REGEX_TELL)
        if (matchTell) {
            const sender = matchTell[1]
            const content = matchTell[2]
            tratarComandosCliente(sender, content)
        }
    })
}

function iniciarLoopLobby() {
    if (loopLobby) clearInterval(loopLobby)
    loopLobby = setInterval(() => {
        if (!bot || !bot.inventory) return
        const itemMenu = bot.inventory.items().find(i => i.name.includes(CONFIG.idItemMao))
        if (itemMenu && !bot.currentWindow) {
            bot.equip(itemMenu, 'hand').then(() => bot.activateItem()).catch(() => {})
        }
    }, 20000)
}

// ================= INTERAÇÃO =================
function tratarComandosCliente(username, messageRaw) {
    const message = messageRaw.replace(/\./g, '').trim().toLowerCase()

    // PRIMEIRO CONTATO
    if (!db.interacoes[username]) {
        db.interacoes[username] = Date.now()
        salvarDB()
        enviarSequencia([
            `/tell ${username} Olá! Sou o Gerente da loja Plasma 🤖`,
            `/tell ${username} Posso te ajudar a contratar um bot.`,
            `/tell ${username} Para começar, digite: negociar`
        ])
        return
    }

    if (message === 'negociar' || message.includes('comprar bot')) {
        let msgs = []
        if (db.clientes[username]) {
            const restante = db.clientes[username].dataFim - Date.now()
            const dias = (restante / 86400000).toFixed(1)
            msgs.push(`/tell ${username} Você já tem um bot ativo.`)
            msgs.push(`/tell ${username} Restam ${dias} dias.`)
            msgs.push(`/tell ${username} Para renovar, digite: confirmar`)
        } else {
            msgs.push(`/tell ${username} O aluguel custa $${formatarDinheiro(CONFIG.precoSemana)} por semana.`)
            msgs.push(`/tell ${username} Para confirmar, digite: confirmar`)
        }
        enviarSequencia(msgs)
        db.negociacoes[username] = { estado: 'aguardando_confirmacao', timestamp: Date.now() }
        salvarDB()
    }

    else if (message === 'confirmar') {
        const n = db.negociacoes[username]
        if (n && n.estado === 'aguardando_confirmacao') {
            enviarSequencia([
                `/tell ${username} Perfeito 👍`,
                `/tell ${username} Envie o PIX usando:`,
                `/tell ${username} /pix ${bot.username} ${CONFIG.precoSemana}`
            ])
            n.estado = 'aguardando_pagamento'
            salvarDB()

            setTimeout(() => {
                const x = db.negociacoes[username]
                if (x && x.estado === 'aguardando_pagamento') {
                    enviarSequencia([
                        `/tell ${username} ⏳ Seu pedido ainda aguarda pagamento.`,
                        `/tell ${username} Se desejar continuar, envie o PIX.`
                    ])
                }
            }, 5 * 60 * 1000)
        }
    }

    else if (
        message.includes('preço') ||
        message.includes('valor') ||
        message.includes('quanto') ||
        message.includes('custa')
    ) {
        enviarSequencia([
            `/tell ${username} O aluguel custa $${formatarDinheiro(CONFIG.precoSemana)} por semana.`,
            `/tell ${username} Se quiser continuar, digite: negociar`
        ])
    }
}

// ================= PAGAMENTO =================
const REGEX_PAGAMENTO = /\[PIX\] Você recebeu ([\d.,]+) de (\w+)/i

function processarPagamento(msg) {
    const match = msg.match(REGEX_PAGAMENTO)
    if (!match) return

    const valor = parseFloat(match[1].replace(/\./g, '').replace(',', '.'))
    const pagador = match[2]

    const n = db.negociacoes[pagador]
    if (n && n.estado === 'aguardando_pagamento' && Math.abs(valor - CONFIG.precoSemana) < 100) {
        aceitarContrato(pagador)
    } else {
        reembolsarSeguro(pagador, valor, "Valor incorreto ou sem negociação.")
    }
}

function reembolsarSeguro(cliente, valor, motivo) {
    enviarSequencia([
        `/pix ${cliente} ${valor}`,
        `/tell ${cliente} ⚠️ O valor recebido não confere.`,
        `/tell ${cliente} Para sua segurança, o valor foi devolvido automaticamente.`,
        `/tell ${cliente} Se desejar, digite: negociar`
    ])
}

// ================= CONTRATO =================
function aceitarContrato(cliente) {
    adicionarOuRenovar(cliente, 7 * 86400000, true)
    delete db.negociacoes[cliente]
    salvarDB()
}

function adicionarOuRenovar(cliente, duracaoMs, pago = false) {
    const base = (db.clientes[cliente] && db.clientes[cliente].dataFim > Date.now())
        ? db.clientes[cliente].dataFim : Date.now()

    db.clientes[cliente] = {
        dataInicio: Date.now(),
        dataFim: base + duracaoMs
    }
    salvarDB()

    if (pago) {
        enviarSequencia([
            `/tell ${cliente} ✅ Pagamento confirmado!`,
            `/tell ${cliente} Seu bot está sendo iniciado agora...`
        ])
    }
}

function verificarExpiracoes() {
    const agora = Date.now()
    for (const [cliente, dados] of Object.entries(db.clientes)) {
        if (dados.dataFim - agora < 12 * 60 * 60 * 1000 && !dados.alertado) {
            enviarSequencia([
                `/tell ${cliente} ⏰ Seu bot expira em menos de 12 horas.`,
                `/tell ${cliente} Para renovar, digite: negociar`
            ])
            dados.alertado = true
            salvarDB()
        }
    }
}

function restaurarSessoesAntigas() {}
function formatarDinheiro(v) { return v.toLocaleString('pt-BR') }

iniciarGerente()
