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
            
            // Garante que solta o shift ao terminar
            enviarPacoteSneak(bot, false);
            
            feedback(bot, ctx, "Elevador finalizado.");
            return;
        }

        // TRAVAMENTO DE FÍSICA
        if (bot.pathfinder) bot.pathfinder.setGoal(null);
        
        bot.setControlState('forward', false);
        bot.setControlState('back', false);
        bot.setControlState('left', false);
        bot.setControlState('right', false);
        bot.setControlState('sprint', false);

        if (el.direction === 'subir') {
            bot.setControlState('sneak', false);
            bot.setControlState('jump', true);
        } else if (el.direction === 'descer') {
            bot.setControlState('jump', false);
            
            // --- MÉTODO ALTERNATIVO: INJEÇÃO DE PACOTES ---
            // Em vez de confiar apenas na física do bot, enviamos o pacote
            // de ação "Start Sneaking" repetidamente.
            
            // Mantém o estado lógico (backup)
            bot.setControlState('sneak', true);
            
            // Envia o pacote "Estou Agachando" (Action ID 0)
            enviarPacoteSneak(bot, true);
        }
    }
}

// Função auxiliar para enviar pacotes brutos
function enviarPacoteSneak(bot, ativado) {
    try {
        // Action ID 0 = Começar a agachar
        // Action ID 1 = Parar de agachar
        const acao = ativado ? 0 : 1;
        
        bot._client.write('entity_action', {
            entityId: bot.entity.id,
            actionId: acao, 
            jumpBoost: 0
        });
    } catch (e) {
        // Ignora erros de desconexão
    }
}

function startElevator(bot, ctx, dir) {
    stop(bot, ctx); 
    
    ctx.state.elevator.active = true;
    ctx.state.elevator.direction = dir;
    
    const duration = dir === 'subir' ? 500 : 3000; 
    ctx.state.elevator.endTime = Date.now() + duration;
    
    const icon = dir === 'subir' ? '⬆️' : '⬇️';
    feedback(bot, ctx, `${icon} ${dir === 'subir' ? 'Subindo' : 'Descendo'}...`);

    if (dir === 'descer') {
        // Envia pacote imediato ao iniciar o comando
        enviarPacoteSneak(bot, true);
    }
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
    
    // Força o envio do pacote de "Levantar" ao parar
    enviarPacoteSneak(bot, false);
}

module.exports = { setup, tick, startElevator, follow, stop };