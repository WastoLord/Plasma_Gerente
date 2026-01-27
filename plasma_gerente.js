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
    username: 'Plasma_Gerente',
    password: SENHA_BOT, 
    auth: 'offline',
    version: '1.21.4',
    admins: ['WastoLord_13'], 
    precoSemana: 5000000, 
    idItemMao: 'diamond',      
    idItemAlvo: 'golden_axe'   
}

// =========================================================================
// 🛡️ SILENCIADOR SUPREMO V4.1
// =========================================================================
const BLOQUEAR_LOGS = [
    'PartialReadError', 'Read error for undefined', 'protodef', 'packet_world_particles', 
    'eval at compile', 'ExtensionError', 'Method Not Allowed', 'DeprecationWarning',
    'punycode', 'physicTick', 'src/compiler.js', 'src/utils.js',
    'Chunk size', 'partial packet', 'entity_teleport', 'buffer :', 'was read',
    'ECONNRESET', 'ETIMEDOUT', 'client timed out', 'KeepAlive',
    'Received packet', 'Unknown packet'
]

function deveBloquear(str) {
    if (!str) return false
    return BLOQUEAR_LOGS.some(termo => str.toString().includes(termo))
}

const originalStderrWrite = process.stderr.write
process.stderr.write = function(chunk) { if (deveBloquear(chunk)) return false; return originalStderrWrite.apply(process.stderr, arguments) }
const originalConsoleError = console.error
console.error = function(...args) { if (args.some(arg => deveBloquear(arg))) return; originalConsoleError.apply(console, args) }
const originalStdoutWrite = process.stdout.write
process.stdout.write = function(chunk) { if (deveBloquear(chunk)) return false; return originalStdoutWrite.apply(process.stdout, arguments) }
const originalLog = console.log
console.log = function(...args) { if (args.some(arg => deveBloquear(arg))) return; originalLog.apply(console, args) }

process.on('uncaughtException', (err) => { 
    if (err.code === 'ECONNRESET' || err.message.includes('client timed out')) return 
})
process.on('unhandledRejection', () => {})

// --- CHAT MANUAL ---
const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
rl.on('line', (input) => { 
    const raw = input.trim()
    const cmd = raw.toLowerCase()
    
    if (cmd === 'pendentes' || cmd === 'verificar' || cmd === 'bots') {
        if (cmd === 'pendentes') verificarPendencias()
        else {
            recarregarDB()
            restaurarSessoesAntigas()
        }
        return
    }

    // COMANDO DE TESTE: teste <nick> [dias]
    if (cmd.startsWith('teste ')) {
        const parts = raw.split(' ') // usa o original, com maiúsculas
        const nick = parts[1]
        const dias = parts[2]
        if (nick) adicionarTeste(nick, dias)
        recarregarDB()
        return
    }

    if (bot?.entity) {
        bot.chat(input)
        console.log(`[Gerente] > ${input}`)
    } else {
        console.log('⚠️ O bot ainda não entrou no servidor.')
    }
})

const DB_FILE = 'plasma_db.json'
let db = { clientes: {}, negociacoes: {}, reembolsos: [] }

let bot = null
let loopLobby = null 
let loopExpiracao = null

if (fs.existsSync(DB_FILE)) {
    try { 
        const loaded = JSON.parse(fs.readFileSync(DB_FILE)) 
        db = { ...db, ...loaded } 
    } catch(e) { console.log("DB Novo criado.") }
}

function salvarDB() {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2))
}

function recarregarDB() {
    if (fs.existsSync(DB_FILE)) {
        try {
            const loaded = JSON.parse(fs.readFileSync(DB_FILE))
            db = { ...db, ...loaded }
            console.log("🔄 DB recarregado da disk.")
        } catch (e) {
            console.log("⚠️ Erro ao recarregar DB:", e.message)
        }
    }
}

// ================ FILA GLOBAL DE MENSAGENS ================
let filaChat = []
let processandoFila = false

