const { feedback, delay } = require('../core/utils');

function startAutoClick(bot, ctx, tempo) {
    let interval = parseFloat(tempo);
    if (!interval || interval < 0.2) interval = 0.2;
    
    ctx.state.autoClick.active = true;
    feedback(bot, ctx, `🖱️ Auto-Click: ${interval}s`);

    const clickLoop = async () => {
        if (!ctx.state.autoClick.active) return;

        try {
            const bloco = bot.blockAtCursor(4);
            if (bloco) {
                bot.activateBlock(bloco).catch(()=>{});
            } else {
                bot.activateItem(); 
            }
            bot.swingArm();
        } catch(e) {}

        if (ctx.state.autoClick.active) {
            ctx.state.autoClick.timer = setTimeout(clickLoop, interval * 1000);
        }
    };
    clickLoop();
}

function stopAutoClick(ctx) {
    ctx.state.autoClick.active = false;
    if (ctx.state.autoClick.timer) clearTimeout(ctx.state.autoClick.timer);
}

function sendPix(bot, ctx) {
    bot.chat(`/pix ${ctx.config.dono} 7500`);
}

// --- DROP IDÊNTICO AO BOT_LOGIC.JS (COM MELHORIA DE BUSCA) ---
async function dropItems(bot, ctx, destinationUser) {
    let playerEntity = null;

    if (destinationUser) {
        // Tenta pegar da lista de players (padrão)
        playerEntity = bot.players[destinationUser]?.entity;

        // Se falhar, tenta buscar a entidade mais próxima com esse nome (Backup do bot antigo)
        if (!playerEntity) {
            playerEntity = bot.nearestEntity(e => e.type === 'player' && e.username === destinationUser);
        }
    }

    if (!playerEntity) {
        feedback(bot, ctx, `Não vejo você (${destinationUser}) por perto.`);
        console.log(`[Debug] Falha ao encontrar entidade para: ${destinationUser}`);
        return;
    }

    feedback(bot, ctx, "📦 Dropando...");

    try {
        await bot.lookAt(playerEntity.position.offset(0, 1.6, 0), true);
    } catch (e) {
        console.log("Erro ao olhar:", e.message);
    }

    const items = bot.inventory.items();
    for (const item of items) {
        if (item.name.includes('diamond') || item.name.includes('sword') || item.name.includes('helmet') || item.name.includes('chestplate') || item.name.includes('leggings') || item.name.includes('boots')) continue;
        
        try { 
            // Atualiza a mira a cada item para garantir precisão
            if (playerEntity) await bot.lookAt(playerEntity.position.offset(0, 1.6, 0), true);
            
            await bot.tossStack(item); 
            await bot.waitForTicks(2); 
        } catch(e){}
    }
    
    feedback(bot, ctx, "📦 Fim.");
}

module.exports = { startAutoClick, stopAutoClick, sendPix, dropItems };