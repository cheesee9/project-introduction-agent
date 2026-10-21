// 仅使用作者和项目 README 已确认的资料，不在运行时抓取外部内容。
export const projectKnowledge = {
  name: '奶牛行为智能检测系统',
  developer: 'cheesee9',
  ownership: 'cheesee9 个人独立开发',
  status: '已完成，并已部署使用',
  purpose: '通过牛只行为检测、监控与告警，辅助观察奶牛日常行为。',
  features: [
    '支持图片、视频及本地摄像头检测，识别站立、行走、躺卧、进食、饮水等行为。',
    '提供监控画面、行为分布统计、历史告警和异常行为提醒。',
    '支持切换 ONNX 模型、调整检测置信度，并保存检测结果供历史回溯。',
  ],
  technologies: {
    application: 'Next.js、React、TypeScript、Tailwind CSS',
    inference: 'YOLOv11 与 ONNX Runtime Web，支持浏览器端推理',
    backend: 'Next.js API Routes、Prisma、PostgreSQL',
  },
  source: 'https://github.com/cheesee9/cow-behavior-detection',
  unknowns: '未提供准确率、训练数据来源、模型训练分工、客户信息、使用规模及性能实测数据。',
}

export const projectQuestions = [
  '这个项目解决什么问题？',
  '项目用了哪些技术？',
  '这是你独立开发的吗？现在完成了吗？',
]
