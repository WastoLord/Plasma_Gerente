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

        if (!bot.pvp) bot.loadPlugin(pvp);

        // Inicializa
        Lobby.setup(bot, ctx);
        Movement.setup(bot);

        // Loop Físico
        bot.on('physicsTick', () => {
            if (ctx.state.elevator.active) {
                Movement.tick(bot, ctx);
                return;
            }
            Combat.tick(bot, ctx);
            Health.tick(bot);
        });

        // Comandos (Chat + Tell)
        const handleCmd = (user, msg) => {
            const command = Commands.parse(user, msg, ctx);
            if (!command) return;

            const { cmd, arg } = command;
            Utils.feedback(bot, ctx, `CMD: ${cmd}`);

            if (cmd === 'parar') {
                stopAll(bot, ctx);
                Utils.feedback(bot, ctx, "Parado.");
            }
            // Movimento
            else if (cmd === 'vem') { stopAll(bot, ctx); Movement.follow(bot, ctx, user); }
            else if (cmd === 'subir') Movement.startElevator(bot, ctx, 'subir', (m) => Utils.feedback(bot, ctx, m));
            else if (cmd === 'descer') Movement.startElevator(bot, ctx, 'descer', (m) => Utils.feedback(bot, ctx, m));

            // Combate
            else if (cmd === 'guarda') { stopAll(bot, ctx); Combat.setGuard(ctx, true); Utils.feedback(bot, ctx, "🛡️ Guarda"); }
            else if (cmd === 'ataque') { stopAll(bot, ctx); Combat.attack(bot, ctx, (m) => Utils.feedback(bot, ctx, m)); }
            else if (cmd === 'paz') { stopAll(bot, ctx); Utils.feedback(bot, ctx, "🏳️ Paz"); }

            // Automação
            else if (cmd === 'usar') Automation.startAutoClick(bot, ctx, arg, (m) => Utils.feedback(bot, ctx, m));
            else if (cmd === 'itens') Automation.dropItems(bot, ctx);
            else if (cmd === 'pix') Automation.sendPix(bot, ctx);
            else if (cmd === 'loja') bot.chat(`/loja ${arg || 'loja'}`);
            
            else if (cmd === 'help') Utils.feedback(bot, ctx, "CMD: vem, parar, subir, descer, guarda, ataque, usar, itens, pix, loja");
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
            setTimeout(() => bot.respawn(), 5000);
        });
    },

    stop: (bot) => {
        console.log("⏹️ Parando lógica modular...");
        stopAll(bot, ctx);
        Lobby.cleanup(bot);
        bot.removeAllListeners(); // Limpeza bruta para garantir
    },

    encerrar: (bot) => {
        bot.chat('/home');
        setTimeout(() => process.exit(0), 5000);
    }
};

function stopAll(bot, ctx) {
    if (!ctx) return;
    Movement.stop(bot, ctx);
    Combat.setGuard(ctx, false);
    Automation.stopAutoClick(ctx);
    if (bot.pathfinder) bot.pathfinder.setGoal(null);
    bot.clearControlStates();
}
