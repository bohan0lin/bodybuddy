export type VoiceState = 'idle' | 'listening' | 'processing' | 'error'

// 识别结束（onend）时收尾：若仍停在 listening 或 processing（例如手动停止且没有 onresult/onerror），
// 回到 idle，避免语音状态永久卡在 processing。
export function finalizeVoiceState(current: VoiceState): VoiceState {
  return current === 'listening' || current === 'processing' ? 'idle' : current
}
