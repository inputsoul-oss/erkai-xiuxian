<template>

  <div class="endless-tower">

    <div class="battle-info">

      <div class="player-info">

        <tag class="name" type="primary" @click="openInfo('player')">

          {{ player.name }}

        </tag>

        <el-progress

          :percentage="playerProgress"

          :status="playerStatus"

          :format="playerHealth"

          :stroke-width="20"

          text-inside

        />

      </div>

      <div class="vs">VS</div>

      <div class="monster-info" v-if="monster">

        <tag class="name" type="danger" @click="openInfo('monster')">{{ monster.name }}</tag>

        <el-progress

          :percentage="monsterProgress"

          :status="monsterStatus"

          :format="monsterhealth"

          :stroke-width="20"

          text-inside

        />

        <div class="monster-attrs">
          <div class="attr-item" v-for="(item, index) in monsterAttributes" :key="index">
            <span class="attr-label" v-text="item.label" />
            <span class="attr-value" v-text="item.value" />
          </div>
        </div>

      </div>

    </div>

    <div class="actions">

      <el-button v-for="(item, index) in buttonData" :key="index" @click="item.click" :disabled="item.disabled">

        {{ item.text }}

      </el-button>

    </div>

    <div class="endless-cheat">
      <el-autocomplete
        v-model="endlessCheatCode"
        :fetch-suggestions="queryEndlessCheats"
        placeholder="Cheat code"
        clearable
      />
      <el-button type="primary" @click="applyEndlessCheat">Activate</el-button>
    </div>

    <div class="sweep-info">

      <el-row>

        <el-col :span="6" v-for="(item, index) in sweepData" :key="index">

          <div class="el-statistic">

            <div class="el-statistic__head" v-text="item.name" />

            <div class="el-statistic__content">

              <span class="el-statistic__number" v-text="item.suffix" />

            </div>

          </div>

        </el-col>

      </el-row>

    </div>

    <el-scrollbar class="battle-log" height="300px" ref="scrollbar" always>

      <p v-for="(log, index) in battleLogs" :key="index" v-html="log" />

    </el-scrollbar>

  </div>

</template>



