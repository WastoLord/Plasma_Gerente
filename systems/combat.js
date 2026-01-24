const { feedback } = require('../core/utils');

function tick(bot, ctx) {
    if (!ctx.state.guardMode || !bot.entity) return;
    if (Date.now() - ctx.state.ultimoAtaque < ctx.config.combat.speed) return;

    const alvo = bot.nearestEntity(e => {
        if (e.type === 'player' && e.username === ctx.config.dono) return false;
        if (e.type === 'mob' && e.name === 'armor_stand') return false;
        return e.position.distanceTo(bot.entity.position) <= ctx.config.combat.range;
    });

    if (alvo) {
        bot.lookAt(alvo.position.offset(0, alvo.height * 0.6, 0), true);
        bot.attack(alvo);
        bot.swingArm();
        ctx.state.ultimoAtaque = Date.now();
    }
}

function attack(bot, ctx) {
    const range = ctx.config.combat.searchRange;
    
    let target = bot.nearestEntity(e => 
        e.type === 'player' && e.username !== ctx.config.dono && 
        e.position.distanceTo(bot.entity.position) <= range
    );

    if (!target) {
        target = bot.nearestEntity(e => 
            e.type === 'mob' && e.mobType !== 'Armor Stand' && 
            e.position.distanceTo(bot.entity.position) <= range
        );
    }

    if (target) {
        feedback(bot, ctx, "⚔️ Atacando!");
        if (bot.pvp) bot.pvp.attack(target);
        else bot.attack(target);
    } else {
        feedback(bot, ctx, "Nenhum alvo por perto.");
    }
}

function setGuard(ctx, enable) {
    ctx.state.guardMode = enable;
}

module.exports = { tick, attack, setGuard };
