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

// =========================================================================
// 🛡️ SILENCIADOR SUPREMO
// =========================================================================
const BLOQUEAR_LOGS = [
  'PartialReadError','Read error for undefined','protodef','packet_world_particles',
  'eval at compile','ExtensionError','Method Not Allowed','DeprecationWarning',
  'punycode','physicTick','src/compiler.js','src/utils.js','Chunk size','partial packet',
  'entity_teleport','buffer :','was read','ECONNRESET','ETIMEDOUT','client timed out',
  'KeepAlive','Received packet','Unknown packet'
]
function deveBloquear(str){ if(!str) return false; return BLOQUEAR_LOGS.some(t=>str.toString().includes(t)) }
const oSE = process.stderr.write; process.stderr.write = function(c){ if(deveBloquear(c)) return false; return oSE.apply(process.stderr,arguments) }
const oCE = console.error; console.error = function(...a){ if(a.some(x=>deveBloquear(x))) return; oCE.apply(console,a) }
const oSO = process.stdout.write; process.stdout.write = function(c){ if(deveBloquear(c)) return false; return oSO.apply(process.stdout,arguments) }
const oCL = console.log; console.log = function(...a){ if(a.some(x=>deveBloquear(x))) return; oCL.apply(console,a) }
process.on('uncaughtException', (err)=>{ if(err.code==='ECONNRESET'||err.message.includes('client timed out')) return })
process.on('unhandledRejection', ()=>{})

// ================= FILA GLOBAL DE CHAT (ANTI-FLOOD) =================
let filaChat = []
let processandoFila = false
function enviarSequencia(mensagens, delay = 3500){
  mensagens.forEach(msg => filaChat.push({msg, delay}))
  processarFila()
}
function processarFila(){
  if(processandoFila || filaChat.length===0) return
  processandoFila = true
  const {msg, delay} = filaChat.shift()
  if(bot && bot.entity){ console.log(`[FilaChat] ${msg}`); bot.chat(msg) }
  setTimeout(()=>{ processandoFila=false; processarFila() }, delay)
}

// --- CHAT MANUAL ---
const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
rl.on('line', (input) => { 
  const cmd = input.trim().toLowerCase()
  if (cmd === 'pendentes' || cmd === 'verificar' || cmd === 'bots') {
    if (cmd === 'pendentes') verificarPendencias()
    else restaurarSessoesAntigas()
    return
  }
  if (cmd.startsWith('teste ')) {
    const parts = cmd.split(' ')
    const nick = parts[1]
    const dias = parts[2]
    if (nick) adicionarTeste(nick, dias)
    return
  }
  if (bot?.entity) { bot.chat(input); console.log(`[Gerente] > ${input}`) }
  else console.log('⚠️ O bot ainda não entrou no servidor.')
})

// ================= BANCO =================
const DB_FILE = 'plasma_db.json'
let db = { clientes:{}, negociacoes:{}, reembolsos:[], interacoes:{} }
if (fs.existsSync(DB_FILE)) {
  try { db = { ...db, ...JSON.parse(fs.readFileSync(DB_FILE)) } }
  catch { console.log("DB Novo criado.") }
}
function salvarDB(){ fs.writeFileSync(DB_FILE, JSON.stringify(db,null,2)) }