function enviarSequencia(mensagens, delay = 3500) { 
    mensagens.forEach((msg) => {
        filaChat.push({ msg, delay })
    })
    processarFila()
}

function processarFila() {
    if (processandoFila || filaChat.length === 0) return
    processandoFila = true
    const { msg, delay } = filaChat.shift()

    if (bot && bot.entity) {
        console.log(`[Debug Chat] Enviando: ${msg}`)
        bot.chat(msg)
    }

    setTimeout(() => {
        processandoFila = false
        processarFila()
    }, delay)
}

function iniciarGerente() {
    console.log(`🔌 (Re)Conectando Gerente em ${CONFIG.host}...`)
    
    if (loopLobby) clearInterval(loopLobby)
    if (loopExpiracao) clearInterval(loopExpiracao)

    bot = mineflayer.createBot(CONFIG)

    bot.on('login', () => {
        console.log('🔑 Autenticado! Entrando no mundo...')
    })

    bot.on('spawn', () => {
        console.log('✅ Gerente Plasma online e spawnado!')
        setTimeout(() => bot.chat('/login ' + CONFIG.password), 2000)
        
        loopExpiracao = setInterval(verificarExpiracoes, 10 * 60 * 1000)
        iniciarLoopLobby()
        setTimeout(restaurarSessoesAntigas, 10000)
    })

    bot.on('respawn', () => {
        console.log("🔄 Respawn detectado (possível volta ao lobby).")
        setTimeout(() => bot.chat('/login ' + CONFIG.password), 2000)
        iniciarLoopLobby()
    })

    bot.on('end', (reason) => {
        console.log(`❌ Conexão perdida. Reconectando em 15s...`)
        setTimeout(iniciarGerente, 15000)
    })

    bot.on('error', (err) => {
        if (!deveBloquear(err.message)) {
            console.log(`🚨 Erro Gerente: ${err.message}`)
        }
    })
    
    bot.on('windowOpen', (window) => {
        if (window.type === 'minecraft:inventory') return
        console.log(`📂 Janela aberta: "${window.title}"`)
        const alvo = window.slots.find(item => item && item.name.includes(CONFIG.idItemAlvo))
        if (alvo) {
            console.log(`🎯 Servidor encontrado. Entrando...`)
            bot.clickWindow(alvo.slot, 0, 0)
            setTimeout(() => {
                if (bot.currentWindow) bot.closeWindow(bot.currentWindow)
                console.log("🚀 Entrada no servidor concluída.")
            }, 1000)
        }
    })

    bot.on('message', (jsonMsg) => {
        const msg = jsonMsg.toString()
        if (msg.trim().length > 0) console.log(`[Servidor] ${msg}`)
        if (jsonMsg) tratarLoginAuth(bot, jsonMsg)
        
        if (msg.toLowerCase().includes('/registrar') || msg.toLowerCase().includes('/register') || msg.includes('não foi registrado')) {
            console.log('📝 Criando conta...')
            setTimeout(() => bot.chat(`/register ${CONFIG.password} ${CONFIG.password}`), 1500)
        }

        const REGEX_TELL = /\[Privado\] Mensagem de (?:\[.*?\] )?(\w+): (.+)/i
        const matchTell = msg.match(REGEX_TELL)
        if (matchTell) {
            const sender = matchTell[1]
            const content = matchTell[2]
            console.log(`📩 Tell de ${sender}: ${content}`)
            tratarComandosCliente(sender, content)
        }

        const isPlayerChat = /^(?:\[.*?\]\s*)?(\w+)\s*:/i.test(msg) || jsonMsg.toString().startsWith('<');
        if (!isPlayerChat) processarPagamento(msg)
    })

    // bot.on('chat'...) REMOVIDO - respostas apenas via /tell
}

