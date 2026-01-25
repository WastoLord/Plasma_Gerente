// USO: node worker_loader.js <Dono> <NickBot> <LojaID>
const mineflayer = require('mineflayer');
const readline = require('readline');
const fs = require('fs');
const { pathfinder } = require('mineflayer-pathfinder');
const pvp = require('mineflayer-pvp').plugin;

// --- ARGUMENTOS ---
const args = process.argv.slice(2);
if (args.length < 2) { console.log("❌ [Loader] Erro: Argumentos insuficientes."); process.exit(1); }
const DONO = args[0];
const BOT_NICK = args[1];
const LOJA_ID = args[2] || 'plasma'; 

// --- SEGURANÇA: SENHA VIA ENV ---
const SENHA_PADRAO = process.env.BOT_PASSWORD;
if (!SENHA_PADRAO) {
    console.error("❌ ERRO: 'BOT_PASSWORD' não definida. O bot não pode logar.");
    process.exit(1);
}

const ID_ITEM_ALVO = 'golden_axe'; 
const ID_ITEM_MAO = 'diamond';
const DB_FILE = 'plasma_db.json'; 

// --- CONFIGURAÇÃO DO COMANDO EXTRA (PRIMEIRA VEZ) ---
const COMANDO_EXTRA = '/skin set https://t.novaskin.me/2f3929c63dc51bc8a44c100f8531112d1270ee31cc3d3447656986d77a3df6bc';

console.log(`🤖 [Loader] Iniciando Protocolo Gerente para: ${BOT_NICK}`);

const connConfig = {
  host: 'jogar.craftsapiens.com.br',
  port: 25565,
  username: BOT_NICK, 
  password: SENHA_PADRAO,
  auth: 'offline',
  version: '1.21.4',
  checkTimeoutInterval: 120 * 1000 
};

// =========================================================================
// 🛡️ SILENCIADOR SUPREMO
// =========================================================================
const BLOQUEAR_LOGS = [
    'PartialReadError', 'Read error for undefined', 'protodef', 'packet_world_particles', 
    'eval at compile', 'ExtensionError', 'Method Not Allowed', 'DeprecationWarning',
    'punycode', 'physicTick', 'src/compiler.js', 'src/utils.js',
    'Chunk size', 'partial packet', 'entity_teleport', 'buffer :', 'was read', 
    'ECONNRESET', 'ETIMEDOUT', 'client timed out', 'KeepAlive',
    'Received packet', 'Unknown packet'
];

function deveBloquear(str) {
    if (!str) return false;
    return BLOQUEAR_LOGS.some(termo => str.toString().includes(termo));
}

const originalStderrWrite = process.stderr.write;
process.stderr.write = function(chunk) { if (deveBloquear(chunk)) return false; return originalStderrWrite.apply(process.stderr, arguments) };
const originalConsoleError = console.error;
console.error = function(...args) { if (args.some(arg => deveBloquear(arg))) return; originalConsoleError.apply(console, args) };
const originalStdoutWrite = process.stdout.write;
process.stdout.write = function(chunk) { if (deveBloquear(chunk)) return false; return originalStdoutWrite.apply(process.stdout, arguments) };
const originalLog = console.log;
console.log = function(...args) { if (args.some(arg => deveBloquear(arg))) return; originalLog.apply(console, args) };

process.on('uncaughtException', (err) => { 
    if (err.code === 'ECONNRESET' || err.message.includes('client timed out')) return;
});
process.on('unhandledRejection', () => {});

// --- VARIÁVEIS DE CONTROLE ---
const LOGIC_FILE = './worker_logic.js';
let bot = null;
let currentLogic = null;
let reconnectTimer = null;
let loopLobby = null; 

// --- FUNÇÕES DE PERSISTÊNCIA ---
function lerDB() {
    try {
        if (fs.existsSync(DB_FILE)) {
            return JSON.parse(fs.readFileSync(DB_FILE));
        }
    } catch(e) {}
    return { clientes: {} }; 
}

function salvarDB(dados) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(dados, null, 2));
    } catch(e) {
        console.log("Erro ao salvar DB:", e.message);
    }
}

