import { z } from 'zod'
import { MAX_BODY_BYTES, MAX_INPUT_LENGTH, MAX_MESSAGES, MAX_TOTAL_LENGTH } from './chat-limits'

const messageSchema = z.object({
  id: z.string().min(1).max(100),
  role: z.enum(['user', 'assistant']),
  parts: z.array(z.object({
    type: z.literal('text'),
    text: z.string().trim().min(1),
  })).min(1).max(4),
})

// z.object 默认移除未知字段，客户端无法传入模型、提示词等服务端配置。
export const chatRequestSchema = z.object({
  messages: z.array(messageSchema).min(1).max(MAX_MESSAGES),
}).superRefine(({ messages }, context) => {
  const valid =
    messages[0]?.role === 'user' &&
    messages.at(-1)?.role === 'user' &&
    new Set(messages.map((message) => message.id)).size === messages.length &&
    messages.every((message, index) => {
      const length = message.parts.reduce((sum, part) => sum + part.text.length, 0)
      return length <= (message.role === 'user' ? MAX_INPUT_LENGTH : 6000) &&
        (index === 0 || message.role !== messages[index - 1].role)
    }) &&
    messages.reduce((sum, message) =>
      sum + message.parts.reduce((size, part) => size + part.text.length, 0), 0
    ) <= MAX_TOTAL_LENGTH
  if (!valid) context.addIssue({ code: 'custom', message: '会话格式错误或超出长度限制' })
})

export class RequestError extends Error {
  constructor(message: string, public status: number) {
    super(message)
  }
}

export async function readChatRequest(request: Request) {
  if (request.headers.get('content-type')?.split(';')[0]?.trim() !== 'application/json') {
    throw new RequestError('请使用 JSON 格式发送消息。', 415)
  }
  if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES) {
    throw new RequestError('消息过长，请精简后重试。', 413)
  }
  const reader = request.body?.getReader()
  if (!reader) throw new RequestError('消息不能为空。', 400)
  let size = 0
  let timedOut = false
  const chunks: Uint8Array[] = []
  const timer = setTimeout(() => {
    timedOut = true
    void reader.cancel().catch(() => {})
  }, 10000)
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (timedOut) throw new RequestError('读取消息超时，请重试。', 408)
      if (done) break
      size += value.byteLength
      if (size > MAX_BODY_BYTES) {
        await reader.cancel()
        throw new RequestError('消息过长，请精简后重试。', 413)
      }
      chunks.push(value)
    }
    let body: unknown
    try {
      body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    } catch {
      throw new RequestError('消息格式不正确，请重新发送。', 400)
    }
    const result = chatRequestSchema.safeParse(body)
    if (!result.success) throw new RequestError('消息无效或会话过长，请清空会话后重试。', 400)
    return result.data
  } finally {
    clearTimeout(timer)
    reader.releaseLock()
  }
}

// 仅为单进程基础保护；多实例部署应在平台配置共享限流。
export function createRequestGate() {
  let startedAt = 0
  let count = 0
  let active = 0
  return () => {
    if (Date.now() - startedAt >= 60000) {
      startedAt = Date.now()
      count = 0
    }
    if (count >= 30 || active >= 3) return null
    count += 1
    active += 1
    let released = false
    return () => {
      if (!released) active -= 1
      released = true
    }
  }
}
