const { feedback } = require('../core/utils');

async function equipSword(bot) {
    const heldItem = bot.inventory.slots[bot.getEquipmentDestSlot('hand')];
    if (heldItem && heldItem.name.includes('sword')) return true;

    const sword = bot.inventory.items().find(item => item.name.includes('sword'));
    if (sword) {
        try {
            await bot.equip(sword, 'hand');
            return true;
        } catch (err) {
            return false;
        }
    }
    return false; 
}

function tick(bot, ctx) {
    // Guarda (Defesa automática)
    if (!ctx.state.guardMode || !bot.entity) return;
    if (Date.now() - ctx.state.ultimoAtaque < ctx.config.combat.speed) return;

    // Alcance aumentado para 5 para pegar players lagados ou com reach
    const GUARD_RANGE = 5.0; 

    const alvo = bot.nearestEntity(e => {
        // 1. Segurança Absoluta: Ignorar Dono
        if (e.type === 'player' && e.username === ctx.config.dono) return false;
        
        // 2. Filtro de Tipo: Aceita Players e Mobs
        const isPlayer = e.type === 'player';
        const isMob = e.type === 'mob';
        
        if (!isPlayer && !isMob) return false;

        // 3. Ignorar lixo (Armor stands, drops, etc)
        const name = e.name || '';
        const ignorar = [
            'item', 'experience_orb', 'arrow', 'snowball', 'egg', 
            'armor_stand', 'boat', 'minecart', 'fishing_bobber'
        ];
        if (ignorar.includes(name)) return false;

        // 4. Distância
        return e.position.distanceTo(bot.entity.position) <= GUARD_RANGE;
    });

    if (alvo) {
        // Reativo: Olha e bate imediatamente
        bot.lookAt(alvo.position.offset(0, alvo.height * 0.6, 0), true);
        bot.attack(alvo);
        bot.swingArm();
        ctx.state.ultimoAtaque = Date.now();

        // Tenta equipar espada em paralelo
        equipSword(bot).catch(() => {});
    }
}

async function attack(bot, ctx) {
    const range = ctx.config.combat.searchRange;
    
    // Prioridade total para Players (excluindo dono)
    let target = bot.nearestEntity(e => 
        e.type === 'player' && e.username !== ctx.config.dono && 
        e.position.distanceTo(bot.entity.position) <= range
    );

    // Se não achar player, busca mob
    if (!target) {
        target = bot.nearestEntity(e => 
            e.type === 'mob' && e.name !== 'armor_stand' && 
            e.position.distanceTo(bot.entity.position) <= range
        );
    }

    if (target) {
        ctx.state.isCombatActive = true; 
        feedback(bot, ctx, `⚔️ Alvo: ${target.username || target.name || 'Desconhecido'}`);
        
        await equipSword(bot);
        
        if (!ctx.state.isCombatActive) return;
        
        if (bot.pvp) {
            bot.pvp.attack(target);
        } else {
            const attackLoop = setInterval(async () => {
                if (!ctx.state.isCombatActive || !target || !target.isValid) { 
                    clearInterval(attackLoop); 
                    return; 
                }
                await equipSword(bot); 
                bot.lookAt(target.position.offset(0, target.height, 0));
                bot.attack(target);
            }, 600);
            ctx.state.manualAttackLoop = attackLoop;
        }
    } else {
        feedback(bot, ctx, "Nenhum alvo encontrado.");
    }
}

function setGuard(ctx, enable) {
    ctx.state.guardMode = enable;
    if (!enable) ctx.state.isCombatActive = false;
}

function stop(bot, ctx) {
    if (ctx && ctx.state) {
        ctx.state.isCombatActive = false;
        ctx.state.guardMode = false;
    }
    if (bot.pvp) bot.pvp.stop();
    if (bot.pathfinder) bot.pathfinder.setGoal(null);
    if (ctx && ctx.state && ctx.state.manualAttackLoop) {
        clearInterval(ctx.state.manualAttackLoop);
        ctx.state.manualAttackLoop = null;
    }
    bot.clearControlStates();
    bot.stopDigging();
}

module.exports = { tick, attack, setGuard, stop };