// ================= BOT =================
let bot=null, loopLobby=null, loopExpiracao=null
function iniciarGerente(){
  console.log(`🔌 (Re)Conectando Gerente em ${CONFIG.host}...`)
  if(loopLobby) clearInterval(loopLobby)
  if(loopExpiracao) clearInterval(loopExpiracao)
  bot = mineflayer.createBot(CONFIG)

  bot.on('login', ()=> console.log('🔑 Autenticado!'))
  bot.on('spawn', ()=>{
    console.log('✅ Gerente Plasma online!')
    setTimeout(()=>bot.chat('/login '+CONFIG.password),2000)
    loopExpiracao = setInterval(verificarExpiracoes, 10*60*1000)
    iniciarLoopLobby()
    setTimeout(restaurarSessoesAntigas, 10000)
  })
  bot.on('respawn', ()=>{
    setTimeout(()=>bot.chat('/login '+CONFIG.password),2000)
    iniciarLoopLobby()
  })
  bot.on('end', ()=>{ console.log('❌ Conexão perdida. Reconectando em 15s...'); setTimeout(iniciarGerente,15000) })
  bot.on('error', (err)=>{ if(!deveBloquear(err.message)) console.log(`🚨 Erro: ${err.message}`) })

  bot.on('windowOpen',(window)=>{
    if(window.type==='minecraft:inventory') return
    const alvo = window.slots.find(i=>i && i.name.includes(CONFIG.idItemAlvo))
    if(alvo){
      bot.clickWindow(alvo.slot,0,0)
      setTimeout(()=> bot.currentWindow && bot.closeWindow(bot.currentWindow),1000)
    }
  })

  bot.on('message',(jsonMsg)=>{
    const msg = jsonMsg.toString()
    if(msg.trim()) console.log(`[Servidor] ${msg}`)
    tratarLoginAuth(bot, jsonMsg)
    if (msg.toLowerCase().includes('/registrar') || msg.toLowerCase().includes('/register') || msg.includes('não foi registrado')) {
      setTimeout(()=>bot.chat(`/register ${CONFIG.password} ${CONFIG.password}`),1500)
    }
    processarPagamento(msg)
    const REGEX_TELL = /\[Privado\] Mensagem de (?:\[.*?\] )?(\w+): (.+)/i
    const m = msg.match(REGEX_TELL)
    if(m){ tratarComandosCliente(m[1], m[2]) }
  })

  // ❌ REMOVIDO: responder ao chat global
}

function iniciarLoopLobby(){
  if(loopLobby) clearInterval(loopLobby)
  console.log("🧭 Radar de Lobby Ativado")
  loopLobby = setInterval(()=>{
    if(!bot||!bot.inventory) return
    const itemMenu = bot.inventory.items().find(i=>i.name.includes(CONFIG.idItemMao))
    if(itemMenu && !bot.currentWindow){
      bot.equip(itemMenu,'hand').then(()=>bot.activateItem()).catch(()=>{})
    }
  },20000)
}

// ================= INTERAÇÃO (SÓ TELL) =================
function tratarComandosCliente(username, messageRaw){
  const message = messageRaw.replace(/\./g,'').trim().toLowerCase()

  if(!db.interacoes[username]){
    db.interacoes[username]=Date.now(); salvarDB()
    enviarSequencia([
      `/tell ${username} Olá! Sou o Gerente da loja Plasma 🤖`,
      `/tell ${username} Posso te ajudar a contratar um bot.`,
      `/tell ${username} Para começar, digite: negociar`
    ])
    return
  }

  if(message==='negociar' || message.includes('comprar bot')){
    let msgs=[]
    if(db.clientes[username]){
      const restante = db.clientes[username].dataFim - Date.now()
      const dias = (restante/86400000).toFixed(1)
      msgs.push(`/tell ${username} Você já tem um bot ativo.`)
      msgs.push(`/tell ${username} Restam ${dias} dias.`)
      msgs.push(`/tell ${username} Para renovar, digite: confirmar`)
    } else {
      msgs.push(`/tell ${username} O aluguel custa $${formatarDinheiro(CONFIG.precoSemana)} por semana.`)
      msgs.push(`/tell ${username} Para confirmar, digite: confirmar`)
    }
    enviarSequencia(msgs)
    db.negociacoes[username]={estado:'aguardando_confirmacao', timestamp:Date.now()}
    salvarDB()
  }

  else if(message==='confirmar'){
    const n = db.negociacoes[username]
    if(n && n.estado==='aguardando_confirmacao'){
      enviarSequencia([
        `/tell ${username} Perfeito 👍`,
        `/tell ${username} Envie o PIX usando:`,
        `/tell ${username} /pix ${bot.username} ${CONFIG.precoSemana}`
      ])
      n.estado='aguardando_pagamento'; salvarDB()
      setTimeout(()=>{
        const x=db.negociacoes[username]
        if(x && x.estado==='aguardando_pagamento'){
          enviarSequencia([
            `/tell ${username} ⏳ Seu pedido ainda aguarda pagamento.`,
            `/tell ${username} Se desejar continuar, envie o PIX.`
          ])
        }
      },5*60*1000)
    } else {
      bot.chat(`/tell ${username} Digite "negociar" para iniciar.`)
    }
  }

  else if(
    message.includes('preço')||message.includes('valor')||
    message.includes('quanto')||message.includes('custa')
  ){
    enviarSequencia([
      `/tell ${username} O aluguel custa $${formatarDinheiro(CONFIG.precoSemana)} por semana.`,
      `/tell ${username} Se quiser continuar, digite: negociar`
    ])
  }

  if(CONFIG.admins.includes(username) && messageRaw.startsWith('cmd ')){
    const comando = messageRaw.replace('cmd ','')
    exec(comando,(e,so,se)=>console.log(`Exec: ${so||se}`))
    bot.chat(`/tell ${username} Comando executado.`)
  }
}

