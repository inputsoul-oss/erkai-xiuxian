<template>
  <div class="cultivate">
    <div class="cultivation-info">
      <div class="realm-display">
        当前境界：
        <span class="realm-text" v-text="`${levelNames(player.level)}(${player.reincarnation || 0}转)`" />
      </div>
      <el-progress
        :percentage="cultivationPercentage"
        :format="percentage => `${percentage.toFixed(2)}%`"
        text-inside
        :stroke-width="20"
        status="success"
        class="custom-progress"
      />
    </div>
    <div class="storyText">
      <div class="storyText-box">
        <el-scrollbar ref="scrollbar" always>
          <p v-for="(item, index) in texts" :key="index" v-html="item" />
        </el-scrollbar>
      </div>
    </div>
    <div class="actions">
      <div class="action" v-for="(item, index) in buttonsFor" :key="index">
        <el-button class="item" @click="item.click" :disabled="item.disabled">{{ item.text }}</el-button>
      </div>
    </div>
    <div class="cultivate-cheat">
      <el-autocomplete
        v-model="cultivateCheatCode"
        :fetch-suggestions="queryCultivateCheats"
        placeholder="输入作弊码"
        clearable
      />
      <el-button type="primary" @click="applyCultivateCheat">激活</el-button>
    </div>
  </div>
</template>

