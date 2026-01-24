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
// Padrão definido para 'plasma'
const LOJA_ID = args[2] || 'plasma'; 
const SENHA_PADRAO = '***REMOVED***'; 

const ID_ITEM_ALVO = 'golden_axe'; 
const ID_ITEM_MAO = 'diamond';

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
// 🛡️ SILENCIADOR SUPREMO (AGORA BLOQUEIA TUDO)
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

// 1. Hook no stderr (Erros)
const originalStderrWrite = process.stderr.write;
process.stderr.write = function(chunk) { if (deveBloquear(chunk)) return false; return originalStderrWrite.apply(process.stderr, arguments) };

// 2. Hook no console.error
const originalConsoleError = console.error;
console.error = function(...args) { if (args.some(arg => deveBloquear(arg))) return; originalConsoleError.apply(console, args) };

// 3. Hook no stdout (Logs normais onde esse erro costuma vazar)
const originalStdoutWrite = process.stdout.write;
process.stdout.write = function(chunk) { if (deveBloquear(chunk)) return false; return originalStdoutWrite.apply(process.stdout, arguments) };

// 4. Hook no console.log (Para garantir)
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
            
            // 1. Login Temporizado 
            setTimeout(() => {
                bot.chat('/login ' + SENHA_PADRAO);
            }, 2000);

            // 2. Loop de Lobby 
            iniciarLoopLobby();

            // 3. Carregar Lógica
            carregarLogica();
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

        // --- EVENTOS DE NAVEGAÇÃO ---

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
                    if (loopLobby) clearInterval(loopLobby);
                    console.log("🚀 Entrada no servidor concluída.");
                    
                    // --- FIX: COMANDO DE LOJA NO LOADER ---
                    // Garante que o bot vá para a loja assim que entra no Survival
                    setTimeout(() => {
                        console.log(`🛒 Enviando para loja: /loja ${LOJA_ID}`);
                        bot.chat(`/loja ${LOJA_ID}`);
                    }, 3000); // 3 segundos de delay para garantir carregamento

                    if (currentLogic && currentLogic.onSurvival) currentLogic.onSurvival(bot);
                }, 1000);
            }
        });

        // --- CHAT DO SERVIDOR ---
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
    if (loopLobby) clearInterval(loopLobby);
    loopLobby = setInterval(() => {
        if (!bot || !bot.inventory) return;
        const itemMenu = bot.inventory.items().find(i => i.name.includes(ID_ITEM_MAO));
        if (itemMenu) {
            bot.equip(itemMenu, 'hand').then(() => bot.activateItem()).catch(() => {});
        }
    }, 15000); 
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
            novaLogica.start(bot, { dono: DONO, loja: LOJA_ID });
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