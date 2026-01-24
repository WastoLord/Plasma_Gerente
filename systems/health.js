function tick(bot) {
    if (!bot.entity) return;
    if (bot.food < 16 && !bot.usingHeldItem) {
        const comida = bot.inventory.items().find(i => i.name.includes('cooked_beef'));
        if (comida) bot.equip(comida, 'hand').then(() => bot.consume()).catch(()=>{});
    }
}
module.exports = { tick };