<script setup>
  import { useRouter } from 'vue-router'
  import { ref, computed, onUnmounted, onMounted } from 'vue'
  import { useMainStore } from '@/plugins/store'
  import equip from '@/plugins/equip'
  import { maxLv, smoothScrollToBottom, levelNames, gameNotifys } from '@/plugins/game'
  import { ElMessageBox } from 'element-plus'

  const store = useMainStore()
  const router = useRouter()
  const texts = ref([])
  const player = ref(store.player)
  const isStop = ref(false)
  const isStart = ref(false)
  const timerIds = ref([])
  const observer = ref(null)
  const scrollbar = ref(null)
  const cultivateCheatCode = ref('')
  const normalizeCheatCode = code => code.replace(/[\s\u200B-\u200D\uFEFF]/g, '')
  const cultivateCheatOptions = ['Seven-MaxCultivation', 'Seven-Points', 'Seven-AutoBreak']
  const queryCultivateCheats = (query, cb) => {
    const q = normalizeCheatCode(query)
    if (!q.startsWith('Seven')) return cb([])
    cb(cultivateCheatOptions.filter(item => item.includes(q)).map(item => ({ value: item })))
  }
  const ensureAutoExploreState = () => {
    if (!player.value.autoExplore) {
      player.value.autoExplore = {
        enabled: false,
        target: 0,
        defeated: 0,
        autoStartCultivate: false,
        exploreCount: 0
      }
    }
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
  const applyCultivateCheat = () => {
    ensureCheats()
    const code = normalizeCheatCode(cultivateCheatCode.value)
    let desc = ''
    switch (code) {
      case 'Seven-MaxCultivation':
        player.value.cultivation = player.value.maxCultivation
        desc = '修为直接满'
        break
      case 'Seven-Points':
        player.value.points += 999
        desc = '境界点 +999'
        break
      case 'Seven-AutoBreak':
        player.value.cultivation = player.value.maxCultivation
        breakThrough(0)
        desc = '自动突破'
        break
      default:
        gameNotifys({ title: '提示', message: '作弊码无效' })
        return
    }
    gameNotifys({ title: '提示', message: `作弊码生效：${desc}` })
  }
  const applyAttackPoints = () => {
    if (!player.value.points) return
    const multiplier = player.value.reincarnation ? player.value.reincarnation * 10 : 1
    const addAttack = player.value.points * 50 * multiplier
    player.value.attack += addAttack
    player.value.points = 0
    player.value.score = equip.calculateEquipmentScore(
      player.value.dodge,
      player.value.attack,
      player.value.maxHealth,
      player.value.critical,
      player.value.defense
    )
  }
  const autoReincarnateIfReady = () => {
    if (player.value.level !== maxLv) return false
    applyAttackPoints()
    const requirement = player.value.reincarnation == 0 ? 100 : player.value.reincarnation * 100
    if (player.value.taskNum < requirement) return false
    player.value.level = 0
    player.value.taskNum = 0
    player.value.cultivation = 0
    player.value.maxCultivation = 100
    player.value.reincarnation++
    player.value.backpackCapacity += 50
    player.value.health = player.value.maxHealth
    startCultivate()
    return true
  }
  const buttonsFor = computed(() => {
    return [
      { text: '开始修炼', click: () => startCultivate(), disabled: !isStart.value },
      { text: '停止修炼', click: () => stopCultivate(), disabled: !isStop.value },
      { text: '转生突破', click: () => reincarnationBreakthrough() },
      { text: '返回家里', click: () => router.push('/home') }
    ]
  })

  const cultivationPercentage = computed(() => {
    const { cultivation, maxCultivation } = player.value
    return Math.min(100, (cultivation / maxCultivation) * 100)
  })

  const startCultivate = () => {
    isStart.value = false
    const zs = player.value.reincarnation * 10
    const time = zs >= 200 ? 100 : 300 - zs
    const timerId = setInterval(() => {
      if (player.value.cultivation <= player.value.maxCultivation) {
        isStop.value = true
        isStart.value = false
        const exp =
          player.value.level <= 10
            ? Math.floor(player.value.maxCultivation / equip.getRandomInt(10, 30))
            : Math.floor(player.value.maxCultivation / 100)
        texts.value.push(
          player.value.level < maxLv
            ? '你开始冥想，吸收周围的灵气。修为提升了！'
            : '你当前的境界已修炼圆满, 需要转生后才能继续修炼'
        )
        breakThrough(exp)
        // 10%的概率触发随机事件
        if (Math.random() < 0.1) triggerRandomEvent()
      } else {
        breakThrough(100)
      }
    }, time)
    timerIds.value.push(timerId)
  }

  const triggerRandomEvent = () => {
    const randomEvents = [
      { type: 'resource', name: '灵石', amount: 100, description: '你发现了一堆灵石！' },
      { type: 'cultivation', name: '顿悟', amount: 500, description: '你突然顿悟，修为大涨！' },
      { type: 'item', name: '丹药', effect: '增加100点修为', description: '你获得了一颗珍贵的丹药！' },
      { type: 'skill', name: '剑法', effect: '增加10%攻击力', description: '你领悟了一门高深剑法！' },
      { type: 'lucky', name: '雷劫', effect: '修为降低10%', description: '你遭遇了雷劫！' }
    ]
    const event = randomEvents[Math.floor(Math.random() * randomEvents.length)]
    texts.value.push(`<span style="color: #E6A23C">${event.description}</span>`)
    switch (event.type) {
      case 'resource':
        player.value.props.money += event.amount
        break
      case 'cultivation':
        player.value.cultivation += event.amount
        break
      // 增加修为
      case 'item':
        player.value.cultivation += player.value.cultivation * 0.05
        break
      // 减少修为
      case 'lucky':
        player.value.cultivation -= player.value.cultivation * 0.1
        break
      // 增加攻击力
      case 'skill':
        player.value.attack *= 1.1
        break
    }
  }

  const stopCultivate = () => {
    timerIds.value.forEach(id => {
      clearInterval(id)
    })
    timerIds.value = []
    isStart.value = true
    isStop.value = false
  }

  const breakThrough = exp => {
    const reincarnation = player.value.reincarnation ? player.value.reincarnation + 1 : 1
    if (player.value.level < maxLv) {
      if (player.value.cultivation >= player.value.maxCultivation) {
        if (player.value.level > 10 && player.value.level > player.value.taskNum) {
          stopCultivate()
          isStop.value = false
          isStart.value = false
          const remaining = player.value.level - player.value.taskNum
          if (remaining > 0) {
            ensureAutoExploreState()
            player.value.autoExplore.enabled = true
            player.value.autoExplore.target = remaining
            player.value.autoExplore.defeated = 0
            player.value.autoExplore.autoStartCultivate = false
            gameNotifys({ title: '提示', message: `已开启自动探索，目标 ${remaining} 个敌人` })
            router.push('/map')
          }
          texts.value.push(
            `当前境界修为已满, 你需要通过击败<span class="textColor">(${player.value.taskNum} / ${player.value.level})</span>个敌人证道突破`
          )
          return
        }
        player.value.taskNum = 0
        player.value.level++
        player.value.points += 3
        player.value.health = player.value.maxHealth
        player.value.maxCultivation = Math.floor(100 * Math.pow(2, player.value.level * reincarnation))
        texts.value.push(`恭喜你突破了！当前境界：${levelNames(player.value.level)}`)
        if (player.value.level % 10 === 0) {
          applyAttackPoints()
        }
        if (autoReincarnateIfReady()) return
      } else {
        player.value.cultivation += exp
      }
    } else {
      isStop.value = false
      isStart.value = false
      player.value.level = maxLv
      player.value.maxCultivation = Math.floor(100 * Math.pow(2, maxLv * reincarnation))
      if (!autoReincarnateIfReady()) stopCultivate()
    }
  }

  const reincarnationBreakthrough = () => {
    let reincarnation = player.value.reincarnation
    reincarnation = reincarnation == 0 ? 1 * 100 : reincarnation * 100
    if (player.value.level == maxLv) {
      if (player.value.points) {
        gameNotifys({ title: '未满足转生条件', message: `当前还有${player.value.points}境界点未使用, 无法转生` })
        return
      }
      if (player.value.taskNum >= reincarnation) {
        const txt =
          player.value.reincarnation == 0
            ? '转生之后的敌人属性是转生前的百倍<br>转生前请务必确认自己的实力是否足够战胜转生后的对手, 避免卡档后删档重练'
            : '转生操作不可逆, 是否确定要转生?'
        ElMessageBox.confirm(txt, '转生提醒', {
          center: true,
          cancelButtonText: '取消转生',
          confirmButtonText: '立即转生',
          dangerouslyUseHTMLString: true
        })
          .then(() => {
            player.value.level = 0
            player.value.taskNum = 0
            player.value.cultivation = 0
            player.value.maxCultivation = 100
            player.value.reincarnation++
            player.value.backpackCapacity += 50
            gameNotifys({
              title: '转生提示',
              message: `转生成功, 当前为${player.value.reincarnation}转, 背包总容量增加50`,
              dangerouslyUseHTMLString: true
            })
          })
          .catch(() => {})
      } else {
        gameNotifys({
          title: '未满足转生条件',
          message: `需要通过击败<span class="textColor">(${player.value.taskNum} / ${reincarnation})</span>个敌人证道转生`,
          dangerouslyUseHTMLString: true
        })
      }
    } else {
      gameNotifys({
        title: '未满足转生条件',
        message: `境界需要达到<span class="textColor">${levelNames(maxLv)}</span>才能满足转生条件`,
        dangerouslyUseHTMLString: true
      })
    }
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

  onMounted(() => {
    ensureAutoExploreState()
    ensureCheats()
    startCultivate()
    setupObserver()
  })

  onUnmounted(() => {
    stopCultivate()
    stopObserving()
  })
</script>

<style scoped>
  .cultivate {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    max-width: 600px;
    margin: 0 auto;
  }

  .cultivation-info {
    width: 100%;
    margin-bottom: 20px;
  }

  .custom-progress {
    width: 100%;
  }

  .realm-display {
    margin-bottom: 10px;
    font-size: 16px;
    text-align: center;
  }

  .realm-text {
    color: var(--el-color-primary);
    font-weight: bold;
  }

  .storyText {
    width: 100%;
  }

  .storyText-box {
    max-height: 300px;
    overflow-y: auto;
    padding: 10px;
    border: 1px solid #dcdfe6;
    border-radius: 4px;
    margin-bottom: 20px;
    width: 100%;
    box-sizing: border-box;
  }

  .actions {
    width: 100%;
  }

  .action {
    width: calc(25% - 10px);
  }

  .item {
    width: 100%;
  }

  .cultivate-cheat {
    margin-top: 10px;
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }

  .event-text {
    color: #e6a23c;
    font-weight: bold;
  }

  @media (max-width: 768px) {
    .action {
      width: calc(50% - 10px);
    }
  }
</style>
