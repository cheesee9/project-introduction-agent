# cheesee9 项目助手

从个人网站独立分离的项目问答应用，介绍「奶牛行为智能检测系统」。当前仅包含一个会话页面，不包含博客、网站导航、Mastra 或持久化会话。

## 技术栈

- Next.js App Router、React、TypeScript
- Tailwind CSS、shadcn/ui（官方 CLI 添加的 Button、Badge、Card、Textarea、Alert）
- AI SDK Core + AI SDK React，通过 AI Gateway 调用 `openai/gpt-4o-mini`
- Zod 请求校验，pnpm 管理依赖

保留已有 ai、dotenv、zod、tsx、TypeScript 依赖和 pnpm 配置，在其基础上补充 Next.js 所需配置。Next.js 自动加载环境变量，应用不需要手动调用 dotenv。安装过程中 pnpm 可能在 workspace 配置内记录已接受的依赖版本。

## 本地运行

使用 Node.js 22.13+（本项目验证环境为 Node.js 24）和项目指定的 pnpm 11.17.0。

已有 `.env` 继续使用；首次配置可参考 `.env.example`：

```dotenv
AI_GATEWAY_API_KEY=你的密钥
```

密钥只能保存在服务端环境变量中，不使用 NEXT_PUBLIC_ 前缀，不提交环境文件。

```sh
pnpm install --frozen-lockfile
pnpm dev
```

打开 http://localhost:3000 。如果端口占用：`pnpm dev --port 3001`。

## 路由

| 路由 | 用途 |
| --- | --- |
| GET / | 唯一会话页面 |
| POST /api/chat | 流式聊天接口，不是额外页面 |

支持推荐问题、多轮对话、流式回复、停止生成、清空会话、失败后重试，以及 Ctrl/⌘ + Enter 发送。刷新页面会清空会话。

## 文件分工

| 文件 | 用途 |
| --- | --- |
| app/page.tsx | 页面布局、项目摘要，向前端传递密钥是否已配置 |
| app/layout.tsx、app/globals.css | 中文文档、元信息、Tailwind 和主题 |
| components/AgentChat.tsx | useChat、输入状态、流式展示和交互 |
| components/ui/ | shadcn/ui 组件源码 |
| data/agentKnowledge.ts | 已确认项目资料和推荐问题 |
| lib/agent.ts | 模型名称、系统提示词、streamText 调用 |
| app/api/chat/route.ts | Next.js 接口入口 |
| lib/chat-handler.ts | 来源检查、流式响应、超时与取消 |
| lib/chat-request.ts | Zod 校验、请求大小限制、单进程限流 |
| lib/chat-messages.ts、lib/chat-limits.ts | 文本历史整理与共享限制 |
| tests/chat.test.ts | 离线协议、校验、错误和取消测试 |
| components.json | shadcn/ui 配置，可继续通过 CLI 添加组件 |

更新项目事实修改 `data/agentKnowledge.ts`；调整回答规则或模型修改 `lib/agent.ts`。项目资料直接放入系统提示词，不进行运行时网页抓取或向量检索。

## 检查与部署

```sh
pnpm test
pnpm typecheck
pnpm build
pnpm start
```

测试使用 AI SDK 模拟模型，不读取真实密钥，不产生模型调用费用。生产启动前需要先构建。

部署到支持 Next.js 服务端的平台，设置 AI_GATEWAY_API_KEY，保留服务端运行能力；不能部署为纯静态 GitHub Pages。模型服务的可用性取决于 Gateway 密钥权限、额度和供应商状态。

## 当前边界

- 只介绍项目，不承诺报价、工期或代替作者接单。
- 不持久保存会话、不写对话日志。发送的消息和最近的历史会通过 AI Gateway 交给模型服务处理，第三方的数据处理遵循其自身政策。
- 输入最多 2000 字符，上下文最多 20 条、12000 字符，请求体最多 48 KiB；长历史由客户端自动裁剪。
- 每个服务进程每分钟最多 30 次请求、最多 3 个并发；这是基础保护，不是按用户或跨实例的全站配额。公开多实例部署时需在平台增加共享限流。
- 回复 45 秒超时，最多输出 1200 tokens，不自动重试上游请求。
- 来源检查用于浏览器请求，不能代替登录鉴权或防机器人服务。
