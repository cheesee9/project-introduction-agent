import type { UIMessage } from 'ai'
import { MAX_MESSAGES, MAX_TOTAL_LENGTH } from './chat-limits'

// 界面可以展示完整会话，但请求仅发送最近的文本上下文。
export function prepareChatMessages(messages: UIMessage[]): UIMessage[] {
  const history: UIMessage[] = []
  for (const message of messages) {
    if (message.role !== 'user' && message.role !== 'assistant') continue
    const text = message.parts
      .filter((part) => part.type === 'text')
      .map((part) => part.text)
      .join('\n')
      .trim()
    if (!text) continue
    // 失败或停止后再次发送时，以最新的同角色消息为准。
    if (history.at(-1)?.role === message.role) history.pop()
    history.push({ id: message.id, role: message.role, parts: [{ type: 'text', text }] })
  }
  const length = () => history.reduce(
    (sum, message) => sum + message.parts.reduce(
      (size, part) => size + (part.type === 'text' ? part.text.length : 0), 0
    ), 0
  )
  while (history.length > MAX_MESSAGES || length() > MAX_TOTAL_LENGTH) history.shift()
  if (history[0]?.role === 'assistant') history.shift()
  return history
}
