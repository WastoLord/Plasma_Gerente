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
        if (Date.now() > el.endTime) {
            el.active = false;
            bot.clearControlStates();
            return;
        }
        if (bot.pathfinder) bot.pathfinder.setGoal(null);
        
        if (el.direction === 'subir') {
            bot.setControlState('sneak', false);
            bot.setControlState('jump', true);
        } else {
            bot.setControlState('jump', false);
            bot.setControlState('sneak', true);
        }
    }
}

function startElevator(bot, ctx, dir) {
    ctx.state.elevator.active = true;
    ctx.state.elevator.direction = dir;
    const duration = dir === 'subir' ? 1500 : 4000;
    ctx.state.elevator.endTime = Date.now() + duration;
    
    bot.clearControlStates();
    feedback(bot, ctx, dir === 'subir' ? '⬆️ Subindo' : '⬇️ Descendo');
}

function follow(bot, ctx, username) {
    const target = bot.players[username]?.entity;
    if (!target) {
        feedback(bot, ctx, "Não te vejo!");
        return;
    }
    feedback(bot, ctx, "Indo!");
    bot.pathfinder.setGoal(new GoalFollow(target, 1), true);
}

function stop(bot, ctx) {
    if (bot.pathfinder) bot.pathfinder.setGoal(null);
    ctx.state.elevator.active = false;
    bot.clearControlStates();
}

module.exports = { setup, tick, startElevator, follow, stop };
