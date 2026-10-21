import { ArrowUpRight, Leaf, Code2, CircleCheck } from 'lucide-react'
import AgentChat from '@/components/AgentChat'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { projectKnowledge } from '@/data/agentKnowledge'

export const dynamic = 'force-dynamic'

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-svh max-w-6xl flex-col px-4 py-5 sm:px-8 sm:py-8">
      <header className="mb-7 flex items-center justify-between gap-4 border-b pb-5">
        <a href="/" className="flex items-center gap-3" aria-label="cheesee9 项目助手首页">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Leaf className="size-5" aria-hidden="true" />
          </span>
          <span>
            <span className="block text-sm font-semibold tracking-wide">cheesee9</span>
            <span className="block text-xs text-muted-foreground">项目介绍助手</span>
          </span>
        </a>
        <Button variant="outline" size="sm" asChild>
          <a href={projectKnowledge.source} target="_blank" rel="noopener noreferrer">
            项目源码 <ArrowUpRight className="size-4" aria-hidden="true" />
          </a>
        </Button>
      </header>

      <div className="grid flex-1 items-start gap-7 lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-10">
        <aside className="space-y-5 pt-1 lg:pt-6" aria-label="项目资料">
          <Badge variant="secondary" className="gap-1.5">
            <CircleCheck className="size-3.5" aria-hidden="true" /> 已完成 · 已部署使用
          </Badge>
          <div>
            <p className="mb-3 text-xs font-medium tracking-[0.18em] text-muted-foreground">PROJECT / 01</p>
            <h1 className="text-2xl leading-snug font-semibold tracking-tight sm:text-3xl">
              从一个问题，<br className="hidden lg:block" />了解我的项目。
            </h1>
            <p className="mt-4 max-w-lg text-sm leading-7 text-muted-foreground">
              我是 cheesee9，一名 TypeScript 全栈开发者。这位助手可以介绍我独立开发的奶牛行为智能检测系统。
            </p>
          </div>
          <div className="hidden space-y-4 border-t pt-5 lg:block">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Code2 className="size-4" aria-hidden="true" /> 关于这个项目
            </div>
            <p className="text-sm leading-7 text-muted-foreground">
              从图片、视频到实时监控，用行为检测辅助观察奶牛的日常状态。
            </p>
            <div className="flex flex-wrap gap-2">
              {['Next.js', 'TypeScript', 'YOLOv11', 'ONNX'].map((technology) => (
                <Badge key={technology} variant="outline" className="font-normal">{technology}</Badge>
              ))}
            </div>
            <p className="text-xs leading-6 text-muted-foreground">
              回答依据已整理的项目资料。涉及实现细节，请以项目源码为准。
            </p>
          </div>
        </aside>

        <AgentChat configured={Boolean(process.env.AI_GATEWAY_API_KEY?.trim())} />
      </div>
      <footer className="pt-6 text-center text-xs text-muted-foreground lg:text-right">
        cheesee9 · 用对话认识一个真实项目
      </footer>
    </main>
  )
}
