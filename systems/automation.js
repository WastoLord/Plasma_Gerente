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

// --- DROP OTIMIZADO ---
async function dropItems(bot, ctx, destinationUser) {
    // 1. Localizar o jogador (Lógica robusta)
    let playerEntity = null;

    if (destinationUser) {
        playerEntity = bot.players[destinationUser]?.entity;
        // Backup: Busca física se a lista de tab falhar
        if (!playerEntity) {
            playerEntity = bot.nearestEntity(e => e.type === 'player' && e.username === destinationUser);
        }
    }

    if (!playerEntity) {
        feedback(bot, ctx, `Não vejo você (${destinationUser}) para dropar.`);
        return;
    }

    feedback(bot, ctx, "📦 Dropando...");

    // 2. Olhar para o jogador (APENAS UMA VEZ no início, igual ao antigo)
    try {
        // true no final força o envio imediato do pacote de rotação
        await bot.lookAt(playerEntity.position.offset(0, 1.6, 0), true);
    } catch (e) {
        console.log("Erro ao mirar:", e.message);
    }

    // 3. Loop de itens
    const items = bot.inventory.items();
    console.log(`[Debug] Itens encontrados para analisar: ${items.length}`);

    for (const item of items) {
        // Lista de proteção
        if (item.name.includes('diamond') || item.name.includes('sword') || item.name.includes('helmet') || item.name.includes('chestplate') || item.name.includes('leggings') || item.name.includes('boots')) continue;
        
        try { 
            // LÓGICA PURA DO BOT ANTIGO: Apenas joga e espera
            // Removemos o 'bot.lookAt' daqui de dentro para não travar o drop
            await bot.tossStack(item); 
            await bot.waitForTicks(2); 
        } catch(e){
            console.log(`[Erro Drop] Falha ao jogar ${item.name}: ${e.message}`);
        }
    }
    
    feedback(bot, ctx, "📦 Fim.");
}

module.exports = { startAutoClick, stopAutoClick, sendPix, dropItems };