function iniciarLoopLobby() {
    if (loopLobby) clearInterval(loopLobby)
    console.log("🧭 Radar de Lobby Ativado (Buscando Diamante)")
    loopLobby = setInterval(() => {
        if (!bot || !bot.inventory) return
        const itemMenu = bot.inventory.items().find(i => i.name.includes(CONFIG.idItemMao))
        if (itemMenu && !bot.currentWindow) {
            bot.equip(itemMenu, 'hand').then(() => bot.activateItem()).catch(() => {})
        }
    }, 20000) 
}

function tratarComandosCliente(username, messageRaw) {
    const message = messageRaw.replace(/\./g, '').trim().toLowerCase()
    // ⏳ CONSULTA DE TEMPO
    if (message === 'tempo' || message === 'status' || message === 'meu bot') {
        const dados = db.clientes[username]
    
        if (!dados) {
            enviarSequencia([
                `/tell ${username} ❌ Você não possui um bot ativo.`
            ])
        } else {
            const restante = dados.dataFim - Date.now()
            const horas = Math.floor(restante / (1000 * 60 * 60))
            const minutos = Math.floor((restante % (1000 * 60 * 60)) / (1000 * 60))
    
            enviarSequencia([
                `/tell ${username} ⏳ Tempo restante: ${horas}h ${minutos}min.`,
                `/tell ${username} Válido até ${new Date(dados.dataFim).toLocaleString('pt-BR')}.`
            ])
        }
        return
    }

    if (!db.interacoes) db.interacoes = {}
    
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
            const dias = (restante / (1000 * 60 * 60 * 24)).toFixed(1)
            msgs.push(`/tell ${username} Você já tem um bot ativo! Restam ${dias} dias.`)
            msgs.push(`/tell ${username} Para RENOVAR (+7 dias), digite "confirmar". Preço: $${formatarDinheiro(CONFIG.precoSemana)}.`)
        } else {
            msgs.push(`/tell ${username} Olá! O aluguel custa $${formatarDinheiro(CONFIG.precoSemana)} por semana.`)
            msgs.push(`/tell ${username} Para confirmar a compra, digite: confirmar`)
        }
        enviarSequencia(msgs)
        db.negociacoes[username] = { estado: 'aguardando_confirmacao', timestamp: Date.now() }
        salvarDB()
    }

    else if (message === 'confirmar') {
        const negociacao = db.negociacoes[username]
        if (negociacao && negociacao.estado === 'aguardando_confirmacao') {
    
            negociacao.estado = 'aguardando_pagamento'
            salvarDB()
    
            enviarSequencia([
                `/tell ${username} Aguardando PIX de $${formatarDinheiro(CONFIG.precoSemana)}.`,
                `/tell ${username} Use: /pix ${bot.username} ${CONFIG.precoSemana}`
            ])
    
            // ⏰ lembrete automático após 5 minutos
            setTimeout(() => {
                const n = db.negociacoes[username]
                if (n && n.estado === 'aguardando_pagamento') {
                    enviarSequencia([
                        `/tell ${username} ⏳ Seu pagamento ainda não foi recebido.`,
                        `/tell ${username} Para continuar, envie o PIX ou digite negociar.`
                    ])
                }
            }, 5 * 60 * 1000)
            
            // ❌ cancelamento automático após 15 minutos
            setTimeout(() => {
                const n = db.negociacoes[username]
                if (n && n.estado === 'aguardando_pagamento') {
                    delete db.negociacoes[username]
                    salvarDB()
                    enviarSequencia([
                        `/tell ${username} ❌ Sua negociação foi cancelada por inatividade.`,
                        `/tell ${username} Para tentar novamente, digite: negociar`
                    ])
                }
            }, 15 * 60 * 1000)

        } else {
            enviarSequencia([`/tell ${username} Digite negociar para iniciar.`])
        }
    }

    
    if (CONFIG.admins.includes(username) && messageRaw.startsWith('cmd ')) {
        const comando = messageRaw.replace('cmd ', '')
        exec(comando, (err, stdout, stderr) => { console.log(`Exec: ${stdout || stderr}`) })
        bot.chat(`/tell ${username} Comando executado.`)
    }
}

