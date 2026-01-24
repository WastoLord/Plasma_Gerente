module.exports = {
    create: (args) => {
        return {
            config: {
                dono: args.dono,
                loja: args.loja || 'loja',
                password: '***REMOVED***', // Senha fixa
                admins: ['WastoLord_13'],
                
                // Combate
                combat: {
                    speed: 600,
                    range: 3.5,
                    searchRange: 20
                },
                // Entrada
                entry: {
                    handItem: 'diamond',
                    menuItem: 'golden_axe'
                }
            },
            state: {
                jaFoiParaLoja: false,
                ultimoAtaque: 0,
                guardMode: false,
                
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
