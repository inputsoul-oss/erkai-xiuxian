const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

const normalizeMultiplier = (value, fallback = 1) => {
  const num = Number(value)
  return Number.isFinite(num) ? clamp(num, 0.5, 2) : fallback
}

const parseJsonContent = content => {
  if (!content) return null
  try {
    return JSON.parse(content)
  } catch (error) {
    const start = content.indexOf('{')
    const end = content.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(content.slice(start, end + 1))
      } catch (innerError) {
        return null
      }
    }
    return null
  }
}

const cooldownState = {
  until: 0
}

const cache = new Map()
const CACHE_TTL_MS = 30 * 1000

const getCacheKey = (mode, player, monster) =>
  JSON.stringify({
    mode,
    level: player.level,
    reincarnation: player.reincarnation,
    score: player.score,
    monster: {
      name: monster.name,
      health: monster.health,
      attack: monster.attack,
      defense: monster.defense,
      dodge: monster.dodge,
      critical: monster.critical
    }
  })

const getCached = key => {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.time > CACHE_TTL_MS) {
    cache.delete(key)
    return null
  }
  return entry.value
}

const setCached = (key, value) => {
  cache.set(key, { time: Date.now(), value })
}

const buildRequestBody = (config, payload) => {
  return {
    model: config.model,
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          '你是数值策划。根据玩家属性与怪物基础属性，返回 JSON：{"health":1,"attack":1,"defense":1,"dodge":1,"critical":1,"variance":0.1,"note":""}。倍率范围0.5~2，variance为每项波动比例(0~0.3)，用于让怪物有时更强/更弱。只返回 JSON。'
      },
      {
        role: 'user',
        content: JSON.stringify(payload)
      }
    ]
  }
}

export const generateAiDifficultyProfile = async (config, player) => {
  if (!config?.baseUrl || !config?.apiKey || !config?.model) {
    return { ok: false, message: '配置不完整' }
  }
  const payload = {
    mode: 'profile',
    player: {
      level: player.level,
      reincarnation: player.reincarnation,
      health: player.health,
      maxHealth: player.maxHealth,
      attack: player.attack,
      defense: player.defense,
      dodge: player.dodge,
      critical: player.critical,
      score: player.score
    },
    monster: {
      name: '基准怪物',
      health: Math.max(1, Math.floor(player.maxHealth * 0.9)),
      attack: Math.max(1, Math.floor(player.attack * 0.9)),
      defense: Math.max(0, Math.floor(player.defense * 0.9)),
      dodge: Math.min(0.1, player.dodge || 0),
      critical: Math.min(0.1, player.critical || 0)
    }
  }
  try {
    const response = await fetch(config.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(buildRequestBody(config, payload))
    })
    if (!response.ok) {
      return { ok: false, message: `HTTP ${response.status}` }
    }
    const data = await response.json()
    const content = data?.choices?.[0]?.message?.content
  const result = parseJsonContent(content)
  if (!result) return { ok: false, message: '返回内容不是JSON' }
  const variance = normalizeMultiplier(result.variance, 1) - 1
  const normalizedVariance = clamp(variance, 0, 0.3)
  return {
    ok: true,
    profile: {
      multipliers: {
        health: normalizeMultiplier(result.health),
        attack: normalizeMultiplier(result.attack),
        defense: normalizeMultiplier(result.defense),
        dodge: normalizeMultiplier(result.dodge),
        critical: normalizeMultiplier(result.critical)
      },
      variance: {
        health: normalizedVariance,
        attack: normalizedVariance,
        defense: normalizedVariance,
        dodge: normalizedVariance,
        critical: normalizedVariance
      },
      createdAt: Date.now()
    },
    message: 'AI难度已生成'
  }
  } catch (error) {
    return { ok: false, message: error?.message || '请求失败' }
  }
}

