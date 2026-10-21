'use client'

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { useActionState, useEffect, useRef, useState } from 'react'
import { ArrowUp, ArrowUpRight, LoaderCircle, RotateCcw, Square, MessageCircle, AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { projectQuestions } from '@/data/agentKnowledge'
import { prepareChatMessages } from '@/lib/chat-messages'
import { MAX_INPUT_LENGTH } from '@/lib/chat-limits'

export default function AgentChat({ configured }: { configured: boolean }) {
  const [transport] = useState(() => new DefaultChatTransport({
    api: '/api/chat',
    prepareSendMessagesRequest: ({ messages }) => ({
      body: { messages: prepareChatMessages(messages) },
    }),
  }))
  const { messages, sendMessage, setMessages, status, error, clearError, stop, regenerate } = useChat({
    transport,
  })
  const [input, setInput] = useState('')
  const [stopped, setStopped] = useState(false)
  const conversation = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const followLatest = useRef(true)
  const generating = status === 'submitted' || status === 'streaming'
  const [, submitAction, isSubmitting] = useActionState(
    async (_previousState: null, formData: FormData) => {
      const value = formData.get('suggestedQuestion') ?? formData.get('question')
      const question = typeof value === 'string' ? value.trim() : ''
      if (!configured || generating || !question || question.length > MAX_INPUT_LENGTH) return null

      clearError()
      setStopped(false)
      followLatest.current = true
      setInput('')
      // 等待本轮流式请求结束，让 Action 的 pending 状态覆盖整个提交过程。
      await sendMessage({ text: question })
      return null
    },
    null
  )
  const busy = isSubmitting || generating

  useEffect(() => {
    if (followLatest.current && conversation.current) {
      conversation.current.scrollTop = messages.length ? conversation.current.scrollHeight : 0
    }
  }, [messages, status])

  function reset() {
    setMessages([])
    clearError()
    setStopped(false)
    setInput('')
    followLatest.current = true
    inputRef.current?.focus()
  }

  return (
    <Card className="min-w-0 gap-0 overflow-hidden border-border/80 py-0 shadow-[0_12px_50px_-24px_rgba(32,51,42,0.25)]">
      <CardHeader className="flex flex-row items-center justify-between gap-3 border-b px-4 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary">
            <MessageCircle className="size-5 text-primary" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-sm font-semibold">cheesee9 的项目助手</h2>
            <p className="mt-1 text-xs text-muted-foreground">奶牛行为智能检测系统</p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="清空会话"
          title="清空会话"
          disabled={busy || messages.length === 0}
          onClick={reset}
        >
          <RotateCcw className="size-4" aria-hidden="true" />
        </Button>
      </CardHeader>

      {!configured && (
        <Alert className="mx-4 mt-4 w-auto" role="status">
          <AlertCircle aria-hidden="true" />
          <AlertDescription>
            项目助手暂未开放对话。你可以先通过页面顶部的链接查看项目源码。
          </AlertDescription>
        </Alert>
      )}

      <CardContent className="p-0">
        <div
          ref={conversation}
          role="log"
          aria-label="对话记录"
          aria-live="polite"
          aria-busy={busy}
          tabIndex={0}
          onScroll={() => {
            const element = conversation.current
            if (element) followLatest.current =
              element.scrollHeight - element.scrollTop - element.clientHeight < 80
          }}
          className="h-[clamp(22rem,47dvh,34rem)] space-y-6 overflow-y-auto overscroll-contain px-4 py-6 sm:px-6"
        >
          {messages.length === 0 ? (
            <div className="flex min-h-full flex-col justify-center py-1">
              <h3 className="text-xl font-semibold tracking-tight">你好，想了解项目的哪一面？</h3>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                功能、技术选择，或是完成情况。选一个问题，也可以直接问我。
              </p>
              <div className="mt-6 flex flex-col items-start gap-2">
                {projectQuestions.map((question) => (
                  <Button
                    key={question}
                    type="submit"
                    form="agent-chat-form"
                    name="suggestedQuestion"
                    value={question}
                    variant="outline"
                    disabled={!configured || busy}
                    className="h-auto max-w-full justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-normal whitespace-normal"
                  >
                    {question}
                    <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  </Button>
                ))}
              </div>
            </div>
          ) : messages.map((message) => (
            <div key={message.id} className={message.role === 'user' ? 'ml-auto max-w-[90%]' : 'max-w-[96%]'}>
              <p className="mb-2 text-xs text-muted-foreground">{message.role === 'user' ? '你' : '项目助手'}</p>
              <div className={message.role === 'user'
                ? 'rounded-2xl rounded-tr-sm bg-secondary px-4 py-3 text-sm leading-7'
                : 'text-sm leading-7'}>
                {message.parts.map((part, index) => part.type === 'text' ? (
                  <p key={index} className="whitespace-pre-wrap [overflow-wrap:anywhere]">{part.text}</p>
                ) : null)}
              </div>
            </div>
          ))}
          {status === 'submitted' && (
            <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              正在阅读你的问题…
            </p>
          )}
        </div>

        <div className="border-t bg-muted/30 p-4 sm:p-5">
          {error && (
            <Alert variant="destructive" className="mb-3">
              <AlertCircle aria-hidden="true" />
              <AlertDescription>
                <p>本次回复未完成，服务可能暂不可用或请求过于频繁。已有回复可能不完整。</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2 w-fit"
                  disabled={busy}
                  onClick={() => {
                    clearError()
                    setStopped(false)
                    followLatest.current = true
                    void regenerate()
                  }}
                >重试回复</Button>
              </AlertDescription>
            </Alert>
          )}
          {stopped && !error && !busy && (
            <p role="status" className="mb-3 text-xs text-muted-foreground">已停止生成，当前回复可能不完整。你可以继续提问。</p>
          )}
          <form id="agent-chat-form" action={submitAction}>
            <label htmlFor="agent-question" className="sr-only">你的问题</label>
            <Textarea
              ref={inputRef}
              id="agent-question"
              name="question"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.nativeEvent.isComposing) {
                  event.preventDefault()
                  if (!busy && configured) event.currentTarget.form?.requestSubmit()
                }
              }}
              disabled={!configured || busy}
              maxLength={MAX_INPUT_LENGTH}
              rows={3}
              placeholder="问问项目功能、技术栈，或开发情况…"
              aria-describedby="agent-input-help"
              className="min-h-24 resize-none bg-card text-base shadow-none sm:text-sm"
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <p id="agent-input-help" className="text-xs text-muted-foreground">
                {input.length} / {MAX_INPUT_LENGTH}
                <span className="ml-2 hidden sm:inline">Ctrl / ⌘ + Enter 发送</span>
              </p>
              {busy ? (
                <Button type="button" variant="outline" onClick={() => { setStopped(true); void stop() }}>
                  <Square className="size-3.5" aria-hidden="true" /> 停止生成
                </Button>
              ) : (
                <Button type="submit" disabled={!configured || !input.trim()} className="gap-2">
                  发送 <ArrowUp className="size-4" aria-hidden="true" />
                </Button>
              )}
            </div>
          </form>
          <p className="mt-4 text-[11px] leading-5 text-muted-foreground">
            AI 回答可能有误。内容将通过 AI Gateway 交由模型服务处理，请勿输入敏感信息。
            本站不持久保存会话，刷新后清空；长对话仅发送最近部分作为上下文。
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
