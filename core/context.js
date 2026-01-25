module.exports = {
    create: (args) => {
        return {
            config: {
                dono: args.dono,
                botName: args.botName,
                loja: args.loja || 'loja',
                password: args.password, 
                
                // SEGURANÇA: Admins globais removidos.
                // Use o comando 'suporte' para se adicionar dinamicamente.
                admins: [], 
                
                combat: {
                    speed: 600,
                    range: 3.5,
                    searchRange: 20
                },
                entry: {
                    handItem: 'diamond',
                    menuItem: 'golden_axe'
                }
            },
            state: {
                jaFoiParaLoja: false,
                ultimoAtaque: 0,
                guardMode: false,
                isCombatActive: false,
                
                elevator: {
                    active: false,
                    direction: null,
                    endTime: 0
                },
                
                autoClick: {
                    active: false,
                    interval: 1.0,
                    timer: null
                }
            }
        }
    }
}