const REGEX_PAGAMENTO = /\[PIX\] Você recebeu ([\d.,]+) de (\w+)/i

function processarPagamento(msg) {
    const match = msg.match(REGEX_PAGAMENTO)
    if (match) {
        const valorTexto = match[1].replace(/\./g, '').replace(',', '.') 
        const valor = parseFloat(valorTexto)
        const pagador = match[2]
        console.log(`💰 Pagamento detectado: ${valor} de ${pagador}`)
        
        const negociacao = db.negociacoes[pagador]
        
        if (negociacao && negociacao.estado === 'aguardando_pagamento') {
            if (Math.abs(valor - CONFIG.precoSemana) < 100) { 
                aceitarContrato(pagador)
            } else {
                reembolsarSeguro(pagador, valor, "Valor incorreto")
            }
        } else {
            reembolsarSeguro(pagador, valor, "Sem negociação aberta")
        }
    }
}

function reembolsarSeguro(cliente, valor, motivo) {
    const idTransacao = Date.now()
    if (!db.reembolsos) db.reembolsos = []
    
    db.reembolsos.push({
        id: idTransacao,
        cliente: cliente,
        valor: valor,
        motivo: motivo,
        status: 'PENDENTE',
        data: new Date().toLocaleString()
    })
    salvarDB()

    console.log(`💸 Iniciando reembolso para ${cliente}...`)

    enviarSequencia([
        `/pix ${cliente} ${valor}`,
        `/tell ${cliente} ⚠️ O valor recebido não confere.`,
        `/tell ${cliente} Para sua segurança, o valor foi devolvido automaticamente.`,
        `/tell ${cliente} Se desejar, você pode iniciar novamente digitando: negociar`
    ], 4000)

    setTimeout(() => {
        const item = db.reembolsos.find(r => r.id === idTransacao)
        if (item) item.status = 'ENVIADO_AUTO'
        salvarDB()
    }, 8000)
}

function verificarPendencias() {
    console.log("--- 🕵️ RELATÓRIO DE PENDÊNCIAS FINANCEIRAS ---")
    if (!db.reembolsos || db.reembolsos.length === 0) {
        console.log("Nenhum registro financeiro.")
        return
    }
    const pendentes = db.reembolsos.filter(r => r.status === 'PENDENTE')
    if (pendentes.length === 0) {
        console.log("✅ Todos os reembolsos foram processados.")
    } else {
        console.log(`⚠️ ALERTA: ${pendentes.length} reembolsos pendentes:`)
        pendentes.forEach(p => {
            console.log(`- ${p.data}: ${p.cliente} -> $${p.valor} (Motivo: ${p.motivo})`)
        })
        console.log("Use '/pix Nick Valor' manualmente para resolver.")
    }
    console.log("-----------------------------------------------")
}

function tratarLoginAuth(bot, jsonMsg) {
    if (!JSON.stringify(jsonMsg).includes('clickEvent')) return
    const varrer = (obj) => {
        if (obj.clickEvent && obj.clickEvent.action === 'run_command') {
            const cmd = obj.clickEvent.value
            const texto = (obj.text || "").toLowerCase()
            if (cmd.toLowerCase().includes('nao') || texto.includes('não') || texto.includes('nao')) {
                console.log(`🖱️ Clicando em: "${obj.text}" (${cmd})`)
                bot.chat(cmd)
                return true
            }
        }
        if (obj.extra) for (const child of obj.extra) if (varrer(child)) return true
        return false
    }
    varrer(jsonMsg)
}

function aceitarContrato(cliente) {
    const duracao = 7 * 24 * 60 * 60 * 1000 // 7 dias
    adicionarOuRenovar(cliente, duracao, true)
    delete db.negociacoes[cliente]
    salvarDB()
}