// ================= PAGAMENTOS =================
const REGEX_PAGAMENTO = /\[PIX\] Você recebeu ([\d.,]+) de (\w+)/i
function processarPagamento(msg){
  const m = msg.match(REGEX_PAGAMENTO); if(!m) return
  const valor = parseFloat(m[1].replace(/\./g,'').replace(',','.'))
  const pagador = m[2]
  const n = db.negociacoes[pagador]
  if(n && n.estado==='aguardando_pagamento' && Math.abs(valor-CONFIG.precoSemana)<100){
    aceitarContrato(pagador)
  } else {
    reembolsarSeguro(pagador, valor, "Valor incorreto ou sem negociação")
  }
}
function reembolsarSeguro(cliente, valor, motivo){
  const id=Date.now()
  db.reembolsos.push({id,cliente,valor,motivo,status:'PENDENTE',data:new Date().toLocaleString()})
  salvarDB()
  enviarSequencia([
    `/pix ${cliente} ${valor}`,
    `/tell ${cliente} ⚠️ O valor recebido não confere.`,
    `/tell ${cliente} Para sua segurança, o valor foi devolvido automaticamente.`,
    `/tell ${cliente} Se desejar, digite: negociar`
  ],4000)
  setTimeout(()=>{ const r=db.reembolsos.find(x=>x.id===id); if(r) r.status='ENVIADO_AUTO'; salvarDB() },8000)
}
function verificarPendencias(){ /* igual ao original */ }

// ================= CONTRATO / TMUX =================
function aceitarContrato(cliente){
  adicionarOuRenovar(cliente, 7*86400000, true)
  delete db.negociacoes[cliente]; salvarDB()
}
function adicionarOuRenovar(cliente, duracaoMs, pago=false){
  const nickLimpo = cliente.replace(/[^a-zA-Z0-9_]/g,'').substring(0,8)
  const botName = `Plasma_${nickLimpo}`
  const base = (db.clientes[cliente] && db.clientes[cliente].dataFim>Date.now()) ? db.clientes[cliente].dataFim : Date.now()
  db.clientes[cliente]={ botName, dataInicio:Date.now(), dataFim:base+duracaoMs, lojaId:'plasma' }
  salvarDB()
  if(pago){
    enviarSequencia([
      `/tell ${cliente} ✅ Pagamento confirmado!`,
      `/tell ${cliente} Seu bot está sendo iniciado agora...`
    ],3000)
  }
  setTimeout(()=> iniciarSessaoTmux(cliente, botName, !!pago), 6000)
}
function adicionarTeste(cliente,dias){ /* igual ao original */ }
function iniciarSessaoTmux(cliente, botName, restauracao=false){ /* igual ao original */ }
function restaurarSessoesAntigas(){ /* igual ao original */ }
function verificarExpiracoes(){
  const agora=Date.now()
  for(const [cliente,dados] of Object.entries(db.clientes)){
    if(dados.dataFim-agora<12*60*60*1000 && !dados.alertado){
      enviarSequencia([
        `/tell ${cliente} ⏰ Seu bot expira em menos de 12 horas.`,
        `/tell ${cliente} Para renovar, digite: negociar`
      ])
      dados.alertado=true; salvarDB()
    }
  }
}
function tratarLoginAuth(bot,jsonMsg){ /* igual ao original */ }
function formatarDinheiro(v){ return v.toLocaleString('pt-BR') }

iniciarGerente()
