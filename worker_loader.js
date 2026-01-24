// USO: node worker_loader.js <Dono> <NickBot> <LojaID>
const mineflayer = require('mineflayer');
const readline = require('readline');
const fs = require('fs');
const { pathfinder } = require('mineflayer-pathfinder');
const pvp = require('mineflayer-pvp').plugin;

// --- ARGUMENTOS & CONFIGURAÇÃO IDENTICA AO GERENTE ---
const args = process.argv.slice(2);
if (args.length < 2) { console.log("❌ [Loader] Erro: Argumentos insuficientes."); process.exit(1); }
const DONO = args[0];
const BOT_NICK = args[1];
const LOJA_ID = args[2] || 'loja';
const SENHA_PADRAO = '***REMOVED***'; // Mesma senha do gerente ou argumento se preferir

// Item alvo para entrar no servidor (Mesma lógica do CONFIG do Gerente)
const ID_ITEM_ALVO = 'golden_axe'; 
const ID_ITEM_MAO = 'diamond';

console.log(`🤖 [Loader] Iniciando Protocolo Gerente para: ${BOT_NICK}`);

const connConfig = {
  host: 'jogar.craftsapiens.com.br',
  port: 25565,
  username: BOT_NICK, 
  password: SENHA_PADRAO, // Injetado direto na config, igual ao Gerente
  auth: 'offline',
  version: '1.21.4',
  checkTimeoutInterval: 120 * 1000 
};

// =========================================================================
// 🛡️ SILENCIADOR SUPREMO (Clone exato do Gerente)
// =========================================================================
const BLOQUEAR_LOGS = [
    'PartialReadError', 'Read error for undefined', 'protodef', 'packet_world_particles', 
    'eval at compile', 'ExtensionError', 'Method Not Allowed', 'DeprecationWarning',
    'punycode', 'physicTick', 'src/compiler.js', 'src/utils.js',
    'Chunk size is', 'partial packet', 'entity_teleport', 'buffer :', 'was read',
    'ECONNRESET', 'ETIMEDOUT', 'client timed out', 'KeepAlive'
];

function deveBloquear(str) {
    if (!str) return false;
    return BLOQUEAR_LOGS.some(termo => str.toString().includes(termo));
}

const originalStderrWrite = process.stderr.write;
process.stderr.write = function(chunk) { if (deveBloquear(chunk)) return false; return originalStderrWrite.apply(process.stderr, arguments) };
const originalConsoleError = console.error;
console.error = function(...args) { if (args.some(arg => deveBloquear(arg))) return; originalConsoleError.apply(console, args) };
process.on('uncaughtException', (err) => { 
    if (err.code === 'ECONNRESET' || err.message.includes('client timed out')) return;
});
process.on('unhandledRejection', () => {});

// --- VARIÁVEIS DE CONTROLE ---
const LOGIC_FILE = './worker_logic.js';
let bot = null;
let currentLogic = null;
let reconnectTimer = null;
let loopLobby = null; // Adicionado para manter simetria

// --- LÓGICA DE INICIALIZAÇÃO (Clone do iniciarGerente) ---
function iniciarBot() {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (loopLobby) clearInterval(loopLobby);

    console.log(`🔌 (Re)Conectando Worker ${BOT_NICK}...`);
    
    // Limpeza prévia
    if (bot) {
        bot.removeAllListeners();
        try { bot.quit() } catch(e){}
        bot = null;
    }

    try {
        bot = mineflayer.createBot(connConfig);
        
        // Plugins carregados na inicialização, mas lógica só depois
        bot.loadPlugin(pathfinder);
        bot.loadPlugin(pvp);

        // --- EVENTOS DE CONEXÃO IDÊNTICOS AO GERENTE ---
        
        bot.on('login', () => {
            console.log('🔑 Autenticado! Entrando no mundo...');
        });

        bot.on('spawn', () => {
            console.log('✅ Worker online e spawnado!');
            
            // 1. Login Temporizado (Igual ao Gerente: setTimeout 2000)
            setTimeout(() => {
                bot.chat('/login ' + SENHA_PADRAO);
            }, 2000);

            // 2. Loop de Lobby (Igual ao Gerente)
            iniciarLoopLobby();

            // 3. Carregar Lógica Comportamental (Só comportamento, não conexão)
            // Carregamos logo para os sistemas estarem prontos, mas a conexão é controlada aqui
            carregarLogica();
        });

        bot.on('end', (reason) => {
            console.log(`❌ Conexão perdida. Reconectando em 15s... (Igual Gerente)`);
            agendarReconexao(15000); // Mudado de 30s para 15s para igualar o Gerente
        });

        bot.on('error', (err) => {
            if (!deveBloquear(err.message)) {
                console.log(`🚨 Erro Worker: ${err.message}`);
            }
        });

        // --- EVENTOS DO JOGO (NAVEGAÇÃO DE LOBBY) ---
        // Movido da 'logic' para o 'loader' para garantir execução prioritária

        bot.on('windowOpen', (window) => {
            if (window.type === 'minecraft:inventory') return;
            console.log(`📂 Janela aberta: "${window.title}"`);
            
            const alvo = window.slots.find(item => item && item.name.includes(ID_ITEM_ALVO));
            if (alvo) {
                console.log(`🎯 Servidor encontrado. Entrando...`);
                bot.clickWindow(alvo.slot, 0, 0);
                setTimeout(() => {
                    if (bot.currentWindow) bot.closeWindow(bot.currentWindow);
                    if (loopLobby) clearInterval(loopLobby);
                    console.log("🚀 Entrada no servidor concluída.");
                    
                    // Opcional: Avisar a lógica que entramos no survival
                    if (currentLogic && currentLogic.onSurvival) currentLogic.onSurvival(bot);
                }, 1000);
            }
        });

        bot.on('message', (jsonMsg) => {
            const msg = jsonMsg.toString();
            // Logs importantes apenas
            if (msg.toLowerCase().includes('registrado') || msg.includes('/login')) console.log(`[Servidor] ${msg}`);
            
            // Tratamento de Auth Click (Anti-Bot) - Copiado do Gerente
            if (jsonMsg) tratarLoginAuth(bot, jsonMsg);

            // Auto-Registro (Caso conta nova)
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

// --- FUNÇÕES AUXILIARES (Cópias do Gerente) ---

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

// --- HOT RELOAD DE LÓGICA (Mantido para funcionalidades, mas sem controle de conexão) ---
function carregarLogica() {
    if (currentLogic && currentLogic.stop) try { currentLogic.stop(bot) } catch(e) {}
    delete require.cache[require.resolve(LOGIC_FILE)];
    try {
        const novaLogica = require(LOGIC_FILE);
        // Passamos o bot JÁ CONECTADO e AUTENTICADO
        if (novaLogica.start) {
            novaLogica.start(bot, { dono: DONO, loja: LOJA_ID });
            currentLogic = novaLogica;
        }
    } catch (e) { console.log("Erro lógica:", e); }
}

// Watcher do arquivo de lógica
let debounce = false;
fs.watch(LOGIC_FILE, (e, f) => {
    if (!f || debounce) return;
    debounce = true;
    setTimeout(() => debounce = false, 500);
    if (bot?.entity) carregarLogica();
});

// Interface de Chat Manual (Loader)
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.on('line', (input) => { 
    if (input.trim() === 'encerrar_contrato') {
        if (currentLogic?.encerrar) currentLogic.encerrar(bot);
        else process.exit(0);
    } else if (bot?.entity) bot.chat(input);
});

// INÍCIO
iniciarBot();