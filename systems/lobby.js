const { feedback, delay } = require('../core/utils');

let loopLobby = null;

function setup(bot, ctx) {
    bot.on('message', (jsonMsg) => {
        const msg = jsonMsg.toString();
        const msgLower = msg.toLowerCase();

        // Login
        if (msg.includes('/login <senha>')) {
            feedback(bot, ctx, "🔑 Logando...");
            bot.chat(`/login ${ctx.config.password}`);
        }

        // Registro
        if (msgLower.includes('/registrar') || msgLower.includes('não foi registrado')) {
            feedback(bot, ctx, "📝 Registrando...");
            setTimeout(() => bot.chat(`/registrar ${ctx.config.password} ${ctx.config.password}`), 1500);
        }

        // Bypass [Não]
        if (jsonMsg.json) handleAuthClick(bot, ctx, jsonMsg);

        // Sucesso na entrada
        if (msg.includes('Você não tem mais um apelido') && !ctx.state.jaFoiParaLoja) {
            ctx.state.jaFoiParaLoja = true;
            stopLoop();
            feedback(bot, ctx, "🚀 Entrada confirmada! Indo para loja...");
            setTimeout(() => {
                const loja = (ctx.config.loja !== 'loja') ? ctx.config.loja : 'Plasma';
                bot.chat(`/loja ${loja}`);
            }, 5000);
        }
    });

    // Clica no servidor
    bot.on('windowOpen', (window) => {
        if (window.type === 'minecraft:inventory') return;
        const alvo = window.slots.find(i => i && i.name.includes(ctx.config.entry.menuItem));
        if (alvo) {
            feedback(bot, ctx, "Clicando no servidor...");
            bot.clickWindow(alvo.slot, 0, 0);
            setTimeout(() => {
                if (bot.currentWindow) bot.closeWindow(bot.currentWindow);
                stopLoop();
            }, 1000);
        }
    });

    startLoop(bot, ctx);
}

function cleanup() {
    stopLoop();
}

function startLoop(bot, ctx) {
    if (loopLobby) clearInterval(loopLobby);
    loopLobby = setInterval(() => {
        if (ctx.state.jaFoiParaLoja || !bot || !bot.inventory) {
            if (ctx.state.jaFoiParaLoja) clearInterval(loopLobby);
            return;
        }
        const item = bot.inventory.items().find(i => i.name.includes(ctx.config.entry.handItem));
        if (item) bot.equip(item, 'hand').then(() => bot.activateItem()).catch(()=>{});
    }, 10000);
}

function stopLoop() {
    if (loopLobby) clearInterval(loopLobby);
}

function handleAuthClick(bot, ctx, jsonMsg) {
    if (!JSON.stringify(jsonMsg).includes('clickEvent')) return;
    const scan = (obj) => {
        if (obj.clickEvent && obj.clickEvent.action === 'run_command') {
            const cmd = obj.clickEvent.value;
            const txt = (obj.text || "").toLowerCase();
            if (cmd.includes('nao') || txt.includes('não') || txt.includes('nao')) {
                setTimeout(() => {
                    feedback(bot, ctx, "🖱️ Clicando em [Não]");
                    bot.chat(cmd);
                    // Fallback
                    setTimeout(() => {
                        bot.chat(`/registrar ${ctx.config.password} ${ctx.config.password}`);
                        bot.chat(`/login ${ctx.config.password}`);
                    }, 2000);
                }, 1500);
                return true;
            }
        }
        if (obj.extra) return obj.extra.some(c => scan(c));
        return false;
    };
    scan(jsonMsg);
}

module.exports = { setup, cleanup };