function iniciarBot() {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (loopLobby) clearInterval(loopLobby);

    console.log(`🔌 (Re)Conectando Worker ${BOT_NICK}...`);
    
    if (bot) {
        bot.removeAllListeners();
        try { bot.quit() } catch(e){}
        bot = null;
    }

    try {
        bot = mineflayer.createBot(connConfig);
        bot.loadPlugin(pathfinder);
        bot.loadPlugin(pvp);

        bot.on('login', () => {
            console.log('🔑 Autenticado! Entrando no mundo...');
        });

        bot.on('spawn', () => {
            console.log('✅ Worker online e spawnado!');
            
            // Login inicial
            setTimeout(() => {
                bot.chat('/login ' + SENHA_PADRAO);
            }, 2000);

            iniciarLoopLobby();
            carregarLogica();
        });

        // --- CORREÇÃO: DETECÇÃO DE REINÍCIO DO SERVIDOR ---
        bot.on('respawn', () => {
            console.log("🔄 Respawn detectado (possível volta ao lobby).");
            // Se o servidor reiniciou, ele pode pedir login de novo e precisa do loop do lobby
            setTimeout(() => {
                bot.chat('/login ' + SENHA_PADRAO);
            }, 2000);
            
            // Garante que o radar de lobby esteja ativo
            iniciarLoopLobby();
        });

        bot.on('end', (reason) => {
            console.log(`❌ Conexão perdida. Reconectando em 15s...`);
            agendarReconexao(15000); 
        });

        bot.on('error', (err) => {
            if (!deveBloquear(err.message)) {
                console.log(`🚨 Erro Worker: ${err.message}`);
            }
        });

        bot.on('windowOpen', (window) => {
            if (window.type === 'minecraft:inventory') return;
            
            let titulo = window.title;
            try { titulo = JSON.parse(window.title).text || window.title; } catch(e) { 
                try { titulo = JSON.stringify(window.title); } catch(z) {}
            }
            console.log(`📂 Janela aberta: "${titulo}"`);
            
            const alvo = window.slots.find(item => item && item.name.includes(ID_ITEM_ALVO));
            if (alvo) {
                console.log(`🎯 Servidor encontrado. Entrando...`);
                bot.clickWindow(alvo.slot, 0, 0);
                setTimeout(() => {
                    if (bot.currentWindow) bot.closeWindow(bot.currentWindow);
                    
                    // --- CORREÇÃO: NÃO MATA O LOOP DO LOBBY ---
                    // Em vez de clearInterval, deixamos ele rodando (watchdog).
                    // Se o bot voltar pro lobby (com diamante na mão), ele reage sozinho.
                    console.log("🚀 Entrada no servidor concluída. (Monitoramento de lobby mantido)");
                    
                    // --- BLOCO DE PRIMEIRA VEZ (Loja + Comando Extra) ---
                    setTimeout(() => {
                        const db = lerDB();
                        
                        if (db.clientes && db.clientes[DONO]) {
                            if (!db.clientes[DONO].visitouLoja) {
                                console.log(`🛒 Primeira vez! Enviando para loja: /loja ${LOJA_ID}`);
                                bot.chat(`/loja ${LOJA_ID}`);
                                
                                setTimeout(() => {
                                    console.log(`✨ Executando comando único extra: ${COMANDO_EXTRA}`);
                                    bot.chat(COMANDO_EXTRA);
                                }, 2000);
                                
                                db.clientes[DONO].visitouLoja = true;
                                salvarDB(db);
                            }
                        } else {
                            // Fallback seguro
                            bot.chat(`/loja ${LOJA_ID}`);
                        }
                    }, 3000);

                    if (currentLogic && currentLogic.onSurvival) currentLogic.onSurvival(bot);
                }, 1000);
            }
        });

        bot.on('chat', (username, message) => {
            if (username === bot.username) return;
            console.log(`[Chat] ${username}: ${message}`);
        });

        bot.on('message', (jsonMsg) => {
            const msg = jsonMsg.toString();
            if (msg.trim().length > 0 && !msg.includes('[Combate]')) {
                console.log(`[Servidor] ${msg}`);
            }
            if (jsonMsg) tratarLoginAuth(bot, jsonMsg);
            if (msg.toLowerCase().includes('/registrar') || msg.includes('não foi registrado')) {
                console.log('📝 Criando conta...');
                setTimeout(() => bot.chat(`/register ${SENHA_PADRAO} ${SENHA_PADRAO}`), 1500);
            }
        });

    } catch (e) { 
        console.log("Erro fatal no createBot:", e);
        agendarReconexao(15000); 
    }
}

function agendarReconexao(ms) {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(iniciarBot, ms);
}

function iniciarLoopLobby() {
    // Garante que não duplica loops
    if (loopLobby) clearInterval(loopLobby);
    
    console.log("🧭 Radar de Lobby Ativado (Buscando Diamante)");
    
    // Intervalo aumentado para 20s para não spammar tanto, mas garantir detecção
    loopLobby = setInterval(() => {
        if (!bot || !bot.inventory) return;
        
        const itemMenu = bot.inventory.items().find(i => i.name.includes(ID_ITEM_MAO));
        
        // Só tenta usar se achar o item e não estiver com janela aberta (pra não bugar menu)
        if (itemMenu && !bot.currentWindow) {
            // console.log("💎 Diamante detectado! Tentando abrir menu..."); // Debug opcional
            bot.equip(itemMenu, 'hand').then(() => bot.activateItem()).catch(() => {});
        }
    }, 20000); 
}

function tratarLoginAuth(bot, jsonMsg) {
    if (!JSON.stringify(jsonMsg).includes('clickEvent')) return;
    const varrer = (obj) => {
        if (obj.clickEvent && obj.clickEvent.action === 'run_command') {
            const cmd = obj.clickEvent.value;
            const texto = (obj.text || "").toLowerCase();
            if (cmd.toLowerCase().includes('nao') || texto.includes('não') || texto.includes('nao')) {
                console.log(`🖱️ Clicando em: "${obj.text}" (${cmd})`);
                bot.chat(cmd);
                return true;
            }
        }
        if (obj.extra) for (const child of obj.extra) if (varrer(child)) return true;
        return false;
    }
    varrer(jsonMsg);
}

function carregarLogica() {
    if (currentLogic && currentLogic.stop) try { currentLogic.stop(bot) } catch(e) {}
    delete require.cache[require.resolve(LOGIC_FILE)];
    try {
        const novaLogica = require(LOGIC_FILE);
        if (novaLogica.start) {
            novaLogica.start(bot, { dono: DONO, loja: LOJA_ID, botName: BOT_NICK, password: SENHA_PADRAO });
            currentLogic = novaLogica;
        }
    } catch (e) { console.log("Erro lógica:", e); }
}

let debounce = false;
fs.watch(LOGIC_FILE, (e, f) => {
    if (!f || debounce) return;
    debounce = true;
    setTimeout(() => debounce = false, 500);
    if (bot?.entity) carregarLogica();
});

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.on('line', (input) => { 
    if (input.trim() === 'encerrar_contrato') {
        if (currentLogic?.encerrar) currentLogic.encerrar(bot);
        else process.exit(0);
    } else if (bot?.entity) bot.chat(input);
});

iniciarBot();