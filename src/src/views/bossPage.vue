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
      <el-button @click="router.push('/home')">回�疗�</el-button>
    </div>
    <div class="boss-cheat">
      <el-autocomplete
        v-model="bossCheatCode"
        :fetch-suggestions="queryBossCheats"
        placeholder="����������"
        clearable
      />
      <el-button type="primary" @click="applyBossCheat">����</el-button>
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
  import { maxLv, levelNames, formatNumberToChineseUnit, genre, levels, smoothScrollToBottom, gameNotifys } from '@/plugins/game'
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
      gameNotifys({ title: '提示', message: '请先在主页输�?Iamuseless 解锁作弊�? })
      return
    }
    const code = normalizeCheatCode(bossCheatCode.value)
    const cheats = player.value.cheats.boss
    let desc = ''
    switch (code) {
      case 'Seven-BossWin':
        cheats.autoWin = !cheats.autoWin
        desc = cheats.autoWin ? 'BOSS ��击败��? : 'BOSS ��击败关�?
        break
      case 'Seven-BossInfinite':
        cheats.infiniteTimes = !cheats.infiniteTimes
        desc = cheats.infiniteTimes ? 'BOSS 无限次数��? : 'BOSS 无限次数关闭'
        break
      default:
        gameNotifys({ title: '提示', message: '作弊码无�? })
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
    const dodge = Math.min(0.9, Math.max(0.01, (player.value.dodge || 0.01) * multiplier(10, 50)))
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

  // �始攻�?  const startFightBoss = () => {
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

  // 停�攻�
  const stopFightBoss = () => {
    timerIds.value.forEach(id => clearInterval(id))
    timerIds.value = []
  }

  // boss信息
  const openBossInfo = () => {
    const info = store.boss
    ElMessageBox.confirm('', info.name, {
      center: true,
      message: `<div class="monsterinfo">
      <div class="monsterinfo-box">
      <p>����: ${levelNames(info.level)}</p>
      <p>�����ȼ�: ${info.level}</p>
      <p>��Ѫ����: ${formatNumberToChineseUnit(info.maxhealth)}</p>
      <p>��Ѫ: ${formatNumberToChineseUnit(info.health)}</p>
      <p>����: ${formatNumberToChineseUnit(info.attack)}</p>
      <p>����: ${formatNumberToChineseUnit(info.defense)}</p>
      <p>������: ${info.dodge > 0 ? (info.dodge * 100 > 100 ? 100 : (info.dodge * 100).toFixed(2)) : 0}%</p>
      <p>������: ${info.critical > 0 ? (info.critical * 100 > 100 ? 100 : (info.critical * 100).toFixed(2)) : 0}%</p>
      <p>����: ${formatNumberToChineseUnit(
        equip.calculateEquipmentScore(info.dodge, info.attack, info.health, info.critical, info.defense)
      )}</p>
      <p>����ʯ����: ${currency.value}ö</p>
      <p>������: 100%</p>

      </div>
    </div>`,
      showCancelButton: false,
      confirmButtonText: '知道�?,
      dangerouslyUseHTMLString: true
    }).catch(() => {})
  }

  // 攻击世界boss
  const fightBoss = () => {
    ensureCheats()
    const battleCheats = player.value.cheats.battle
    const bossCheats = player.value.cheats.boss
    if (player.value.level < maxLv) {
      isEnd.value = true
      stopFightBoss()
      texts.value.push(`你的境界尚未达到${levelNames(maxLv)}, ${store.boss.name}对于你的挑战不屑�顾`)
      return
    }
    if ((store.boss.health <= 0 || !store.boss.health) && !bossCheats.autoWin && !player.value.hellMode) {
      texts.value.push('BOSS刷新时间还未�?)
      return
    }
    isFighting.value = true
    if (bossCheats.autoWin) store.boss.health = 0
    // boss伤��算
    const monsterAttack = store.boss.attack // boss攻击
    const playerDefense = player.value.defense // 玩�防�
    let monsterHarm = Math.max(0, Math.floor(monsterAttack - playerDefense)) // boss伤�
    monsterHarm = monsterHarm <= 1 ? 1 : monsterHarm // 伤�小�1时强制破�?    // 玩�伤害�算
    const playerAttack = player.value.attack // 玩�攻�
    const monsterDefense = store.boss.defense // boss防御
    let playerHarm = Math.max(0, Math.floor(playerAttack - monsterDefense)) // 玩�伤害基��?    playerHarm = playerHarm <= 1 ? 1 : playerHarm // 伤�小�1时强制破�?    // �否暴�
    let isMCritical = false,
      isCritical = false
    // 玩�是否闪�
    const isPlayerHit = Math.random() > store.boss.dodge
    // boss�否闪�
    const isBHit = battleCheats.dodge100 ? false : Math.random() > player.value.dodge
    // ��boss�否暴�
    if (Math.random() < store.boss.critical) {
      // boss暴击，伤害加�?      monsterHarm *= 2
      // boss成功暴击
      isMCritical = true
    }
    // �查玩家是否暴�?    if (Math.random() < (battleCheats.crit100 ? 1 : player.value.critical)) {
      // 玩�暴击，伤�加�?      playerHarm *= 1.5
      // 玩�成功暴�
      isCritical = true
    }
    // 如果玩�没有闪避，扣除玩�气�
    if (battleCheats.godMode) monsterHarm = 0
    if (isBHit) player.value.health -= monsterHarm
    // 如果boss没有�避，扣除boss气�
    if (isPlayerHit) store.boss.health -= playerHarm
    if (battleCheats.oneHit) store.boss.health = 0
    player.value.health = Math.max(0, player.value.health)
    store.boss.health = Math.max(0, store.boss.health)
    if (guashaRounds.value > 1) {
      // 扣除回合�?      guashaRounds.value--
      // boss气�小于等于0
      if (store.boss.health <= 0) {
        const equipItem = boss.boss_Equip(maxLv)
        isequipment.value = true
        equipmentInfo.value = equipItem
        texts.value.push(
          `你击�?{store.boss.name}后，获得�?span class="el-tag el-tag--${equipItem.quality}">${
            levels[equipItem.quality]
          }${equipItem.name}(${genre[equipItem.type]})</span>`
        )
        // 如果装�背包当前�量大于等于背包总��?        if (player.value.inventory.length >= player.value.backpackCapacity)
          texts.value.push(`当前装�背包�量已满, 该��自动丢�? �生可增加背包容量`)
        // 玩�获得道�
        else player.value.inventory.push(equipItem)
        // 增加悟�丹
        player.value.props.rootBone += 1
        // 获得悟�丹通知
        texts.value.push('你获得了1颗悟性丹')
        // 增加鸿蒙�?        player.value.props.currency += currency.value
        // 获得鸿蒙石�知
        texts.value.push(`你获得了${currency.value}块鸿蒙石`)
        // �改按�状�?        isEnd.value = true
        // �改boss状�?        store.boss.time = Math.floor(Date.now() / 1000)
        store.boss.health = 0
        store.boss.conquer = true
        stopFightBoss()
      } else if (player.value.health <= 0) {
        isEnd.value = true
        // 恢�boss��?        store.boss.health = store.boss.maxhealth
        texts.value.push('你因为太弱�击败了�?)
        texts.value.push(`${store.boss.text}`)
        stopFightBoss()
        guashaRounds.value = 50
      } else {
        texts.value.push(
          isPlayerHit
            ? `你攻击了${store.boss.name}�?{isCritical ? '触发暴击' : ''}造成�?{playerHarm}点伤害，剩余${
                store.boss.health
              }气�。`
            : `你攻击了${store.boss.name}，�方�避了你的攻击，你�造成伤�，剩�?{store.boss.health}气��?`
        )
        texts.value.push(
          isBHit
            ? `${store.boss.name}攻击了你�?{isMCritical ? '触发暴击' : ''}造成�?{monsterHarm}点伤害`
            : `${store.boss.name}攻击了你，你�避了对方的攻击，对方�造成伤�，你剩�${player.value.health}气��?`
        )
      }
    } else {
      // 恢�默认回合�?      guashaRounds.value = 50
      stopFightBoss()
      // 恢�boss��?      store.boss.health = store.boss.maxhealth
      texts.value.push(`回合结束, 你未战胜${store.boss.name}你输了�`)
      texts.value.push(`${store.boss.text}`)
    }
  }

  const openEquipmentInfo = item => {
    if (!isequipment.value) return
    ElMessageBox.confirm('', item.name, {
      center: true,
      message: `<div class="monsterinfo">
      <div class="monsterinfo-box">
        <p>类型: ${genre[item.type] ?? '��'}</p>
        <p>境界: ${levelNames(item.level)}</p>
        <p>品质: ${levels[item.quality] ?? '��'}</p>
        <p>气�: ${formatNumberToChineseUnit(item.health)}</p>
        <p>攻击: ${formatNumberToChineseUnit(item.attack)}</p>
        <p>防御: ${formatNumberToChineseUnit(item.defense)}</p>
        <p>�避�? ${(item.dodge * 100).toFixed(2) ?? 0}%</p>

      <p>����: </p>
        </div>
    </div>`,
      showClose: false,
      closeOnClickModal: false,
      closeOnPressEscape: false,
      dangerouslyUseHTMLString: true,
      showCancelButton: false,
      confirmButtonText: '知道�?
    })
      .then(() => {
        router.push('/home')
      })
      .catch(() => {
        router.push('/home')
      })
  }

  // 世界BOSS
  const assaultBoss = async () => {
    ensureCheats()
    ensureAiDifficulty()
    const bossCheats = player.value.cheats.boss
    const ignoreCooldown = player.value.hellMode || bossCheats.infiniteTimes
    // boss生成的时�?    const time = getMinuteDifference(store.boss.time)
    // boss难度根据玩�最高等�?+ �生�数
    const bossLv = maxLv * player.value.reincarnation + maxLv
    // ��boss的�量和时间
    if (store.boss.health > 0) {
      // 如果boss还有�量，允�玩家挑�
      if (ignoreCooldown || time >= 5) {
        // boss没有�量但时间大于等于5分钟，重新生成boss
        store.boss = scaleHellBoss(await applyAiDifficultyToBoss(boss.drawPrize(bossLv)))
      }
      // 如果boss没有��?    } else {
      if (ignoreCooldown || time >= 5 || store.boss.time == 0) {
        // boss没有�量但时间大于等于5分钟，重新生成boss
        store.boss = scaleHellBoss(await applyAiDifficultyToBoss(boss.drawPrize(bossLv)))
      } else {
        isEnd.value = true
        texts.value.push('BOSS还未刷新，�等�5分钟后再次挑�?)
        return
      }
    }
    //更新回合�?    guashaRounds.value = 50
  }

  // 计算当前时间和指定时间相�多少分�?  const getMinuteDifference = specifiedTimestamp => {
    // 获取当前时间戳（秒数�?    const currentTimestamp = Math.floor(Date.now() / 1000)
    specifiedTimestamp = specifiedTimestamp == 0 ? currentTimestamp : specifiedTimestamp
    // 计算时间�（分钟数�
    const timeDifferenceInSeconds = Math.abs(currentTimestamp - specifiedTimestamp)
    const timeDifferenceInMinutes = Math.floor(timeDifferenceInSeconds / 60)
    return timeDifferenceInMinutes
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




