const { feedback } = require('../core/utils');

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
                bot.setControlState('right', true);
                setTimeout(() => bot.setControlState('right', false), 50);
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

async function dropItems(bot, ctx) {
    feedback(bot, ctx, "📦 Dropando...");
    const items = bot.inventory.items();
    for (const item of items) {
        if (item.name.includes('diamond') || item.name.includes('sword')) continue;
        try { await bot.tossStack(item); await bot.waitForTicks(2); } catch(e){}
    }
}

module.exports = { startAutoClick, stopAutoClick, sendPix, dropItems };
