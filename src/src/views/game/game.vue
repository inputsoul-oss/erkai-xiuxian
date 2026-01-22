<template>
  <div class="games">
    <div class="game-cheat">
      <el-autocomplete
        v-model="gameCheatCode"
        :fetch-suggestions="queryGameCheats"
        placeholder="输入作弊码"
        clearable
      />
      <el-button type="primary" @click="applyGameCheat">激活</el-button>
    </div>
    <el-tabs v-model="tabs">
      <el-tab-pane name="checkin" label="签到">
        <CheckIn @game-result="processGameResult" />
      </el-tab-pane>
      <el-tab-pane name="dice" label="骰子">
        <DiceGame @game-result="processGameResult" />
      </el-tab-pane>
      <el-tab-pane name="rps" label="猜拳">
        <RockPaperScissors @game-result="processGameResult" />
      </el-tab-pane>
      <el-tab-pane name="fortune" label="算卦">
        <FortuneTelling @game-result="processGameResult" />
      </el-tab-pane>
      <el-tab-pane name="toe" label="井棋">
        <Toe @game-result="processGameResult" />
      </el-tab-pane>
      <el-tab-pane name="secret-realm" label="秘境">
        <SecretRealm @game-result="processGameResult" />
      </el-tab-pane>
    </el-tabs>
    <div class="stats">
      <div class="attribute-box">
        <el-row>
          <el-col :span="12" class="attribute-col" v-for="(item, index) in attributeList" :key="index">
            <div class="el-statistic">
              <div class="el-statistic__head">{{ item.name }}</div>
              <div class="el-statistic__content">
                <span class="el-statistic__number">{{ formatNumberToChineseUnit(item.value) }}{{ item.unit }}</span>
              </div>
            </div>
          </el-col>
        </el-row>
      </div>
      <el-button class="attribute-label" @click="router.push('/home')">返回家中</el-button>
    </div>
  </div>
</template>

<script setup>
  import tag from '@/components/tag.vue'
  import Toe from './toe.vue'
  import CheckIn from './checkin.vue'
  import DiceGame from './Dicegame.vue'
  import SecretRealm from './SecretRealm.vue'
  import FortuneTelling from './fortunetelling.vue'
  import RockPaperScissors from './rock.vue'
  import { useRouter } from 'vue-router'
  import { ref, computed, watch, onMounted } from 'vue'
  import { useMainStore } from '@/plugins/store'
  import { formatNumberToChineseUnit, gameNotifys } from '@/plugins/game'

  const store = useMainStore()
  const router = useRouter()
  const tabs = ref('checkin')
  const player = ref(store.player)
  const selectedGame = ref(null)
  const gameCheatCode = ref('')
  const normalizeCheatCode = code => code.replace(/[\s\u200B-\u200D\uFEFF]/g, '')
  const gameCheatOptions = ['Seven-GameWin', 'Seven-Checkin']
  const queryGameCheats = (query, cb) => {
    const q = normalizeCheatCode(query)
    if (!q.startsWith('Seven')) return cb([])
    cb(gameCheatOptions.filter(item => item.includes(q)).map(item => ({ value: item })))
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
  const applyGameCheat = () => {
    ensureCheats()
    if (!player.value.cheatsUnlocked) {
      gameNotifys({ title: '提示', message: '请先在主页输入 Iamuseless 解锁作弊码' })
      return
    }
    const code = normalizeCheatCode(gameCheatCode.value)
    const cheats = player.value.cheats.games
    let desc = ''
    switch (code) {
      case 'Seven-GameWin':
        cheats.alwaysWin = !cheats.alwaysWin
        desc = cheats.alwaysWin ? '小游戏必胜开启' : '小游戏必胜关闭'
        break
      case 'Seven-Checkin':
        cheats.checkinMakeup = !cheats.checkinMakeup
        if (cheats.checkinMakeup) player.value.checkedInToday = false
        desc = cheats.checkinMakeup ? '签到补签开启' : '签到补签关闭'
        break
      default:
        gameNotifys({ title: '提示', message: '作弊码无效' })
        return
    }
    gameNotifys({ title: '提示', message: `作弊码生效：${desc}` })
  }

  const attributeList = computed(() => {
    return [
      { name: '签到天数', unit: '天', value: player.value.checkinDays },
      { name: '拥有灵石', unit: '枚', value: player.value.props.money },
      { name: '胜利次数', unit: '次', value: player.value.gameWins },
      { name: '失败次数', unit: '次', value: player.value.gameLosses }
    ]
  })

  const processGameResult = result => {
    ensureCheats()
    const cheats = player.value.cheats.games
    const resolved = cheats.alwaysWin && !result.success ? { ...result, success: true } : result
    if (resolved.success) updatePlayerWins(resolved)
    else updatePlayerLosses(resolved)
  }

  const updatePlayerWins = result => {
    player.value.gameWins++
    const reward = result.reward
    if (reward) {
      if (typeof reward === 'object') {
        Object.entries(reward).forEach(([key, value]) => {
          player.value.props[key] += value
        })
      } else {
        player.value.props.money += reward
      }
    }
  }
  const updatePlayerLosses = result => {
    player.value.props.money -= result.reward
    player.value.gameLosses++
  }
  const checkDailyReset = () => {
    const now = new Date()
    const lastCheckinDate = new Date(player.value.lastCheckinDate)
    if (now.toDateString() !== lastCheckinDate.toDateString()) player.value.checkedInToday = false
  }

  watch(tabs, newValue => {
    selectedGame.value = newValue
  })

  onMounted(() => {
    ensureCheats()
    checkDailyReset()
  })
</script>

<style scoped>
  .game-container {
    border-radius: 12px;
    margin-bottom: 20px;
  }

  .attribute-box {
    margin-bottom: 10px;
  }

  .attribute-col {
    margin-top: 10px;
  }

  .attribute-label {
    margin: 15px 0;
    width: 40%;
  }

  .game-cheat {
    margin-bottom: 10px;
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }
</style>
