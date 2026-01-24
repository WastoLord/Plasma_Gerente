const mineflayer = require('mineflayer')
const fs = require('fs')
const readline = require('readline') 
const { exec } = require('child_process')

// --- CONFIGURAÇÃO ---
const CONFIG = {
    host: 'jogar.craftsapiens.com.br',
    port: 25565,
    username: 'Plasma_Gerente',
    password: '***REMOVED***', 
    auth: 'offline',
    version: '1.21.4',
    admins: ['WastoLord_13'], 
    precoSemana: 5000000, 
    
    // Configuração de Entrada (Para ele sair do lobby e ir receber o dinheiro)
    idItemMao: 'diamond',      
    idItemAlvo: 'golden_axe'   
}

// =========================================================================
// 🛡️ SILENCIADOR SUPREMO V4.1 (BLOQUEIA TUDO)
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

// 1. Hook no stderr (Erros)
const originalStderrWrite = process.stderr.write
process.stderr.write = function(chunk) { if (deveBloquear(chunk)) return false; return originalStderrWrite.apply(process.stderr, arguments) }

// 2. Hook no console.error
const originalConsoleError = console.error
console.error = function(...args) { if (args.some(arg => deveBloquear(arg))) return; originalConsoleError.apply(console, args) }

// 3. Hook no stdout (Logs comuns)
const originalStdoutWrite = process.stdout.write
process.stdout.write = function(chunk) { if (deveBloquear(chunk)) return false; return originalStdoutWrite.apply(process.stdout, arguments) }

// 4. Hook no console.log
const originalLog = console.log
console.log = function(...args) { if (args.some(arg => deveBloquear(arg))) return; originalLog.apply(console, args) }

process.on('uncaughtException', (err) => { 
    if (err.code === 'ECONNRESET' || err.message.includes('client timed out')) return 
})
process.on('unhandledRejection', () => {})

// --- CHAT MANUAL ---
const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
rl.on('line', (input) => { 
    const cmd = input.trim().toLowerCase()
    
    if (cmd === 'pendentes' || cmd === 'verificar' || cmd === 'bots') {
        if (cmd === 'pendentes') verificarPendencias()
        else restaurarSessoesAntigas()
        return
    }

    // COMANDO DE TESTE: teste <nick>
    if (cmd.startsWith('teste ')) {
        const nick = cmd.split(' ')[1]
        if (nick) adicionarTeste(nick)
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

// --- FUNÇÃO DE SEQUÊNCIA DE MENSAGENS (ANTI-FLOOD) ---
function enviarSequencia(mensagens, delay = 3500) { 
    mensagens.forEach((msg, index) => {
        setTimeout(() => {
            if (bot && bot.entity) {
                console.log(`[Debug Chat] Enviando: ${msg}`)
                bot.chat(msg)
            }
        }, index * delay)
    })
}

// --- FUNÇÃO MESTRE DE INICIALIZAÇÃO ---
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
        // Delay maior na restauração para garantir que o Gerente estabilizou no Survival
        setTimeout(restaurarSessoesAntigas, 10000)
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

    // --- EVENTOS DO JOGO ---
    
    bot.on('windowOpen', (window) => {
        if (window.type === 'minecraft:inventory') return
        console.log(`📂 Janela aberta: "${window.title}"`)
        const alvo = window.slots.find(item => item && item.name.includes(CONFIG.idItemAlvo))
        if (alvo) {
            console.log(`🎯 Servidor encontrado. Entrando...`)
            bot.clickWindow(alvo.slot, 0, 0)
            setTimeout(() => {
                if (bot.currentWindow) bot.closeWindow(bot.currentWindow)
                if (loopLobby) clearInterval(loopLobby)
                console.log("🚀 Entrada no servidor concluída.")
            }, 1000)
        }
    })

    bot.on('message', (jsonMsg) => {
        const msg = jsonMsg.toString()
        if (msg.trim().length > 0) console.log(`[Servidor] ${msg}`)
        if (jsonMsg) tratarLoginAuth(bot, jsonMsg)
        
        // Auto-Registro
        if (msg.toLowerCase().includes('/registrar') || msg.toLowerCase().includes('/register') || msg.includes('não foi registrado')) {
            console.log('📝 Criando conta...')
            setTimeout(() => bot.chat(`/register ${CONFIG.password} ${CONFIG.password}`), 1500)
        }

        // Detector de Tell
        const REGEX_TELL = /\[Privado\] Mensagem de (?:\[.*?\] )?(\w+): (.+)/i
        const matchTell = msg.match(REGEX_TELL)
        if (matchTell) {
            const sender = matchTell[1]
            const content = matchTell[2]
            console.log(`📩 Tell de ${sender}: ${content}`)
            tratarComandosCliente(sender, content)
        }

        processarPagamento(msg)
    })

    bot.on('chat', (username, message) => {
        if (username === bot.username) return
        console.log(`[Chat] ${username}: ${message}`) 
        tratarComandosCliente(username, message)
    })
}

// --- SISTEMAS AUXILIARES ---

function iniciarLoopLobby() {
    if (loopLobby) clearInterval(loopLobby)
    loopLobby = setInterval(() => {
        if (!bot || !bot.inventory) return
        const itemMenu = bot.inventory.items().find(i => i.name.includes(CONFIG.idItemMao))
        if (itemMenu) {
            bot.equip(itemMenu, 'hand').then(() => bot.activateItem()).catch(() => {})
        }
    }, 15000) 
}

function tratarComandosCliente(username, messageRaw) {
    const message = messageRaw.replace(/\./g, '').trim().toLowerCase()

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
            bot.chat(`/tell ${username} Aguardando PIX de $${formatarDinheiro(CONFIG.precoSemana)} (/pix ${CONFIG.precoSemana} ${bot.username}).`)
            negociacao.estado = 'aguardando_pagamento'
            salvarDB()
        } else {
            bot.chat(`/tell ${username} Digite "negociar" para iniciar um pedido.`)
        }
    }
    
    if (CONFIG.admins.includes(username) && messageRaw.startsWith('cmd ')) {
        const comando = messageRaw.replace('cmd ', '')
        exec(comando, (err, stdout, stderr) => { console.log(`Exec: ${stdout || stderr}`) })
        bot.chat(`/tell ${username} Comando executado.`)
    }
}