<script setup>

  // 标签组件

  import tag from '@/components/tag.vue'

  // boss

  import boss from '@/plugins/boss'

  // 装备

  import equip from '@/plugins/equip'

  // 怪物

  import monsters from '@/plugins/monster'

  import { applyAiDifficulty } from '@/plugins/aiDifficulty'

  import combatSystem from '@/plugins/combat'

  import { ElMessageBox } from 'element-plus'

  import { checkAchievements } from '@/plugins/achievementChecker'

  import { useRouter } from 'vue-router'

  import { ref, watch, computed, onMounted, onUnmounted } from 'vue'

  import { useMainStore } from '@/plugins/store'

  import { smoothScrollToBottom, formatNumberToChineseUnit, genre, levels, gameNotifys } from '@/plugins/game'

  import { generateBattleDecision } from '@/plugins/zhipuClient'



  const router = useRouter()

  const store = useMainStore()

  // 玩家数据

  const player = ref(store.player)

  const endlessCheatCode = ref('')

  const normalizeCheatCode = code => code.replace(/[\s\u200B-\u200D\uFEFF]/g, '')

  const endlessCheatOptions = ['Seven-God', 'Seven-OneHit', 'Seven-Crit', 'Seven-Dodge']

  const queryEndlessCheats = (query, cb) => {

    const q = normalizeCheatCode(query)

    if (!q.startsWith('Seven')) return cb([])

    cb(endlessCheatOptions.filter(item => item.includes(q)).map(item => ({ value: item })))

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

  const applyAiDifficultyToMonster = async baseMonster => {

    try {

      ensureAiDifficulty()

      return await applyAiDifficulty({

        player: player.value,

        monster: baseMonster,

        mode: 'endless',

        config: player.value.aiDifficulty

      })

    } catch (error) {

      return baseMonster

    }

  }

  const applyEndlessCheat = () => {

    ensureCheats()

    if (!player.value.cheatsUnlocked) {

      gameNotifys({ title: '提示', message: '请先在主页输入 Iamuseless 解锁作弊码' })

      return

    }

    const code = normalizeCheatCode(endlessCheatCode.value)

    const cheats = player.value.cheats.battle

    let desc = ''

    switch (code) {

      case 'Seven-God':

        cheats.godMode = !cheats.godMode

        desc = cheats.godMode ? '无敌开启' : '无敌关闭'

        break

      case 'Seven-OneHit':

        cheats.oneHit = !cheats.oneHit

        desc = cheats.oneHit ? '秒杀开启' : '秒杀关闭'

        break

      case 'Seven-Crit':

        cheats.crit100 = !cheats.crit100

        desc = cheats.crit100 ? '暴击 100% 开启' : '暴击 100% 关闭'

        break

      case 'Seven-Dodge':

        cheats.dodge100 = !cheats.dodge100

        desc = cheats.dodge100 ? '闪避 100% 开启' : '闪避 100% 关闭'

        break

      default:

        gameNotifys({ title: '提示', message: '作弊码无效' })

        return

    }

    gameNotifys({ title: '提示', message: `作弊码生效：${desc}` })

  }

  // 怪物数据

  const monster = ref(null)

  const observer = ref(null)

  // 扫塔时间

  const sweepTime = ref(0)

  // 战斗日志

  const battleLogs = ref([])

  // 当前层数

  const currentFloor = ref(1)

  // 是否正在扫塔

  const isSweeping = ref(false)

  // 扫塔结果

  const sweepResults = ref({

    // 获得的修为
    expGain: 0,

    // 获得的灵石
    moneyGain: 0,

    // 获得的装备数量
    equipmentGained: 0

  })

  // 玩家气血状态
  const playerStatus = ref('success')

  // 怪物气血状态
  const monsterStatus = ref('success')

  // 扫塔时间间隔

  const sweepInterval = ref(null)

  // 是否自动战斗

  const isAutoFighting = ref(false)

  // 自动战斗时间间隔

  const autoFightInterval = ref(null)

  // 扫塔战斗时间间隔

  const sweepFightInterval = ref(null)

  const scrollbar = ref(null)

  const isAiAssist = ref(false)

  const aiBusy = ref(false)

  const aiAbort = ref(false)

  const aiLoopRunning = ref(false)



  // 扫塔相关信息

  const sweepData = computed(() => {

    return [

      { name: '扫塔时间', suffix: formatTime(sweepTime.value) },

      { name: '获得修为', suffix: `${formatNumberToChineseUnit(sweepResults.value.expGain)}点` },

      { name: '获得灵石', suffix: `${formatNumberToChineseUnit(sweepResults.value.moneyGain)}枚` },

      { name: '获得装备', suffix: `${formatNumberToChineseUnit(sweepResults.value.equipmentGained)}件` }

    ]

  })



  // 按钮

  const buttonData = computed(() => {

    return [

      {

        text: isAutoFighting.value ? '停止战斗' : '自动战斗',

        click: () => toggleAutoFight(),

        disabled: isSweeping.value || player.value.health <= 0

      },

      {

        text: isAiAssist.value ? '停止辅助' : '智能辅助',

        click: () => toggleAiAssist(),

        disabled:

          isSweeping.value || isAutoFighting.value || player.value.health <= 0 || !monster.value || aiBusy.value

      },

      {

        text: '进行战斗',

        click: () => fight(),

        disabled: isSweeping.value || isAutoFighting.value || !monster.value || player.value.health <= 0

      },

      {

        text: isSweeping.value ? '停止扫塔' : '开始扫塔',

        click: () => toggleSweep(),

        disabled: isAutoFighting.value || player.value.health <= 0

      },

      { text: '撤退返回', click: () => retreat(), disabled: false }

    ]

  })



  // 玩家血量进度条

  const playerProgress = computed(() => {

    return (player.value.health / player.value.maxHealth) * 100

  })



  // 怪物血量进度条

  const monsterProgress = computed(() => {

    return (monster.value.health / monster.value.maxHealth) * 100

  })



  // 监听battleLogs变化

  watch(

    () => battleLogs.value,

    () => setupObserver(),

    {

      deep: true

    }

  )



  // 监听玩家血量变化
  watch(

    () => player.value.health,

    () => {

      const { health, maxHealth } = player.value

      playerStatus.value = getStatus(health, maxHealth)

    }

  )



  // 监听怪物血量变化
  watch(

    () => monster.value?.health,

    () => {

      if (monster.value) {

        const { health, maxHealth } = monster.value

        monsterStatus.value = getStatus(health, maxHealth)

      }

    }

  )



  // 玩家气血

  const playerHealth = () => {

    const { health, maxHealth } = player.value

    return `${Math.max(0, health)} / ${Math.max(0, maxHealth)}`

  }



  // 怪物气血

  const monsterhealth = () => {

    const { health, maxHealth } = monster.value

    return `${Math.max(0, health)} / ${Math.max(0, maxHealth)}`

  }

  const formatRate = value => {
    const rate = value > 0 ? value * 100 : 0
    return `${rate > 100 ? 100 : rate.toFixed(2)}%`
  }

  const monsterAttributes = computed(() => {
    if (!monster.value) return []

    return [
      { label: '等级', value: monster.value.level },
      { label: '生命上限', value: formatNumberToChineseUnit(monster.value.maxHealth) },
      { label: '攻击', value: formatNumberToChineseUnit(monster.value.attack) },
      { label: '防御', value: formatNumberToChineseUnit(monster.value.defense) },
      { label: '闪避', value: formatRate(monster.value.dodge) },
      { label: '暴击', value: formatRate(monster.value.critical) }
    ]
  })



  // 动态修改血量状态
  const getStatus = (health, maxHealth) => {

    const num = (health / maxHealth) * 100

    return num >= 70 ? 'success' : num >= 30 ? 'warning' : 'exception'

  }



  // 生成当前层的怪物

  const generateMonster = async () => {

    // 根据当前层数计算怪物等级

    const level = currentFloor.value * 2

    const baseMonster = {

      // 名称

      name: monsters.monster_Names(level),

      // 等级

      level,

      // 闪避率
      dodge: monsters.monster_DodgeRate(level, player.value),

      // 攻击

      attack: monsters.monster_Attack(level, player.value),

      // 气血

      health: monsters.monster_Health(level, player.value),

      // 防御

      defense: monsters.monster_Defense(level, player.value),

      // 最大气血

      maxHealth: monsters.monster_Health(level, player.value),

      // 暴击率
      critical: monsters.monster_Criticalhitrate(level, player.value)

    }

    monster.value = await applyAiDifficultyToMonster(baseMonster)

    // 日志

    battleLogs.value.push(`你遇到了本层的守护者：${monster.value.name}`)

  }

  // 打开双方信息窗口

  const openInfo = type => {

    const isPlayer = type == 'player'

    const info = isPlayer ? player.value : monster.value

    ElMessageBox.confirm('', isPlayer ? player.value.name : info.name, {

      center: true,

      message: `<div class="monsterinfo">

      <div class="monsterinfo-box">

      ${isPlayer ? '' : `<p>基础等级: ${info.level}</p>`}

      ${isPlayer ? '' : `<p>气血上限: ${formatNumberToChineseUnit(info.maxHealth)}</p>`}

      <p>气血: ${formatNumberToChineseUnit(info.health)}</p>

      <p>攻击: ${formatNumberToChineseUnit(info.attack)}</p>

      <p>防御: ${formatNumberToChineseUnit(info.defense)}</p>

      <p>闪避率: ${info.dodge > 0 ? (info.dodge * 100 > 100 ? 100 : (info.dodge * 100).toFixed(2)) : 0}%</p>

      <p>暴击率: ${info.critical > 0 ? (info.critical * 100 > 100 ? 100 : (info.critical * 100).toFixed(2)) : 0}%</p>

      ${isPlayer ? '' : `<p>评分: ${formatNumberToChineseUnit(

        equip.calculateEquipmentScore(info.dodge, info.attack, info.health, info.critical, info.defense)

      )}</p>`}

      ${isPlayer ? '' : `<p>掉落率: 100%</p>`}

      </div>

    </div>`,

      showCancelButton: false,

      confirmButtonText: 'OK',

      dangerouslyUseHTMLString: true

    }).catch(() => {})

  }



  // 进行战斗

  const fight = () => {

    ensureCheats()

    const battleCheats = player.value.cheats.battle

    // 被击败
    if (player.value.health <= 0) {

      handlePlayerDefeat()

      return

    }

    // 重新生成新怪物

    if (!monster.value || monster.value.health <= 0) {

      generateMonster()

      return

    }

    const originalCrit = player.value.critical

    const originalDodge = player.value.dodge

    if (battleCheats.crit100) player.value.critical = 1

    if (battleCheats.dodge100) player.value.dodge = 1

    // 玩家攻击怪物

    const playerAttackResult = combatSystem.executeCombatRound(player.value, monster.value)

    generateCombatLog(player.value.name, monster.value.name, playerAttackResult)

    // 检查怪物是否被击败
    if (monster.value.health <= 0) {

      player.value.critical = originalCrit

      player.value.dodge = originalDodge

      handleMonsterDefeat()

      return

    }

    if (battleCheats.oneHit) {

      monster.value.health = 0

      player.value.critical = originalCrit

      player.value.dodge = originalDodge

      handleMonsterDefeat()

      return

    }

    // 怪物攻击玩家

    const monsterAttackResult = combatSystem.executeCombatRound(monster.value, player.value)

    generateCombatLog(monster.value.name, player.value.name, monsterAttackResult)

    if (battleCheats.godMode) player.value.health = player.value.maxHealth

    player.value.critical = originalCrit

    player.value.dodge = originalDodge

    // 玩家是否被击败
    if (player.value.health <= 0) {

      handlePlayerDefeat()

    }

  }



  const generateCombatLog = (attackerName, defenderName, result) => {

    if (!result.isHit) {

      battleLogs.value.push(`${attackerName}的攻击被${defenderName}闪避掉了。`)

    } else {

      let logMessage = `${attackerName}对${defenderName}造成了${result.damage}点伤害`

      if (result.isCritical) logMessage += '（暴击！）'

      logMessage += `，${defenderName}剩余${result.remainingHealth}气血。`

      battleLogs.value.push(logMessage)

    }

  }



  // 处理怪物被击败的情况

  const handleMonsterDefeat = () => {

    // 修为

    const expGain = Math.floor(monster.value.level * 100 * (player.value.hellMode ? 0.5 : 1))

    // 灵石

    const moneyGain = Math.floor(monster.value.level * 2)

    // 增加修为

    player.value.cultivation += expGain

    // 增加灵石

    player.value.props.money += moneyGain

    // 日志

    battleLogs.value.push(`你击败了 ${monster.value.name}！`)

    battleLogs.value.push(`获得了${expGain}点修为和 ${moneyGain}灵石`)

    // 随机获得装备

    getRandomEquipment()

    // 增加层数

    currentFloor.value++

    // 检查是否是5的倍数层，且之前没有获得过该层的首通
    if (currentFloor.value % 5 === 0 && !player.value.rewardedTowerFloors.includes(currentFloor.value)) {

      player.value.props.cultivateDan += 500

      player.value.rewardedTowerFloors.push(currentFloor.value)

      battleLogs.value.push(`恭喜你通过第${currentFloor.value} 层，获得首通奖励：500颗修炼丹！`)

    }

    // 如果当前层数大于最高层数
    if (currentFloor.value > player.value.highestTowerFloor) player.value.highestTowerFloor = currentFloor.value

    // 日志

    battleLogs.value.push(`成功通过第${currentFloor.value - 1} 层，自动前往第${currentFloor.value} 层。`)

    // 生成新的怪物（下一层）

    generateMonster()

  }



  // 处理玩家被击败的情况

  const handlePlayerDefeat = () => {

    // 日志

    battleLogs.value.push('你被击败了！战斗结束。')

    battleLogs.value.push(`${monster.value.name}: ${boss.drawPrize(monster.value.level).text}`)

    // 关闭自动战斗

    isAutoFighting.value = false

    // 关闭扫塔

    isSweeping.value = false

    // 停止自动战斗

    stopAutoFight()

    stopAiAssist()

    // 停止扫塔

    stopSweep()

  }

  // 切换自动战斗状态
  const toggleAutoFight = () => {

    if (!isAutoFighting.value) stopAiAssist()

    isAutoFighting.value = !isAutoFighting.value

    // 启动自动战斗

    if (isAutoFighting.value) autoFightInterval.value = setInterval(fight, 1000)

    // 停止自动战斗

    else stopAutoFight()

  }



  // 停止自动战斗

  const stopAutoFight = () => {

    clearInterval(autoFightInterval.value)

    autoFightInterval.value = null

  }



  // 撤退

  const retreat = () => {

    stopAiAssist()

    // 关闭自动战斗

    isAutoFighting.value = false

    // 关闭扫塔

    isSweeping.value = false

    // 停止自动战斗

    stopAutoFight()

    // 停止扫塔

    stopSweep()

    router.push('/home')

  }



  // 随机获得装备

  const getRandomEquipment = () => {

    let equipItem = {}

    let exp = Math.floor(player.value.maxCultivation / 100)

    exp = exp ? exp : 1

    ensureCheats()

    const forceTopDrop = player.value.cheats.explore.forceTopDrop || player.value.hellMode

    const randomInt = equip.getRandomInt(1, 4)

    // 神器

    if (randomInt == 1) equipItem = equip.equip_Weapons(player.value.level, false, forceTopDrop)

    // 护甲

    else if (randomInt == 2) equipItem = equip.equip_Armors(player.value.level, false, forceTopDrop)

    // 灵宝

    else if (randomInt == 3) equipItem = equip.equip_Accessorys(player.value.level, false, forceTopDrop)

    // 法器

    else if (randomInt == 4) equipItem = equip.equip_Sutras(player.value.level, false, forceTopDrop)

    battleLogs.value.push(

      `你发现了一个宝箱，打开后获得了${levels[equipItem.quality]}${equipItem.name}(${genre[equipItem.type]})`

    )

    // 如果背包满了就不增加装备

    if (player.value.inventory.length >= player.value.backpackCapacity)

      battleLogs.value.push(`当前装备背包容量已满, 该装备自动丢弃! 可升级增加背包容量`)

    else player.value.inventory.push(equipItem)

  }



  // 切换扫塔状态
  const toggleSweep = () => {

    // 扫塔状态
    isSweeping.value = !isSweeping.value

    if (isSweeping.value) {

      stopAiAssist()

      // 重置扫塔时间

      sweepTime.value = 0

      // 重置扫塔结果

      sweepResults.value = { expGain: 0, moneyGain: 0, equipmentGained: 0 }

      const sweepFloor = Math.max(1, player.value.highestTowerFloor || 1)
      currentFloor.value = sweepFloor
      // 设定每秒更新扫塔时间

      sweepInterval.value = setInterval(sweep.value, 1000)

      // 每30秒进行一次战斗
      sweepFightInterval.value = setInterval(sweepFight.value, 30000)

    } else {

      // 停止扫塔

      stopSweep()

    }

  }



  // 停止扫塔

  const stopSweep = () => {

    clearInterval(sweepInterval.value)

    clearInterval(sweepFightInterval.value)

    sweepInterval.value = null

    sweepFightInterval.value = null

  }



  const toggleAiAssist = () => {

    if (isAiAssist.value) stopAiAssist()

    else if (monster.value) startAiAssist()

  }



  const startAiAssist = () => {

    if (aiLoopRunning.value) return

    isAiAssist.value = true

    aiAbort.value = false

    runAiAssistLoop()

  }



  const stopAiAssist = () => {

    aiAbort.value = true

    isAiAssist.value = false

  }



  const createBattleState = () => {

    if (!monster.value)

      return null

    return {

      floor: currentFloor.value,

      player: {

        health: player.value.health,

        maxHealth: player.value.maxHealth,

        attack: player.value.attack,

        defense: player.value.defense,

        dodge: player.value.dodge,

        critical: player.value.critical

      },

      monster: {

        health: monster.value.health,

        maxHealth: monster.value.maxHealth,

        attack: monster.value.attack,

        defense: monster.value.defense,

        dodge: monster.value.dodge,

        critical: monster.value.critical

      }

    }

  }



  const runAiAssistLoop = async () => {

    if (aiLoopRunning.value) return

    const initialState = createBattleState()

    if (!initialState) {

      stopAiAssist()

      return

    }

    aiLoopRunning.value = true

    while (

      !aiAbort.value &&

      isAiAssist.value &&

      player.value.health > 0 &&

      monster.value &&

      monster.value.health > 0

    ) {

      aiBusy.value = true

      let decision

      try {

        decision = await generateBattleDecision(createBattleState())

      } catch (error) {

        battleLogs.value.push('智能辅助失败，已切换为手动战斗。')

        stopAiAssist()

        break

      } finally {

        aiBusy.value = false

      }

      if (!isAiAssist.value || aiAbort.value) break

      if (decision?.reason) battleLogs.value.push(`智能建议：${decision.reason}`)

      if (decision?.action === 'retreat') {

        battleLogs.value.push('智能选择撤退。')

        stopAiAssist()

        retreat()

        break

      }

      fight()

      await new Promise(resolve => setTimeout(resolve, 1000))

    }

    aiBusy.value = false

    aiLoopRunning.value = false

  }



  // 进行扫塔

  const sweep = () => {

    // 增加扫塔时间

    sweepTime.value++

    // 60秒更新一次日志
    if (sweepTime.value % 60 === 0)

      battleLogs.value.push(

        `扫塔结果：目前已经扫塔${formatTime(sweepTime.value)}，恭喜你获得了${sweepResults.value.expGain}点修为，${

          sweepResults.value.moneyGain

        }灵石和${sweepResults.value.equipmentGained}件装备。`

      )

  }



  // 扫塔战斗

  const sweepFight = () => {

    const sweepFloor = Math.max(1, player.value.highestTowerFloor || currentFloor.value)
    // 根据当前层数计算获得经验值
    const expGain = Math.floor(sweepFloor * 10 * (player.value.hellMode ? 0.5 : 1))

    // 根据当前层数计算获得灵石

    const moneyGain = Math.floor(sweepFloor * 10)

    // 增加玩家修为

    player.value.cultivation += expGain

    // 增加玩家灵石

    player.value.props.money += moneyGain

    // 增加击杀数
    player.value.jishaNum++

    // 更新扫塔结果中的经验
    sweepResults.value.expGain += expGain

    // 更新扫塔结果中的灵石

    sweepResults.value.moneyGain += moneyGain

    // 10% 概率获得装备

    const equipmentGained = Math.random() < 0.1

    if (equipmentGained) {

      getRandomEquipment()

      sweepResults.value.equipmentGained++

    }

    // 日志

    battleLogs.value.push(

      `扫塔结果：恭喜你获得了${expGain}点修为，${moneyGain}枚灵石${equipmentGained ? '和1件装备' : '。'}`

    )

  }



  const setupObserver = () => {

    const element = scrollbar.value?.wrapRef

    if (element) {

      observer.value = new MutationObserver(() => smoothScrollToBottom(element))

      observer.value.observe(element, { subtree: true, childList: true })

    }

  }

  const stopObserving = () => {

    if (observer.value) {

      observer.value.disconnect()

      observer.value = null

    }

  }



  const formatTime = seconds => {

    if (seconds < 60) {

      return `${seconds}秒`

    } else if (seconds < 3600) {

      const minutes = Math.floor(seconds / 60)

      const remainingSeconds = seconds % 60

      return `${minutes}分钟${remainingSeconds}秒`

    } else {

      const hours = Math.floor(seconds / 3600)

      seconds %= 3600

      const minutes = Math.floor(seconds / 60)

      const remainingSeconds = seconds % 60

      return `${hours}小时${minutes}分钟${remainingSeconds}秒`

    }

  }



  onMounted(() => {

    ensureCheats()

    ensureAiDifficulty()

    //检查成就
    const newAchievements = checkAchievements(player.value, 'monster')

    newAchievements.forEach(achievement => {

      gameNotifys({

        title: '获得成就提示',

        message: `恭喜你完成了${achievement.name}成就`

      })

    })

    // 当前层数

    currentFloor.value = player.value.highestTowerFloor > 1 ? player.value.highestTowerFloor - 1 : 1

    // 生成日志

    battleLogs.value.push(

      `欢迎来到无尽塔！ 这里是无尽塔的第${currentFloor.value}层，你的闯塔最高记录为${player.value.highestTowerFloor}层。`

    )

    // 生成怪物

    generateMonster()

  })



  onUnmounted(() => {

    // 停止自动战斗

    stopAutoFight()

    // 停止扫塔

    stopSweep()

    stopObserving()

    stopAiAssist()

  })

</script>



<style scoped>

  .battle-info {

    display: flex;

    justify-content: space-between;

    align-items: center;

    margin-bottom: 20px;

  }



  .player-info,

  .monster-info {

    width: 45%;

  }



  .name {

    margin-bottom: 10px;

  }



  .vs {

    font-size: 24px;

    font-weight: bold;

    color: var(--el-color-info);

  }



  .actions {

    display: flex;

    justify-content: space-between;

    margin: 20px 0;

  }



  .actions .el-button {

    flex: 1;

    margin: 0 5px;

  }



  .sweep-info {

    margin: 20px 0;

  }



  .sweep-info p {

    margin: 5px 0;

    font-size: 14px;

  }



  .endless-cheat {

    margin: 8px 0;

    display: flex;

    gap: 8px;

    align-items: center;

    flex-wrap: wrap;

    justify-content: center;

  }



  .battle-log {

    border: 1px solid #ddd;

    padding: 10px;

    border-radius: 5px;

  }



  .battle-log p {

    margin: 5px 0;

    font-size: 14px;

    color: var(--el-color-info);

  }

  .monster-attrs {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px 12px;
    margin-top: 10px;
    font-size: 12px;
    color: var(--el-color-info);
  }

  .attr-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }

  .attr-label {
    font-weight: 600;
  }



  @media (max-width: 768px) {

    .player-info,

    .monster-info {

      width: 100%;

      margin-bottom: 20px;

    }



    .vs {

      margin: 0 10px;

    }



    .actions {

      flex-wrap: wrap;

    }



    .actions .el-button {

      flex: 1 0 40%;

      margin: 5px;

    }

  }

</style>




