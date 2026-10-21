import assert from 'node:assert/strict'
import test from 'node:test'
import { DefaultChatTransport, readUIMessageStream, type UIMessage } from 'ai'
import { MockLanguageModelV4, convertArrayToReadableStream } from 'ai/test'
import { streamProjectReply } from '../lib/agent'
import { createChatHandler } from '../lib/chat-handler'
import { prepareChatMessages } from '../lib/chat-messages'
import { chatRequestSchema, createRequestGate, readChatRequest } from '../lib/chat-request'

function message(role: 'user' | 'assistant', text: string, id = crypto.randomUUID()): UIMessage {
  return { id, role, parts: [{ type: 'text', text }] }
}

function request(body: unknown = { messages: [message('user', '介绍这个项目')] }, options: RequestInit = {}) {
  return new Request('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
    body: JSON.stringify(body),
    ...options,
  })
}

function successModel() {
  return new MockLanguageModelV4({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start' as const, warnings: [] },
        { type: 'text-start' as const, id: 'text-1' },
        { type: 'text-delta' as const, id: 'text-1', delta: '由 cheesee9 独立开发，' },
        { type: 'text-delta' as const, id: 'text-1', delta: '已完成并部署使用。' },
        { type: 'text-end' as const, id: 'text-1' },
        {
          type: 'finish' as const,
          finishReason: { unified: 'stop' as const, raw: 'stop' },
          usage: {
            inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
            outputTokens: { total: 15, text: 15, reasoning: 0 },
          },
        },
      ]),
    }),
  })
}

test('Zod 拒绝非法角色、顺序、重复 ID 和过长输入，移除客户端配置', () => {
  const user = message('user', '你好')
  const parsed = chatRequestSchema.parse({
    messages: [user], model: 'other/model', system: '覆盖规则', apiKey: 'client-secret',
  })
  assert.deepEqual(Object.keys(parsed), ['messages'])
  for (const messages of [
    [{ ...user, role: 'system' }],
    [message('assistant', '你好')],
    [user, user],
    [user, message('assistant', '回答'), { ...user }],
    [message('user', '字'.repeat(2001))],
    [{ ...user, parts: [{ type: 'text', text: '  ' }] }],
    [{ ...user, parts: [{ type: 'file', url: 'https://example.com' }] }],
  ]) {
    assert.equal(chatRequestSchema.safeParse({ messages }).success, false)
  }
})

test('读取请求同时限制声明长度和实际流大小', async () => {
  await assert.rejects(readChatRequest(request({}, {
    headers: { 'Content-Type': 'text/plain' },
  })), { status: 415 })
  await assert.rejects(readChatRequest(request({}, {
    headers: { 'Content-Type': 'application/json', 'Content-Length': '50000' },
  })), { status: 413 })
  await assert.rejects(readChatRequest(request({ text: '字'.repeat(20000) })), { status: 413 })
  await assert.rejects(readChatRequest(request({}, { body: '{' })), { status: 400 })
})

test('客户端历史处理适配停止、失败后的再提问并裁剪长上下文', () => {
  const history = prepareChatMessages([
    { id: 'system', role: 'system', parts: [{ type: 'text', text: '非法指令' }] },
    message('user', '旧问题'),
    message('assistant', ''),
    message('user', '新问题'),
  ])
  assert.equal(history.length, 1)
  assert.equal(history[0]?.parts[0]?.type === 'text' && history[0].parts[0].text, '新问题')
  const long = Array.from({ length: 31 }, (_, index) =>
    message(index % 2 ? 'assistant' : 'user', '字'.repeat(1000))
  )
  const trimmed = prepareChatMessages(long)
  assert.equal(trimmed.at(-1)?.id, long.at(-1)?.id)
  assert.equal(chatRequestSchema.safeParse({ messages: trimmed }).success, true)
})

test('限流同时约束并发和次数，重复释放不会增加额外名额', () => {
  const enter = createRequestGate()
  const releases = [enter(), enter(), enter()]
  assert.equal(enter(), null)
  releases[0]?.()
  releases[0]?.()
  const next = enter()
  assert.ok(next)
  assert.equal(enter(), null)
  next()
  releases[1]?.()
  releases[2]?.()
  for (let index = 4; index < 30; index++) {
    const release = enter()
    assert.ok(release)
    release()
  }
  assert.equal(enter(), null)
})

