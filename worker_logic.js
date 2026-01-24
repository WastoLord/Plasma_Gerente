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
let _onPhysicsTick = null;
let _onChat = null;
let _onMessage = null;
let _onDeath = null;

module.exports = {
    start: (bot, args) => {
        ctx = Context.create(args);
        // Inicializa flag de combate no contexto se não existir
        if (!ctx.state.isCombatActive) ctx.state.isCombatActive = false;
        
        console.log(`▶️ Worker Modular Ativo. Dono: ${ctx.config.dono}`);

        if (!bot.pvp) bot.loadPlugin(pvp);

        Lobby.setup(bot, ctx);
        Movement.setup(bot);

        this.onSurvival = (botInstance) => {
            console.log("🌲 Modo Survival Ativado.");
        };

        // --- LISTENERS ---
        _onPhysicsTick = () => {
            // Se o elevador está ativo, ele tem prioridade TOTAL sobre combate
            if (ctx.state.elevator.active) {
                Movement.tick(bot, ctx);
                return; 
            }
            Combat.tick(bot, ctx);
            Health.tick(bot);
        };

        _onChat = (user, message) => handleCmd(bot, user, message);
        
        _onMessage = (jsonMsg) => {
            const msg = jsonMsg.toString();
            if (msg.includes('[Combate]')) return;

            const REGEX_CHAT = /[:\s]([a-zA-Z0-9_]+): (.+)/;
            const REGEX_TELL = /\[Privado\] Mensagem de (?:\[.*?\] )?([a-zA-Z0-9_]+): (.+)/i;

            let match = msg.match(REGEX_TELL) || msg.match(REGEX_CHAT);
            if (match) handleCmd(bot, match[1], match[2]);
        };

        _onDeath = () => {
            Utils.feedback(bot, ctx, "💀 Morri!");
            stopAll(bot, ctx);
            setTimeout(() => {
                bot.respawn();
                bot.chat('/home');
            }, 5000);
        };

        bot.on('physicsTick', _onPhysicsTick);
        bot.on('chat', _onChat);
        bot.on('message', _onMessage);
        bot.on('death', _onDeath);
    },

    stop: (bot) => {
        console.log("⏹️ Limpando listeners...");
        if (_onPhysicsTick) bot.removeListener('physicsTick', _onPhysicsTick);
        if (_onChat) bot.removeListener('chat', _onChat);
        if (_onMessage) bot.removeListener('message', _onMessage);
        if (_onDeath) bot.removeListener('death', _onDeath);

        stopAll(bot, ctx);
        Lobby.cleanup(bot);
    },

    encerrar: (bot) => {
        bot.chat('/home');
        setTimeout(() => process.exit(0), 5000);
    },

    onSurvival: (bot) => {}
};

function handleCmd(bot, user, msg) {
    const command = Commands.parse(user, msg, ctx);
    if (!command) return;

    const { cmd, arg } = command;

    // COMANDOS
    if (cmd === 'parar' || cmd === 'paz') {
        stopAll(bot, ctx);
        Utils.feedback(bot, ctx, "🏳️ Parado (Comandos Limpos).");
    }
    else if (cmd === 'help' || cmd === 'ajuda') {
        Utils.feedback(bot, ctx, "LISTA: vem, parar, subir, descer, guarda, ataque, usar <tempo>, itens, pix, loja");
    }
    else if (cmd === 'vem') { 
        stopAll(bot, ctx); 
        Movement.follow(bot, ctx, user); 
    }
    else if (cmd === 'subir') {
        stopAll(bot, ctx); 
        Movement.startElevator(bot, ctx, 'subir', (m) => Utils.feedback(bot, ctx, m));
    }
    else if (cmd === 'descer') {
        stopAll(bot, ctx); 
        Movement.startElevator(bot, ctx, 'descer', (m) => Utils.feedback(bot, ctx, m));
    }
    else if (cmd === 'guarda') { 
        stopAll(bot, ctx); 
        Combat.setGuard(ctx, true); 
        Utils.feedback(bot, ctx, "🛡️ Guarda Ativa"); 
    }
    else if (cmd === 'ataque') { 
        stopAll(bot, ctx); 
        Combat.attack(bot, ctx, (m) => Utils.feedback(bot, ctx, m)); 
    }
    else if (cmd === 'usar') Automation.startAutoClick(bot, ctx, arg, (m) => Utils.feedback(bot, ctx, m));
    else if (cmd === 'itens') Automation.dropItems(bot, ctx);
    else if (cmd === 'pix') Automation.sendPix(bot, ctx);
    else if (cmd === 'loja') bot.chat(`/loja ${arg || 'plasma'}`);
}

function stopAll(bot, ctx) {
    if (!ctx) return;
    
    Movement.stop(bot, ctx);
    Combat.setGuard(ctx, false);
    // Este stop agora limpa a flag isCombatActive
    Combat.stop(bot, ctx); 
    Automation.stopAutoClick(ctx);
    
    if (bot.pathfinder) bot.pathfinder.setGoal(null);
    bot.clearControlStates();
}