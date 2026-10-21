import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'cheesee9 · 项目助手',
  description: '通过对话了解 cheesee9 独立开发的奶牛行为智能检测系统。',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
