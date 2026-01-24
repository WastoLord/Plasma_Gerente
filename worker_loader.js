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
const LOJA_ID = args[2] || 'loja';

console.log(`🤖 [Loader] Iniciando Modular: ${BOT_NICK} (Dono: ${DONO})`);

const connConfig = {
  host: 'jogar.craftsapiens.com.br',
  port: 25565,
  username: BOT_NICK, 
  auth: 'offline',
  version: '1.21.4',
  checkTimeoutInterval: 120 * 1000 
};

const LOGIC_FILE = './worker_logic.js';
let bot = null;
let currentLogic = null;
let reconnectTimer = null;
let isReconnecting = false;

const BLOQUEAR_LOGS = ['PartialReadError', 'protodef', 'physicTick', 'Chunk size', 'ECONNRESET', 'ETIMEDOUT'];
const originalStderrWrite = process.stderr.write;
process.stderr.write = function(chunk) { 
    if (BLOQUEAR_LOGS.some(t => chunk.toString().includes(t))) return false;
    return originalStderrWrite.apply(process.stderr, arguments);
};
process.on('uncaughtException', () => {});

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.on('line', (input) => { 
    if (input.trim() === 'encerrar_contrato') {
        if (currentLogic?.encerrar) currentLogic.encerrar(bot);
        else process.exit(0);
    } else if (bot?.entity) bot.chat(input);
});

function iniciarBot() {
    if (isReconnecting) return;
    isReconnecting = true;
    if (bot) { bot.removeAllListeners(); try { bot.quit() } catch(e){} bot = null; }
    if (reconnectTimer) clearTimeout(reconnectTimer);

    console.log(`🔌 Conectando...`);
    try {
        bot = mineflayer.createBot(connConfig);
        bot.loadPlugin(pathfinder);
        bot.loadPlugin(pvp);

        bot.once('spawn', () => {
            console.log(`✅ Conectado!`);
            carregarLogica();
            isReconnecting = false;
        });

        bot.on('end', () => { console.log(`🔻 Caiu. 30s...`); agendarReconexao(30000); });
        
        bot.on('kicked', (r) => {
            const m = JSON.stringify(r).toLowerCase();
            const delay = (m.includes('too fast') || m.includes('already connected')) ? 60000 : 30000;
            console.log(`❌ Kicked. ${delay/1000}s...`);
            agendarReconexao(delay);
        });

    } catch (e) { agendarReconexao(30000); }
}

function agendarReconexao(ms) {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    isReconnecting = false; 
    reconnectTimer = setTimeout(iniciarBot, ms);
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

iniciarBot();