const monsters = {
  // prettier-ignore
  monster_Names(lv) {
    const names_a = [
      '影魅狸奴', '幽谷灵蛇', '雾隐狐仙', '松间灵猴', '月影蝠妖',
      '山涧蛟童', '林涧鹿灵', '岩隙石精', '风鸣鹤怪', '翠竹蛙仙'
    ]
    const names_b = [
      '青龙啸天', '白虎破晓', '朱雀焚翼', '玄武镇海', '麒麟踏瑞',
      '凤凰涅槃', '毕方炽焰', '貔貅吞金', '白泽知世', '狻猊御火'
    ]
    const names_c = [
      '伏羲天帝', '女娲圣母', '昊天玉皇', '太上老君', '东华帝君',
      '西王母后', '神农炎帝', '轩辕黄帝', '瑶姬仙子', '真武大帝'
    ]
    const names_d = [
      '混沌始元尊', '乾坤造物主', '宇宙创生神', '万灵始祖皇', '鸿蒙创世者',
      '无极造化君', '太虚衍化神', '元始天尊祖', '虚空造物圣', '界域开辟者'
    ]
    if (lv >= 1 && lv <= 19) {
      return names_a[Math.floor(Math.random() * names_a.length)]
    } else if (lv >= 20 && lv <= 49) {
      return names_b[Math.floor(Math.random() * names_b.length)]
    } else if (lv >= 50 && lv <= 100) {
      return names_c[Math.floor(Math.random() * names_c.length)]
    } else {
      return names_d[Math.floor(Math.random() * names_c.length)]
    }
  },
  monster_Attack(lv, player) {
    const base = lv <= 144 ? this.getRandomInt(50, 150) * lv : this.getRandomInt(10000, 50000) * lv
    return this.adjustByPlayer(base, player?.attack, 0.8, 2.2)
  },
  monster_Health(lv, player) {
    const base = lv <= 144 ? this.getRandomInt(100, 500) * lv : this.getRandomInt(10000, 50000) * lv
    const attackScale = player?.attack ? player.attack * 8 : 0
    const target = Math.max(player?.maxHealth || player?.health || 0, attackScale)
    return this.adjustByPlayer(base, target, 2.0, 8.0)
  },
  monster_Defense(lv, player) {
    const base = lv <= 144 ? this.getRandomInt(1, 15) * lv : this.getRandomInt(500, 1000) * lv
    return this.adjustByPlayer(base, player?.defense, 0.8, 2.0)
  },
  monster_Criticalhitrate(lv, player) {
    const base = lv <= 144 ? this.getRandomFloatInRange(0.001, 0.01) : this.getRandomFloatInRange(0.1, 0.75)
    return this.adjustRateByPlayer(base, player?.critical)
  },
  monster_DodgeRate(lv, player) {
    const base = lv <= 144 ? this.getRandomFloatInRange(0.001, 0.01) : this.getRandomFloatInRange(0.1, 0.75)
    return this.adjustRateByPlayer(base, player?.dodge)
  },
  adjustByPlayer(base, playerValue, minMultiplier = 0.7, maxMultiplier = 1.3) {
    if (!playerValue || !base) return base
    const ratio = playerValue / base
    const clamped = Math.min(maxMultiplier, Math.max(minMultiplier, ratio))
    return Math.max(1, Math.floor(base * clamped))
  },
  adjustRateByPlayer(base, playerValue) {
    if (typeof playerValue !== 'number') return base
    const mixed = base + (playerValue - base) * 0.3
    return Math.min(0.9, Math.max(0.001, mixed))
  },
  getRandomInt(min, max) {
    min = Math.ceil(min)
    max = Math.floor(max)
    return Math.floor(Math.random() * (max - min + 1)) + min
  },
  getRandomFloatInRange(min, max) {
    return Math.random() * (max - min) + min
  }
}
export default monsters
