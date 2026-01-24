module.exports = {
    parse: (username, message, ctx) => {
        // Segurança: Só obedece ao Dono ou Admin
        if (username !== ctx.config.dono && !ctx.config.admins.includes(username)) {
            return null;
        }

        const cleanMsg = message.replace(/\./g, '').trim().toLowerCase();
        const parts = cleanMsg.split(' ');
        
        return {
            cmd: parts[0],
            arg: parts[1],
            originalUser: username
        };
    }
}
