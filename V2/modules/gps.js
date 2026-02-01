const { pathfinder, Movements, goals: { GoalNear } } = require('mineflayer-pathfinder')

const RANGE_GOAL = 1 // Raio de distância do jogador

/**
 * @param {import('mineflayer').Bot} bot
 */
module.exports = (bot) => {
  // Carrega o plugin pathfinder dentro deste módulo para garantir que as dependências existam
  bot.loadPlugin(pathfinder)

  // Espera o bot spawnar para inicializar os movimentos (física)
  bot.once('spawn', () => {
    const defaultMove = new Movements(bot)

    bot.on('chat', (username, message) => {
      if (username === bot.username) return
      if (message !== 'come') return
      const target = bot.players[username]?.entity
      if (!target) {
        bot.chat("I don't see you !")
        return
      }
      const { x: playerX, y: playerY, z: playerZ } = target.position

      bot.pathfinder.setMovements(defaultMove)
      bot.pathfinder.setGoal(new GoalNear(playerX, playerY, playerZ, RANGE_GOAL))
      
      bot.chat(`Coming to you, ${username}!`)
    })
  })
}