// --- SISTEMA FINANCEIRO ---
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
        `/pix ${valor} ${cliente}`,
        `/tell ${cliente} Reembolso enviado: ${motivo}.`
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
        console.log("Use '/pix Valor Nick' manualmente para resolver.")
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

// FUNÇÃO UNIFICADA: ADICIONAR OU RENOVAR (+ COMANDO DE TESTE)
function adicionarOuRenovar(cliente, duracaoMs, pago = false) {
    const nickLimpo = cliente.replace(/[^a-zA-Z0-9_]/g, '').substring(0, 8)
    const botName = `Plasma_${nickLimpo}`
    
    // Data base é agora OU o fim do contrato atual se já existir
    const baseTime = (db.clientes[cliente] && db.clientes[cliente].dataFim > Date.now()) 
        ? db.clientes[cliente].dataFim 
        : Date.now()

    db.clientes[cliente] = { 
        botName, 
        dataInicio: Date.now(), 
        dataFim: baseTime + duracaoMs, 
        lojaId: 'plasma' // Definido padrão plasma no DB também
    }
    salvarDB()

    console.log(`✅ Cliente ${cliente} adicionado/renovado.`)
    
    if (pago) {
        enviarSequencia([
            `/tell ${cliente} ✅ ${db.clientes[cliente] ? 'Renovação' : 'Compra'} confirmada!`,
            `/tell ${cliente} Bot garantido até ${new Date(db.clientes[cliente].dataFim).toLocaleString()}.`
        ], 3000)
    }
    
    // Inicia (com delay para não atropelar as mensagens acima)
    setTimeout(() => iniciarSessaoTmux(cliente, botName, db.clientes[cliente] ? true : false), 6000)
}

// COMANDO DE TESTE (1 HORA)
function adicionarTeste(cliente) {
    console.log(`🧪 Adicionando teste de 1h para ${cliente}...`)
    adicionarOuRenovar(cliente, 60 * 60 * 1000, false)
}

function iniciarSessaoTmux(cliente, botName, restauracao = false) {
    const sessionName = `plasma_${cliente.toLowerCase().substring(0, 8)}`
    
    // ATUALIZAÇÃO: Removido o argumento 'loja' fixo.
    // Agora ele passa apenas 2 argumentos e o loader assume 'plasma'
    const comando = `tmux new-session -d -s ${sessionName} "node worker_loader.js ${cliente} ${botName}"`

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

// INICIA TUDO
iniciarGerente()