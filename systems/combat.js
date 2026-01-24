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
    return false; // Não tem espada, mas não faz mal
}

function tick(bot, ctx) {
    // Guarda (Defesa automática)
    if (!ctx.state.guardMode || !bot.entity) return;
    if (Date.now() - ctx.state.ultimoAtaque < ctx.config.combat.speed) return;

    const alvo = bot.nearestEntity(e => {
        if (e.type === 'player' && e.username === ctx.config.dono) return false;
        if (e.type === 'mob' && e.name === 'armor_stand') return false;
        if (e.type === 'object' || e.type === 'orb' || e.type === 'global') return false;
        return e.position.distanceTo(bot.entity.position) <= ctx.config.combat.range;
    });

    if (alvo) {
        // Na guarda, ele também tenta pegar a espada, mas bate de qualquer jeito se falhar
        equipSword(bot).then(() => {
            if (!ctx.state.guardMode) return; 
            bot.lookAt(alvo.position.offset(0, alvo.height * 0.6, 0), true);
            bot.attack(alvo);
            bot.swingArm();
        });
        ctx.state.ultimoAtaque = Date.now();
    }
}

async function attack(bot, ctx) {
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
        // --- TRAVA DE ESTADO ---
        ctx.state.isCombatActive = true; 
        
        feedback(bot, ctx, `⚔️ Alvo: ${target.username || target.name || 'Desconhecido'}`);
        
        // Tenta equipar, mas ignora se falhar (false) e segue para o ataque
        await equipSword(bot);
        
        // Se mandou parar ENQUANTO trocava de item, cancela aqui
        if (!ctx.state.isCombatActive) return;
        
        if (bot.pvp) {
            bot.pvp.attack(target);
        } else {
            // Fallback manual se o plugin falhar
            const attackLoop = setInterval(async () => {
                if (!ctx.state.isCombatActive || !target || !target.isValid) { 
                    clearInterval(attackLoop); 
                    return; 
                }
                // Tenta equipar de novo a cada hit (caso pegue drop no chão)
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
    // 1. DESLIGA A TRAVA DE ESTADO
    if (ctx && ctx.state) {
        ctx.state.isCombatActive = false;
        ctx.state.guardMode = false;
    }

    // 2. Para plugin PVP
    if (bot.pvp) {
        bot.pvp.stop();
    }
    
    // 3. Para Pathfinder
    if (bot.pathfinder) {
        bot.pathfinder.setGoal(null);
    }

    // 4. Para Loop manual
    if (ctx && ctx.state && ctx.state.manualAttackLoop) {
        clearInterval(ctx.state.manualAttackLoop);
        ctx.state.manualAttackLoop = null;
    }

    // 5. Limpeza física
    bot.clearControlStates();
    bot.stopDigging();
}

module.exports = { tick, attack, setGuard, stop };