export const testAiDifficulty = async config => {
  if (!config?.baseUrl || !config?.apiKey || !config?.model) {
    return { ok: false, message: '配置不完整' }
  }
  const payload = {
    mode: 'test',
    player: {
      level: 10,
      reincarnation: 0,
      health: 500,
      maxHealth: 500,
      attack: 80,
      defense: 40,
      dodge: 0.1,
      critical: 0.1,
      score: 1000
    },
    monster: {
      name: '测试怪物',
      health: 600,
      attack: 70,
      defense: 30,
      dodge: 0.05,
      critical: 0.05
    }
  }
  try {
    const response = await fetch(config.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(buildRequestBody(config, payload))
    })
    if (!response.ok) {
      return { ok: false, message: `HTTP ${response.status}` }
    }
    const data = await response.json()
    const content = data?.choices?.[0]?.message?.content
    const result = parseJsonContent(content)
    if (!result) return { ok: false, message: '返回内容不是JSON' }
    return { ok: true, message: '连接成功' }
  } catch (error) {
    return { ok: false, message: error?.message || '请求失败' }
  }
}

export const applyAiDifficulty = async ({ player, monster, mode, config }) => {
  if (!config?.enabled || !config?.baseUrl || !config?.apiKey || !config?.model) return monster
  if (!config?.applyTo?.[mode]) return monster
  if (config?.profile?.multipliers) {
    const multipliers = config.profile.multipliers
    const variance = config.profile.variance || {}
    const vary = (base, range) => {
      const delta = (Math.random() * 2 - 1) * (range || 0)
      return base * (1 + delta)
    }
    const baseMaxHealth = monster.maxHealth ?? monster.maxhealth ?? monster.health
    return {
      ...monster,
      health: Math.max(1, Math.floor(monster.health * vary(multipliers.health, variance.health))),
      maxHealth: Math.max(1, Math.floor(baseMaxHealth * vary(multipliers.health, variance.health))),
      maxhealth: Math.max(1, Math.floor(baseMaxHealth * vary(multipliers.health, variance.health))),
      attack: Math.max(1, Math.floor(monster.attack * vary(multipliers.attack, variance.attack))),
      defense: Math.max(0, Math.floor(monster.defense * vary(multipliers.defense, variance.defense))),
      dodge: clamp(monster.dodge * vary(multipliers.dodge, variance.dodge), 0, 0.9),
      critical: clamp(monster.critical * vary(multipliers.critical, variance.critical), 0, 0.9)
    }
  }
  if (Date.now() < cooldownState.until) return monster

  const cacheKey = getCacheKey(mode, player, monster)
  const cached = getCached(cacheKey)
  if (cached) return cached

  const payload = {
    mode,
    player: {
      level: player.level,
      reincarnation: player.reincarnation,
      health: player.health,
      maxHealth: player.maxHealth,
      attack: player.attack,
      defense: player.defense,
      dodge: player.dodge,
      critical: player.critical,
      score: player.score
    },
    monster: {
      name: monster.name,
      health: monster.health,
      attack: monster.attack,
      defense: monster.defense,
      dodge: monster.dodge,
      critical: monster.critical
    }
  }

  const response = await fetch(config.baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify(buildRequestBody(config, payload))
  })
  if (!response.ok) {
    if (response.status === 429) {
      const retryAfter = Number(response.headers.get('retry-after')) || 10
      cooldownState.until = Date.now() + retryAfter * 1000
    }
    return monster
  }

  const data = await response.json()
  const content = data?.choices?.[0]?.message?.content
  const result = parseJsonContent(content)
  if (!result) return monster

  const healthMul = normalizeMultiplier(result.health)
  const attackMul = normalizeMultiplier(result.attack)
  const defenseMul = normalizeMultiplier(result.defense)
  const dodgeMul = normalizeMultiplier(result.dodge)
  const criticalMul = normalizeMultiplier(result.critical)
  const baseMaxHealth = monster.maxHealth ?? monster.maxhealth ?? monster.health

  const adjusted = {
    ...monster,
    health: Math.max(1, Math.floor(monster.health * healthMul)),
    maxHealth: Math.max(1, Math.floor(baseMaxHealth * healthMul)),
    maxhealth: Math.max(1, Math.floor(baseMaxHealth * healthMul)),
    attack: Math.max(1, Math.floor(monster.attack * attackMul)),
    defense: Math.max(0, Math.floor(monster.defense * defenseMul)),
    dodge: clamp(monster.dodge * dodgeMul, 0, 0.9),
    critical: clamp(monster.critical * criticalMul, 0, 0.9)
  }
  setCached(cacheKey, adjusted)
  return adjusted
}