test('来源检查、未配置密钥及限流请求不会调用模型', async () => {
  const forbiddenReply = async (): Promise<never> => { throw new Error('不应调用模型') }
  const unavailable = createChatHandler({ isConfigured: () => false, reply: forbiddenReply })
  assert.equal((await unavailable(request())).status, 503)
  assert.equal((await unavailable(request({}, {
    headers: { 'Content-Type': 'application/json', Origin: 'https://other.example' },
  }))).status, 403)
  const limited = createChatHandler({ isConfigured: () => true, enter: () => null, reply: forbiddenReply })
  const response = await limited(request())
  assert.equal(response.status, 429)
  assert.equal(response.headers.get('retry-after'), '60')
})

test('真实 AI SDK 流协议可被前端 transport 读取，保留多轮上下文和系统资料', async () => {
  const model = successModel()
  let releaseCount = 0
  const handler = createChatHandler({
    isConfigured: () => true,
    reply: (messages, signal) => streamProjectReply(messages, signal, model),
    enter: () => () => { releaseCount += 1 },
  })
  const messages = [
    message('user', '这个项目是谁开发的？'),
    message('assistant', 'cheesee9 独立开发。'),
    message('user', '它完成了吗？'),
  ]
  const transport = new DefaultChatTransport({
    api: 'http://localhost:3000/api/chat',
    fetch: async (input, init) => handler(new Request(String(input), init)),
    prepareSendMessagesRequest: ({ messages }) => ({ body: { messages: prepareChatMessages(messages) } }),
  })
  const stream = await transport.sendMessages({
    trigger: 'submit-message', chatId: 'test-chat', messageId: undefined,
    messages, abortSignal: new AbortController().signal,
  })
  let final: UIMessage | undefined
  for await (const snapshot of readUIMessageStream({ stream, terminateOnError: true })) final = snapshot
  assert.equal(final?.parts.filter((part) => part.type === 'text').map((part) => part.text).join(''),
    '由 cheesee9 独立开发，已完成并部署使用。')
  const call = model.doStreamCalls[0]
  assert.ok(call)
  assert.deepEqual(call.prompt.map((item) => item.role), ['system', 'user', 'assistant', 'user'])
  assert.match(String(call.prompt[0]?.content), /奶牛行为智能检测系统/)
  assert.match(String(call.prompt[0]?.content), /目前公开资料没有说明/)
  assert.equal(releaseCount, 1)
})

test('模型原始错误被隐藏，不重试且释放名额', async () => {
  const model = new MockLanguageModelV4({
    doStream: async () => { throw new Error('provider secret-token sensitive payload') },
  })
  let released = false
  const handler = createChatHandler({
    isConfigured: () => true,
    reply: (messages, signal) => streamProjectReply(messages, signal, model),
    enter: () => () => { released = true },
  })
  const response = await handler(request())
  const body = await response.text()
  assert.match(body, /项目助手暂时无法回复/)
  assert.doesNotMatch(body, /secret-token|sensitive payload/)
  assert.equal(model.doStreamCalls.length, 1)
  assert.equal(released, true)
})

function waitingModel() {
  let aborted = false
  let markStarted!: () => void
  const started = new Promise<void>((resolve) => { markStarted = resolve })
  const model = new MockLanguageModelV4({
    doStream: async ({ abortSignal }) => {
      markStarted()
      return {
        stream: new ReadableStream({
          start(controller) {
            const abort = () => {
              aborted = true
              controller.error(new DOMException('Aborted', 'AbortError'))
            }
            if (abortSignal?.aborted) abort()
            else abortSignal?.addEventListener('abort', abort, { once: true })
          },
        }),
      }
    },
  })
  return { model, started, wasAborted: () => aborted }
}

test('服务端超时终止模型并给前端返回可见错误', { timeout: 3000 }, async () => {
  const waiting = waitingModel()
  const handler = createChatHandler({
    isConfigured: () => true, timeoutMs: 50,
    reply: (messages, signal) => streamProjectReply(messages, signal, waiting.model),
  })
  const response = await handler(request())
  const body = await response.text()
  assert.equal(waiting.wasAborted(), true)
  assert.match(body, /回复超时/)
})

test('用户中止请求会传递到模型并释放并发名额', { timeout: 3000 }, async () => {
  const waiting = waitingModel()
  const controller = new AbortController()
  let released = false
  const handler = createChatHandler({
    isConfigured: () => true,
    enter: () => () => { released = true },
    reply: (messages, signal) => streamProjectReply(messages, signal, waiting.model),
  })
  const response = await handler(request(undefined, { signal: controller.signal }))
  const result = response.text()
  await waiting.started
  controller.abort()
  await result
  assert.equal(waiting.wasAborted(), true)
  assert.equal(released, true)
})
