module.exports = {
    create: (args) => {
        return {
            config: {
                dono: args.dono,
                botName: args.botName, // Agora guardamos o nome do bot aqui
                loja: args.loja || 'plasma',
                password: '***REMOVED***', 
                admins: ['WastoLord_13'],
                
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
                isCombatActive: false, // Importante para a correção do combate
                
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