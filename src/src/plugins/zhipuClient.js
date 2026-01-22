const DEFAULT_MODEL = import.meta.env.VITE_ZHIPU_MODEL || 'glm-4'
const DEFAULT_BASE_URL = import.meta.env.VITE_ZHIPU_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4/chat/completions'

const ensureApiKey = () => {
  const key = import.meta.env.VITE_ZHIPU_API_KEY
  if (!key) throw new Error('Missing ZHIPU API key. Set VITE_ZHIPU_API_KEY in your environment variables.')
  return key
}

const postJson = async payload => {
  const apiKey = ensureApiKey()
  const response = await fetch(DEFAULT_BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  })
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Zhipu API request failed: ${response.status} ${errorText}`)
  }
  return response.json()
}

export const generateBattleDecision = async battleState => {
  const payload = {
    model: DEFAULT_MODEL,
    temperature: 0.3,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          '你是修仙者的战斗顾问，根据当前战况从 attack 或 retreat 中选择一个最优 action，并说明 reason。仅以 JSON 对象形式回复。'
      },
      {
        role: 'user',
        content: JSON.stringify({
          instructions:
            '返回 {"action": "attack"|"retreat", "reason": "简短说明"}。当玩家生命值低或不可胜时选择 retreat。',
          state: battleState
        })
      }
    ]
  }

  const data = await postJson(payload)
  try {
    const content = data?.choices?.[0]?.message?.content
    if (!content) throw new Error('Empty response content')
    const result = JSON.parse(content)
    const action = result?.action === 'retreat' ? 'retreat' : 'attack'
    return { action, reason: result?.reason || '' }
  } catch (error) {
    throw new Error(`Failed to parse Zhipu response: ${error.message}`)
  }
}
