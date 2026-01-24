const { feedback } = require('../core/utils');

function setup(bot, ctx) {
    bot.on('message', (jsonMsg) => {
        const msg = jsonMsg.toString();
        
        // Apenas reporta sucesso, não tenta mais executar comandos de teleporte
        // O Loader já cuidou disso na transição do clique na bússola.
        if (msg.includes('Você não tem mais um apelido') && !ctx.state.jaFoiParaLoja) {
            ctx.state.jaFoiParaLoja = true;
            setTimeout(() => {
                feedback(bot, ctx, "✅ Worker operacional e sincronizado.");
            }, 3000);
        }
    });
}

function cleanup() {}

module.exports = { setup, cleanup };