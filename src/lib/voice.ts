export type VoiceState = 'idle' | 'listening' | 'processing' | 'error'

// 识别结束（onend）时收尾：若仍停在 listening 或 processing（例如手动停止且没有 onresult/onerror），
// 回到 idle，避免语音状态永久卡在 processing。
export function finalizeVoiceState(current: VoiceState): VoiceState {
  return current === 'listening' || current === 'processing' ? 'idle' : current
}

export interface Recognition {
  onresult: ((event: { results: { [index: number]: { [index: number]: { transcript: string } } } }) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}

// One controller owns one active session. Detach handlers before aborting because
// some engines synchronously emit terminal events from abort().
export function createVoiceController(onState: (state: VoiceState) => void, onText: (text: string) => void) {
  let current: Recognition | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  function release() {
    clearTimeout(timer)
    const previous = current
    current = null
    if (previous) {
      previous.onresult = previous.onerror = previous.onend = null
      try { previous.abort() } catch { /* already ended */ }
    }
  }
  function finish(state: VoiceState) {
    release()
    onState(state)
  }
  function arm(ms: number) {
    clearTimeout(timer)
    timer = setTimeout(() => finish('error'), ms)
  }
  return {
    start(recognition: Recognition) {
      release()
      current = recognition
      recognition.onresult = (event) => {
        if (current !== recognition) return
        const text = event.results?.[0]?.[0]?.transcript?.trim()
        if (text) onText(text)
        finish('idle')
      }
      recognition.onerror = () => { if (current === recognition) finish('error') }
      recognition.onend = () => { if (current === recognition) finish('idle') }
      onState('listening')
      arm(60_000)
      try { recognition.start() } catch { finish('error') }
    },
    stop() {
      if (!current) return
      onState('processing')
      arm(5_000)
      try { current.stop() } catch { finish('error') }
    },
    dispose: release,
  }
}
