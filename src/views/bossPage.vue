<template>
  <div class="cultivate">
    <div class="boss">
      <div class="boss-box">
        <span class="el-tag el-tag--warning" @click="openBossInfo">{{ store.boss.name }}</span>
        <el-alert class="desc" :title="store.boss.desc" :closable="false" type="error" />
      </div>
    </div>
    <div class="storyText">
      <div class="storyText-box">
        <el-scrollbar ref="scrollbar" always>
          <p class="fighting" v-if="isFighting" v-text="`${guashaRounds}回合 / 50回合`" />
          <p v-for="(item, index) in texts" :key="index" v-html="item" @click="openEquipmentInfo(equipmentInfo)" />
        </el-scrollbar>
      </div>
    </div>
    <div class="actions">
      <el-button @click="startFightBoss" :disabled="isEnd">发起战斗</el-button>
      <el-button @click="router.push('/home')">回家疗伤</el-button>
    </div>
    <div class="boss-cheat">
      <el-autocomplete
        v-model="bossCheatCode"
        :fetch-suggestions="queryBossCheats"
        placeholder="输入作弊码"
        clearable
      />
      <el-button type="primary" @click="applyBossCheat">激活</el-button>
    </div>
  </div>
</template>

<script setup>
  import boss from '@/plugins/boss'
  import equip from '@/plugins/equip'
  import { useRouter } from 'vue-router'
  import { ref, onUnmounted, onMounted } from 'vue'
  import { useMainStore } from '@/plugins/store'
  import { ElMessageBox } from 'element-plus'
  import {
    maxLv,
    levelNames,
    formatNumberToChineseUnit,
    genre,
    levels,
    smoothScrollToBottom,
    gameNotifys
  } from '@/plugins/game'
  import { applyAiDifficulty } from '@/plugins/aiDifficulty'

  const router = useRouter()
  const store = useMainStore()
  const isEnd = ref(false)
  const texts = ref([])
  const player = ref(store.player)
  const timerIds = ref([])
  const currency = ref(boss.getRandomInt(1, 10))
  const isFighting = ref(false)
  const startFight = ref(false)
  const isequipment = ref(false)
  const guashaRounds = ref(50)
  const equipmentInfo = ref({})
  const scrollbar = ref(null)
  const bossCheatCode = ref('')

  const normalizeCheatCode = code => code.replace(/[\s\u200B-\u200D\uFEFF]/g, '')
  const bossCheatOptions = ['Seven-BossWin', 'Seven-BossInfinite']
  const queryBossCheats = (query, cb) => {
    const q = normalizeCheatCode(query)
    if (!q.startsWith('Seven')) return cb([])
    cb(bossCheatOptions.filter(item => item.includes(q)).map(item => ({ value: item })))
  }

  const ensureCheats = () => {
    if (!player.value.cheats) {
      player.value.cheats = {
        resources: {},
        battle: { godMode: false, oneHit: false, crit100: false, dodge100: false },
        explore: { forceEncounter: false, forceNoEncounter: false, forceTopDrop: false },
        growth: {},
        backpack: {},
        pet: {},
        boss: { autoWin: false, infiniteTimes: false },
        games: { alwaysWin: false, checkinMakeup: false }
      }
    }
  }

  const ensureAiDifficulty = () => {
    if (!player.value.aiDifficulty) {
      player.value.aiDifficulty = {
        enabled: false,
        baseUrl: '',
        apiKey: '',
        model: '',
        applyTo: { explore: true, boss: true, endless: true }
      }
    }
  }

  const applyAiDifficultyToBoss = async baseBoss => {
    try {
      ensureAiDifficulty()
      return await applyAiDifficulty({
        player: player.value,
        monster: baseBoss,
        mode: 'boss',
        config: player.value.aiDifficulty
      })
    } catch (error) {
      return baseBoss
    }
  }

  const applyBossCheat = () => {
    ensureCheats()
    if (!player.value.cheatsUnlocked) {
      gameNotifys({ title: '提示', message: '请先在主页输入 Iamuseless 解锁作弊码。' })
      return
    }
    const code = normalizeCheatCode(bossCheatCode.value)
    const cheats = player.value.cheats.boss
    let desc = ''
    switch (code) {
      case 'Seven-BossWin':
        cheats.autoWin = !cheats.autoWin
        desc = cheats.autoWin ? 'BOSS 一键击败开启' : 'BOSS 一键击败关闭'
        break
      case 'Seven-BossInfinite':
        cheats.infiniteTimes = !cheats.infiniteTimes
        desc = cheats.infiniteTimes ? 'BOSS 无限次数开启' : 'BOSS 无限次数关闭'
        break
      default:
        gameNotifys({ title: '提示', message: '作弊码无效' })
        return
    }
    gameNotifys({ title: '提示', message: `作弊码生效：${desc}` })
  }

  const scaleHellBoss = bossData => {
    if (!player.value.hellMode) return bossData
    const multiplier = (min, max) => Math.random() * (max - min) + min
    const baseHealth = player.value.maxHealth || player.value.health || 1
    const baseAttack = player.value.attack || 1
    const baseDefense = player.value.defense || 1
    const health = Math.floor(baseHealth * multiplier(10, 50))
    const attack = Math.floor(baseAttack * multiplier(10, 50))
    const defense = Math.floor(baseDefense * multiplier(10, 50))
    const dodge = Math.min(0.5, Math.max(0.01, (player.value.dodge || 0.01) * multiplier(10, 50)))
    const critical = Math.min(0.9, Math.max(0.01, (player.value.critical || 0.01) * multiplier(10, 50)))
    return {
      ...bossData,
      health,
      maxhealth: health,
      attack,
      defense,
      dodge,
      critical
    }
  }

  const startFightBoss = () => {
    if (isEnd.value) return
    isEnd.value = true
    const zs = player.value.reincarnation * 10
    const time = zs >= 200 ? 100 : 300 - zs
    const timerId = setInterval(() => {
      fightBoss()
      const element = scrollbar.value?.wrapRef
      const observer = new MutationObserver(() => {
        smoothScrollToBottom(element)
      })
      observer.observe(element, {
        childList: true,
        subtree: true
      })
    }, time)
    timerIds.value.push(timerId)
  }

  const stopFightBoss = () => {
    timerIds.value.forEach(id => clearInterval(id))
    timerIds.value = []
  }

  const openBossInfo = () => {
    const info = store.boss
    ElMessageBox.confirm('', info.name, {
      center: true,
      message: `<div class="monsterinfo">
      <div class="monsterinfo-box">
      <p>境界: ${levelNames(info.level)}</p>
      <p>基础等级: ${info.level}</p>
      <p>气血上限: ${formatNumberToChineseUnit(info.maxhealth)}</p>
      <p>气血: ${formatNumberToChineseUnit(info.health)}</p>
      <p>攻击: ${formatNumberToChineseUnit(info.attack)}</p>
      <p>防御: ${formatNumberToChineseUnit(info.defense)}</p>
      <p>闪避率: ${info.dodge > 0 ? (info.dodge * 100 > 100 ? 100 : (info.dodge * 100).toFixed(2)) : 0}%</p>
      <p>暴击率: ${info.critical > 0 ? (info.critical * 100 > 100 ? 100 : (info.critical * 100).toFixed(2)) : 0}%</p>
      <p>评分: ${formatNumberToChineseUnit(
        equip.calculateEquipmentScore(info.dodge, info.attack, info.health, info.critical, info.defense)
      )}</p>
      <p>鸿蒙石掉落: ${currency.value}枚</p>
      <p>掉落率: 100%</p>
      </div>
    </div>`,
      showCancelButton: false,
      confirmButtonText: '知道了',
      dangerouslyUseHTMLString: true
    }).catch(() => {})
  }

  const fightBoss = () => {
    ensureCheats()
    const battleCheats = player.value.cheats.battle
    const bossCheats = player.value.cheats.boss

    if (player.value.level < maxLv) {
      isEnd.value = true
      stopFightBoss()
      texts.value.push(`你的境界未达到${levelNames(maxLv)}，${store.boss.name}拒绝与你战斗。`)
      return
    }

    if ((store.boss.health <= 0 || !store.boss.health) && !bossCheats.autoWin && !player.value.hellMode) {
      texts.value.push('BOSS刷新时间未到。')
      return
    }

    isFighting.value = true
    if (bossCheats.autoWin) store.boss.health = 0

    const monsterAttack = store.boss.attack
    const playerDefense = player.value.defense
    let monsterHarm = Math.max(0, Math.floor(monsterAttack - playerDefense))
    monsterHarm = monsterHarm <= 1 ? 1 : monsterHarm

    const playerAttack = player.value.attack
    const monsterDefense = store.boss.defense
    let playerHarm = Math.max(0, Math.floor(playerAttack - monsterDefense))
    playerHarm = playerHarm <= 1 ? 1 : playerHarm

    let isMCritical = false
    let isCritical = false

    const isPlayerHit = Math.random() > store.boss.dodge
    const isBHit = battleCheats.dodge100 ? false : Math.random() > player.value.dodge

    if (Math.random() < store.boss.critical) {
      monsterHarm *= 2
      isMCritical = true
    }

    if (Math.random() < (battleCheats.crit100 ? 1 : player.value.critical)) {
      playerHarm *= 1.5
      isCritical = true
    }

    if (battleCheats.godMode) monsterHarm = 0
    if (isBHit) player.value.health -= monsterHarm
    if (isPlayerHit) store.boss.health -= playerHarm
    if (battleCheats.oneHit) store.boss.health = 0

    player.value.health = Math.max(0, player.value.health)
    store.boss.health = Math.max(0, store.boss.health)

    if (guashaRounds.value > 1) {
      guashaRounds.value--
      if (store.boss.health <= 0) {
        const equipItem = boss.boss_Equip(maxLv)
        isequipment.value = true
        equipmentInfo.value = equipItem
        texts.value.push(
          `你击败了${store.boss.name}，获得了<span class="el-tag el-tag--${equipItem.quality}">${
            levels[equipItem.quality]
          }${equipItem.name}(${genre[equipItem.type]})</span>`
        )
        if (player.value.inventory.length >= player.value.backpackCapacity) {
          texts.value.push('背包已满，装备已丢弃。')
        } else {
          player.value.inventory.push(equipItem)
        }
        player.value.props.rootBone += 1
        texts.value.push('获得1颗悟性丹')
        player.value.props.currency += currency.value
        texts.value.push(`获得${currency.value}块鸿蒙石`)
        isEnd.value = true
        store.boss.time = Math.floor(Date.now() / 1000)
        store.boss.health = 0
        store.boss.conquer = true
        stopFightBoss()
      } else if (player.value.health <= 0) {
        isEnd.value = true
        store.boss.health = store.boss.maxhealth
        texts.value.push('你被击败了。')
        texts.value.push(`${store.boss.text}`)
        stopFightBoss()
        guashaRounds.value = 50
      } else {
        texts.value.push(
          isPlayerHit
            ? `你攻击了${store.boss.name}${isCritical ? '，触发暴击' : ''}，造成${playerHarm}点伤害，BOSS剩余${
                store.boss.health
              }气血。`
            : `你攻击了${store.boss.name}，对方闪避了你的攻击。`
        )
        texts.value.push(
          isBHit
            ? `${store.boss.name}攻击了你${isMCritical ? '，触发暴击' : ''}，造成${monsterHarm}点伤害。`
            : `${store.boss.name}攻击了你，你闪避了攻击。`
        )
      }
    } else {
      guashaRounds.value = 50
      stopFightBoss()
      store.boss.health = store.boss.maxhealth
      texts.value.push(`回合结束，你未战胜${store.boss.name}。`)
      texts.value.push(`${store.boss.text}`)
    }
  }

  const openEquipmentInfo = item => {
    if (!isequipment.value) return
    ElMessageBox.confirm('', item.name, {
      center: true,
      message: `<div class="monsterinfo">
      <div class="monsterinfo-box">
        <p>类型: ${genre[item.type] ?? '未知'}</p>
        <p>境界: ${levelNames(item.level)}</p>
        <p>品质: ${levels[item.quality] ?? '未知'}</p>
        <p>气血: ${formatNumberToChineseUnit(item.health)}</p>
        <p>攻击: ${formatNumberToChineseUnit(item.attack)}</p>
        <p>防御: ${formatNumberToChineseUnit(item.defense)}</p>
        <p>闪避率: ${(item.dodge * 100).toFixed(2) ?? 0}%</p>
        <p>评分: ${formatNumberToChineseUnit(
          equip.calculateEquipmentScore(item.dodge, item.attack, item.health, item.critical, item.defense)
        )}</p>
        </div>
    </div>`,
      showClose: false,
      closeOnClickModal: false,
      closeOnPressEscape: false,
      dangerouslyUseHTMLString: true,
      showCancelButton: false,
      confirmButtonText: '知道了'
    })
      .then(() => {
        router.push('/home')
      })
      .catch(() => {
        router.push('/home')
      })
  }

  const assaultBoss = async () => {
    ensureCheats()
    ensureAiDifficulty()
    const bossCheats = player.value.cheats.boss
    const ignoreCooldown = player.value.hellMode || bossCheats.infiniteTimes
    const time = getMinuteDifference(store.boss.time)
    const bossLv = maxLv * player.value.reincarnation + maxLv

    if (store.boss.health > 0) {
      if (ignoreCooldown || time >= 5) {
        store.boss = scaleHellBoss(await applyAiDifficultyToBoss(boss.drawPrize(bossLv)))
      }
    } else {
      if (ignoreCooldown || time >= 5 || store.boss.time == 0) {
        store.boss = scaleHellBoss(await applyAiDifficultyToBoss(boss.drawPrize(bossLv)))
      } else {
        isEnd.value = true
        texts.value.push('BOSS未刷新，请等待5分钟后再挑战。')
        return
      }
    }
    guashaRounds.value = 50
  }

  const getMinuteDifference = specifiedTimestamp => {
    const currentTimestamp = Math.floor(Date.now() / 1000)
    specifiedTimestamp = specifiedTimestamp == 0 ? currentTimestamp : specifiedTimestamp
    const timeDifferenceInSeconds = Math.abs(currentTimestamp - specifiedTimestamp)
    return Math.floor(timeDifferenceInSeconds / 60)
  }

  onMounted(async () => {
    await assaultBoss()
  })

  onUnmounted(() => {
    stopFightBoss()
  })
</script>

<style scoped>
  .boss-box .desc {
    margin: 10px 0;
  }

  .boss-cheat {
    margin-top: 8px;
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }
</style>
