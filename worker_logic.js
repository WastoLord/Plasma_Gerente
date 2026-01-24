const pvp = require('mineflayer-pvp').plugin;
const Context = require('./core/context');
const Commands = require('./core/commands');
const Utils = require('./core/utils');

// Sistemas
const Lobby = require('./systems/lobby');
const Movement = require('./systems/movement');
const Combat = require('./systems/combat');
const Automation = require('./systems/automation');
const Health = require('./systems/health');

let ctx = null;

module.exports = {
    start: (bot, args) => {
        ctx = Context.create(args);
        console.log(`▶️ Worker Modular Ativo. Dono: ${ctx.config.dono}`);

        // Garante que o plugin PVP esteja carregado
        if (!bot.pvp) bot.loadPlugin(pvp);

        // Inicializa sistemas passivos
        Lobby.setup(bot, ctx);
        Movement.setup(bot);

        // Evento de "sobrevivência" chamado pelo Loader quando entra no servidor
        this.onSurvival = (botInstance) => {
            console.log("🌲 Modo Survival Ativado: Preparando combate e rotinas.");
        };

        // Loop Físico (Roda a cada tick do jogo)
        bot.on('physicsTick', () => {
            if (ctx.state.elevator.active) {
                Movement.tick(bot, ctx);
                return; // Se estiver no elevador, não combate
            }
            Combat.tick(bot, ctx);
            Health.tick(bot);
        });

        // Comandos (Chat + Tell)
        const handleCmd = (user, msg) => {
            const command = Commands.parse(user, msg, ctx);
            if (!command) return;

            const { cmd, arg } = command;
            
            // REMOVIDO: A linha que repetia "CMD: ..." foi apagada.
            // Agora ele vai direto para a execução.

            // --- CONTROLE GERAL ---
            if (cmd === 'parar' || cmd === 'paz') {
                stopAll(bot, ctx);
                Utils.feedback(bot, ctx, "🏳️ Parado."); // Feedback útil mantido
            }
            else if (cmd === 'help' || cmd === 'ajuda') {
                Utils.feedback(bot, ctx, "LISTA: vem, parar, subir, descer, guarda, ataque, usar <tempo>, itens, pix, loja");
            }

            // --- MOVIMENTO ---
            else if (cmd === 'vem') { 
                stopAll(bot, ctx); 
                Movement.follow(bot, ctx, user); 
                // "Indo!" já é enviado pelo sistema de movimento
            }
            else if (cmd === 'subir') Movement.startElevator(bot, ctx, 'subir', (m) => Utils.feedback(bot, ctx, m));
            else if (cmd === 'descer') Movement.startElevator(bot, ctx, 'descer', (m) => Utils.feedback(bot, ctx, m));

            // --- COMBATE ---
            else if (cmd === 'guarda') { 
                stopAll(bot, ctx); 
                Combat.setGuard(ctx, true); 
                Utils.feedback(bot, ctx, "🛡️ Guarda Ativa"); 
            }
            else if (cmd === 'ataque') { 
                stopAll(bot, ctx); 
                Combat.attack(bot, ctx, (m) => Utils.feedback(bot, ctx, m)); 
            }

            // --- AUTOMAÇÃO ---
            else if (cmd === 'usar') Automation.startAutoClick(bot, ctx, arg, (m) => Utils.feedback(bot, ctx, m));
            else if (cmd === 'itens') Automation.dropItems(bot, ctx);
            else if (cmd === 'pix') Automation.sendPix(bot, ctx);
            else if (cmd === 'loja') bot.chat(`/loja ${arg || 'plasma'}`);
        };

        bot.on('chat', handleCmd);
        
        bot.on('message', (jsonMsg) => {
            const msg = jsonMsg.toString();
            if (msg.includes('[Combate]')) return;
            
            const REGEX_CHAT = /[:\s]([a-zA-Z0-9_]+): (.+)/;
            const REGEX_TELL = /\[Privado\] Mensagem de (?:\[.*?\] )?([a-zA-Z0-9_]+): (.+)/i;
            
            let match = msg.match(REGEX_TELL) || msg.match(REGEX_CHAT);
            if (match) handleCmd(match[1], match[2]);
        });

        bot.on('death', () => {
            Utils.feedback(bot, ctx, "💀 Morri!");
            stopAll(bot, ctx);
            setTimeout(() => {
                bot.respawn();
                bot.chat('/home'); 
            }, 5000);
        });
    },

    stop: (bot) => {
        console.log("⏹️ Parando lógica modular...");
        stopAll(bot, ctx);
        Lobby.cleanup(bot);
    },

    encerrar: (bot) => {
        bot.chat('/home');
        setTimeout(() => process.exit(0), 5000);
    },

    onSurvival: (bot) => {}
};

function stopAll(bot, ctx) {
    if (!ctx) return;
    Movement.stop(bot, ctx);
    Combat.setGuard(ctx, false);
    Automation.stopAutoClick(ctx);
    if (bot.pathfinder) bot.pathfinder.setGoal(null);
    bot.clearControlStates();
}