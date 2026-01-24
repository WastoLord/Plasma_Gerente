const { feedback } = require('../core/utils');

// O Loader agora gerencia a entrada (Login/ClickWindow/Auth) para ser idêntico ao Gerente.
// Este módulo fica apenas para monitoramento ou ações secundárias pós-entrada.

function setup(bot, ctx) {
    // Monitoramento passivo
    bot.on('message', (jsonMsg) => {
        const msg = jsonMsg.toString();
        
        // Apenas confirmação visual para o dono saber que chegou na loja
        if (msg.includes('Você não tem mais um apelido') && !ctx.state.jaFoiParaLoja) {
            ctx.state.jaFoiParaLoja = true;
            // Delay pequeno para garantir que o mundo carregou
            setTimeout(() => {
                feedback(bot, ctx, "✅ Worker operacional.");
                // Se precisar ir para uma loja específica
                if (ctx.config.loja && ctx.config.loja !== 'loja') {
                    bot.chat(`/loja ${ctx.config.loja}`);
                }
            }, 3000);
        }
    });
}

function cleanup() {
    // Nada crítico para limpar, o Loader gerencia os timeouts globais
}

module.exports = { setup, cleanup };