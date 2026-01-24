const { goals: { GoalFollow } } = require('mineflayer-pathfinder');
const { feedback } = require('../core/utils');

function setup(bot) {
    const { Movements } = require('mineflayer-pathfinder');
    if (bot.pathfinder) {
        const mcData = require('minecraft-data')(bot.version);
        const moves = new Movements(bot, mcData);
        moves.canDig = false;
        moves.canPlaceOn = false;
        bot.pathfinder.setMovements(moves);
    }
}

function tick(bot, ctx) {
    const el = ctx.state.elevator;
    
    if (el.active) {
        // Verifica tempo limite
        if (Date.now() > el.endTime) {
            el.active = false;
            bot.clearControlStates();
            return;
        }

        // --- TRAVAMENTO DE FÍSICA ---
        // Garante que NENHUM outro sistema mova o bot
        if (bot.pathfinder) bot.pathfinder.setGoal(null);
        
        // Zera movimentos horizontais para focar no vertical
        bot.setControlState('forward', false);
        bot.setControlState('back', false);
        bot.setControlState('left', false);
        bot.setControlState('right', false);
        bot.setControlState('sprint', false);

        // Aplica força vertical
        if (el.direction === 'subir') {
            bot.setControlState('sneak', false);
            bot.setControlState('jump', true);
        } else if (el.direction === 'descer') {
            bot.setControlState('jump', false);
            bot.setControlState('sneak', true); // Shift para descer em água/escada
        }
    }
}

function startElevator(bot, ctx, dir) {
    // Para qualquer outra coisa antes de começar
    stop(bot, ctx); 
    
    ctx.state.elevator.active = true;
    ctx.state.elevator.direction = dir;
    
    // Tempos ajustados para garantir a ação completa
    const duration = dir === 'subir' ? 600 : 4000; 
    ctx.state.elevator.endTime = Date.now() + duration;
    
    const icon = dir === 'subir' ? '⬆️' : '⬇️';
    feedback(bot, ctx, `${icon} ${dir === 'subir' ? 'Subindo' : 'Descendo'}...`);
}

function follow(bot, ctx, username) {
    const target = bot.players[username]?.entity;
    if (!target) {
        feedback(bot, ctx, "Não te vejo!");
        return;
    }
    feedback(bot, ctx, "Indo...");
    bot.pathfinder.setGoal(new GoalFollow(target, 1), true);
}

function stop(bot, ctx) {
    if (bot.pathfinder) bot.pathfinder.setGoal(null);
    if (ctx && ctx.state && ctx.state.elevator) {
        ctx.state.elevator.active = false;
    }
    bot.clearControlStates();
}

module.exports = { setup, tick, startElevator, follow, stop };