function adicionarOuRenovar(cliente, duracaoMs, pago = false) {
    const nickLimpo = cliente.replace(/[^a-zA-Z0-9_]/g, '').substring(0, 8)
    const botName = `Plasma_${nickLimpo}`
    
    const baseTime = (db.clientes[cliente] && db.clientes[cliente].dataFim > Date.now()) 
        ? db.clientes[cliente].dataFim 
        : Date.now()

    db.clientes[cliente] = { 
        botName, 
        dataInicio: Date.now(), 
        dataFim: baseTime + duracaoMs, 
        lojaId: 'plasma'
    }
    salvarDB()

    console.log(`✅ Cliente ${cliente} adicionado/renovado por ${(duracaoMs / (1000*60*60)).toFixed(1)}h.`)
    
    if (pago) {
        enviarSequencia([
            `/tell ${cliente} ✅ ${db.clientes[cliente] ? 'Renovação' : 'Compra'} confirmada!`,
            `/tell ${cliente} Bot garantido até ${new Date(db.clientes[cliente].dataFim).toLocaleString()}.`
        ], 3000)
    }
    
    setTimeout(() => iniciarSessaoTmux(cliente, botName, db.clientes[cliente] ? true : false), 6000)
}

function adicionarTeste(cliente, dias) {
    let duracaoMs = 60 * 60 * 1000 // Padrão: 1 hora
    let tipo = "1h"

    if (dias && !isNaN(dias)) {
        duracaoMs = parseFloat(dias) * 24 * 60 * 60 * 1000
        tipo = `${dias} dias`
    }

    console.log(`🧪 Adicionando teste de ${tipo} para ${cliente}...`)
    adicionarOuRenovar(cliente, duracaoMs, false)
}

function iniciarSessaoTmux(cliente, botName, restauracao = false) {
    const sessionName = `plasma_${cliente.toLowerCase().substring(0, 8)}`
    
    const comando = `tmux new-session -d -s ${sessionName} "export BOT_PASSWORD='${CONFIG.password}'; node worker_loader.js ${cliente} ${botName}"`

    exec(comando, (error, stdout, stderr) => {
        if (!error) {
            console.log(`⚙️ Bot de ${cliente} iniciado.`)
            if (!restauracao) {
                enviarSequencia([
                   `/tell ${cliente} ✅ Seu bot está online! Nick: ${botName}.`,
                   `/tell ${cliente} Mande "help" no chat privado dele para ver os comandos.`
                ], 4000)
            }
        } else {
            if (error.message.includes('duplicate')) {
               if (restauracao) console.log(`ℹ️ Bot de ${cliente} já está rodando.`)
            } else {
               console.log(`Erro ao iniciar tmux para ${cliente}: ${error.message}`)
            }
        }
    })
}

function restaurarSessoesAntigas() {
    console.log("♻️ [DB] Verificando banco de dados para restaurar bots...")
    const clientes = Object.keys(db.clientes)
    const total = clientes.length
    const agora = Date.now()
    let ativos = 0
    if (total === 0) { console.log("📂 [DB] Banco de dados vazio."); return }
    console.log(`🔎 [DB] Encontrados ${total} registros. Processando...`)
    for (const [cliente, dados] of Object.entries(db.clientes)) {
        if (dados.dataFim > agora) {
            iniciarSessaoTmux(cliente, dados.botName, true)
            ativos++
        } else {
            delete db.clientes[cliente]
            salvarDB()
        }
    }
    console.log(`📊 [Status] ${ativos} bots ativos restaurados.`)
}

function verificarExpiracoes() {
    const agora = Date.now()
    for (const [cliente, dados] of Object.entries(db.clientes)) {
        if (agora > dados.dataFim) {
            console.log(`⏳ Contrato de ${cliente} expirou.`)
            const sessionName = `plasma_${cliente.toLowerCase().substring(0, 8)}`
            exec(`tmux send-keys -t ${sessionName} "encerrar_contrato" Enter`)
            setTimeout(() => {
                exec(`tmux kill-session -t ${sessionName}`)
                delete db.clientes[cliente]
                salvarDB()
            }, 30000)
        }
    }
}

function formatarDinheiro(valor) {
    return valor.toLocaleString('pt-BR')
}

iniciarGerente()
