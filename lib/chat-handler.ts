import { createUIMessageStreamResponse, type UIMessageChunk } from 'ai'
import { streamProjectReply } from './agent'
import { createRequestGate, readChatRequest, RequestError } from './chat-request'

const unavailableMessage = '项目助手暂时无法回复，请稍后再试。'

function failure(message: string, status: number) {
  return new Response(message, {
    status,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      ...(status === 429 ? { 'Retry-After': '60' } : {}),
    },
  })
}

// 依赖注入用于离线测试；客户端不能设置这些参数。
export function createChatHandler({
  reply = streamProjectReply,
  isConfigured = () => Boolean(process.env.AI_GATEWAY_API_KEY?.trim()),
  enter = createRequestGate(),
  timeoutMs = 45000,
} = {}) {
  return async function POST(request: Request) {
    const origin = request.headers.get('origin')
    const url = new URL(request.url)
    const allowedOrigins = [url.origin]
    const host = request.headers.get('host')
    if (host) allowedOrigins.push(`${url.protocol}//${host}`)
    if (request.headers.get('sec-fetch-site') === 'cross-site' ||
      (origin && !allowedOrigins.includes(origin))) {
      return failure('请从本站打开项目助手。', 403)
    }

    let messages
    try {
      ;({ messages } = await readChatRequest(request))
    } catch (error) {
      return failure(
        error instanceof RequestError ? error.message : '请求未完成，请重试。',
        error instanceof RequestError ? error.status : 400
      )
    }
    if (!isConfigured()) return failure('项目助手尚未配置完成，请稍后再来。', 503)
    if (request.signal.aborted) return failure('请求已取消。', 400)
    const release = enter()
    if (!release) return failure('当前咨询较多，请稍后再试。', 429)

    const controller = new AbortController()
    const signal = AbortSignal.any([request.signal, controller.signal])
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const cleanup = () => {
      clearTimeout(timer)
      release()
      signal.removeEventListener('abort', cleanup)
    }
    signal.addEventListener('abort', cleanup, { once: true })
    try {
      const result = await reply(messages, signal)
      const reader = result.toUIMessageStream({
        sendReasoning: false,
        sendSources: false,
        onError: () => unavailableMessage,
      }).getReader()
      // 显式转发取消并把服务端超时转换为可显示的错误。
      return createUIMessageStreamResponse({
        headers: { 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' },
        stream: new ReadableStream<UIMessageChunk>({
          async pull(destination) {
            try {
              const { done, value } = await reader.read()
              if (done) {
                cleanup()
                if (controller.signal.aborted && !request.signal.aborted) {
                  destination.enqueue({ type: 'error', errorText: '回复超时，请稍后重新发送。' })
                }
                destination.close()
              } else {
                destination.enqueue(value)
              }
            } catch {
              cleanup()
              controller.abort()
              destination.enqueue({ type: 'error', errorText: unavailableMessage })
              destination.close()
            }
          },
          async cancel() {
            controller.abort()
            cleanup()
            await reader.cancel()
          },
        }),
      })
    } catch {
      cleanup()
      controller.abort()
      return failure(unavailableMessage, 502)
    }
  }
}
