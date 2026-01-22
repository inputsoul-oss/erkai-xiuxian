const monsters = {
  // prettier-ignore
  monster_Names(lv) {
    const names_a = [
      '影魅狸奴', '幽谷灵蛇', '雾隐狐仙', '松间灵猴', '月影蝠妖',
      '山涧蛟童', '林涧鹿灵', '岩隙石精', '风鸣鹤灵', '翠竹蛙仙'
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
      '混沌始元尊', '乾坤造物主', '宇宙创生神', '万灵始祖帝', '鸿蒙创世者',
      '无极造化君', '太虚衍化神', '元始天尊', '虚空造物君', '界域开辟者'
    ]
    if (lv >= 1 && lv <= 19) {
      return names_a[Math.floor(Math.random() * names_a.length)]
    } else if (lv >= 20 && lv <= 49) {
      return names_b[Math.floor(Math.random() * names_b.length)]
    } else if (lv >= 50 && lv <= 100) {
      return names_c[Math.floor(Math.random() * names_c.length)]
    }
    return names_d[Math.floor(Math.random() * names_d.length)]
  },
  // 攻击基础值随等级缩放，再向玩家攻击做调整。
  monster_Attack(lv, player) {
    if (player?.hellMode && player?.attack) return this.scaleHellValue(player.attack)
    const base = lv <= 144 ? this.getRandomInt(50, 150) * lv : this.getRandomInt(10000, 50000) * lv
    return this.adjustByPlayer(base, player?.attack, 0.8, 2.2)
  },
  // 生命基础值随等级缩放，再向玩家血量/攻击做调整，避免一击秒杀。
  monster_Health(lv, player) {
    if (player?.hellMode) {
      const base = player?.maxHealth || player?.health || 0
      if (base) return this.scaleHellValue(base)
    }
    const base = lv <= 144 ? this.getRandomInt(100, 500) * lv : this.getRandomInt(10000, 50000) * lv
    const attackScale = player?.attack ? player.attack * 8 : 0
    const target = Math.max(player?.maxHealth || player?.health || 0, attackScale)
    return this.adjustByPlayer(base, target, 2.0, 8.0)
  },
  // 防御基础值随等级缩放，再向玩家防御做调整。
  monster_Defense(lv, player) {
    if (player?.hellMode && player?.defense) return this.scaleHellDefenseValue(player.defense)
    const base = lv <= 144 ? this.getRandomInt(1, 15) * lv : this.getRandomInt(500, 1000) * lv
    return this.adjustByPlayer(base, player?.defense, 0.8, 2.0)
  },
  // 暴击率向玩家暴击靠拢并做范围限制。
  monster_Criticalhitrate(lv, player) {
    if (player?.hellMode && typeof player?.critical === 'number') return this.scaleHellRate(player.critical)
    const base = lv <= 144 ? this.getRandomFloatInRange(0.001, 0.01) : this.getRandomFloatInRange(0.1, 0.75)
    return this.adjustRateByPlayer(base, player?.critical)
  },
  // 闪避率向玩家闪避靠拢并做范围限制。
  monster_DodgeRate(lv, player) {
    if (player?.hellMode && typeof player?.dodge === 'number') {
      return Math.min(0.5, this.scaleHellRate(player.dodge))
    }
    const base = lv <= 144 ? this.getRandomFloatInRange(0.001, 0.01) : this.getRandomFloatInRange(0.1, 0.75)
    return this.adjustRateByPlayer(base, player?.dodge)
  },
  // 地狱模式：将基础值放大到玩家当前值的 10~50 倍。
  scaleHellValue(value) {
    return Math.max(1, Math.floor(value * this.getRandomFloatInRange(3, 8)))
  },
  // 地狱模式：降低防御基础值的放大区间。
  scaleHellDefenseValue(value) {
    return Math.max(1, Math.floor(value * this.getRandomFloatInRange(2, 6)))
  },
  // 地狱模式：将概率放大后限制在合理范围内。
  scaleHellRate(rate) {
    return Math.min(0.6, Math.max(0.01, rate * this.getRandomFloatInRange(2, 6)))
  },
  // 用玩家属性调整基础值，并限制倍率区间，防止波动过大。
  adjustByPlayer(base, playerValue, minMultiplier = 0.7, maxMultiplier = 1.3) {
    if (!playerValue || !base) return base
    const ratio = playerValue / base
    const clamped = Math.min(maxMultiplier, Math.max(minMultiplier, ratio))
    return Math.max(1, Math.floor(base * clamped))
  },
  // 将概率向玩家概率靠拢，并限制在安全范围内。
  adjustRateByPlayer(base, playerValue) {
    if (typeof playerValue !== 'number') return base
    const mixed = base + (playerValue - base) * 0.3
    return Math.min(0.9, Math.max(0.001, mixed))
  },
  // 生成包含上下限的随机整数。
  getRandomInt(min, max) {
    min = Math.ceil(min)
    max = Math.floor(max)
    return Math.floor(Math.random() * (max - min + 1)) + min
  },
  // 生成[min, max)区间的随机浮点数。
  getRandomFloatInRange(min, max) {
    return Math.random() * (max - min) + min
  }
}
export default monsters
