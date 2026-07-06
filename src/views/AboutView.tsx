import { Link } from 'react-router-dom'

interface ReleaseSection {
  title: string
  items: string[]
}

interface Release {
  version: string
  date: string
  sections: ReleaseSection[]
}

const releases: Release[] = [
  {
    version: '1.0.3',
    date: '2026-07-06',
    sections: [
      {
        title: '体验优化',
        items: [
          '知识入库后再次编辑正文不再触发 AI 重新生成标题/摘要/标签，手动「重新生成」不受影响',
        ],
      },
    ],
  },
  {
    version: '1.0.2',
    date: '2026-07-06',
    sections: [
      {
        title: '体验优化',
        items: [
          '快速创建时手动写的标题不再被 AI 覆盖，仅在未写标题时使用 AI 生成',
        ],
      },
    ],
  },
  {
    version: '1.0.1',
    date: '2026-07-06',
    sections: [
      {
        title: '稳定性修复',
        items: [
          '数据库损坏时自动检测并重建，不再卡在"知识库尚未初始化"',
          '启动初始化失败不再阻塞应用，延迟到首次使用时自动恢复',
        ],
      },
    ],
  },
  {
    version: '1.0.0',
    date: '2026-07-03',
    sections: [
      {
        title: '捕获与编辑',
        items: [
          '全局快捷键 Ctrl+Shift+K 唤起快速笔记窗口',
          '常驻悬浮按钮,按住可拖动摆放,短按打开捕获窗',
          '剪贴板 HTML 自动转 Markdown,纯文本原样保留',
          '剪贴板图片自动落盘并以 ![](images/xxx.png) 内联到正文',
          '富文本编辑,支持加粗、变色、变字号、高亮',
          '来源自动识别:应用名、窗口标题、URL(尽力而为)',
          '编辑窗关闭自动保存,意外退出后可恢复未保存草稿',
        ],
      },
      {
        title: '知识库与检索',
        items: [
          '全部数据存本地 SQLite + 本地图片目录,不上传任何服务器',
          'FTS5 全文检索,覆盖标题、正文、摘要、来源',
          '按标签、来源应用、创建时间(正序 / 倒序)组合筛选',
          '三栏工作台:筛选侧栏 + 列表 + 详情始终共存',
          '列表 / 详情分栏宽度可拖动调整,记忆到本地',
        ],
      },
      {
        title: '标签体系',
        items: [
          '分类 · 标签两级结构,标签可跨分类移动',
          '八色调色板,新分类自动轮换分配颜色',
          '已有分类颜色随时可改,点色块弹出色板选择',
          '独立标签管理页,支持新建 / 重命名 / 删除标签和分类',
          '捕获窗内可搜索已有标签,回车即新建',
        ],
      },
      {
        title: 'AI 元数据',
        items: [
          '兼容 OpenAI Chat Completions 协议,可自配 Base URL 与模型',
          '一键为条目生成标题、三段式摘要(内容总结 / 适用场景 / 关键词)、建议标签',
          '异步队列自动排队生成,不阻塞界面',
          '支持单条重新生成',
          'API Key 通过 Electron safeStorage 加密后存本地',
        ],
      },
      {
        title: '系统集成',
        items: [
          '主窗口自适应屏幕 90% × 88%,居中显示',
          '系统托盘常驻,右键菜单可控制悬浮按钮 / 快速笔记 / 自启动',
          '打包后支持开机自启动',
          '单例锁,防止多开导致数据冲突',
        ],
      },
    ],
  },
]

export function AboutView() {
  return (
    <div className="h-full overflow-y-auto bg-cream px-6 pb-6">
      <div className="mx-auto grid max-w-6xl grid-cols-[200px_1fr] overflow-hidden rounded-[10px] border border-hairline bg-surface">
        <aside className="border-r border-hairline px-3 py-4">
          <div className="grid gap-1">
            <Link to="/" className="rounded-[4px] px-2 py-1.5 text-[12px] text-soft-ink hover:bg-cream-soft hover:text-ink">返回知识库</Link>
            <Link to="/tags" className="rounded-[4px] px-2 py-1.5 text-[12px] text-soft-ink hover:bg-cream-soft hover:text-ink">标签管理</Link>
            <Link to="/settings" className="rounded-[4px] px-2 py-1.5 text-[12px] text-soft-ink hover:bg-cream-soft hover:text-ink">AI 设置</Link>
            <span className="rounded-[4px] bg-ink px-2 py-1.5 text-[12px] font-medium text-cream">关于千点</span>
          </div>
        </aside>
        <main className="px-6 py-5">
          <header className="mb-5">
            <h1 className="font-serif text-[26px] font-medium text-ink">千点</h1>
            <p className="mt-1 text-[13px] text-soft-ink">
              一条一条的知识点,慢慢积累成"千点"。本地优先的个人知识管理工具。
            </p>
          </header>

          <section className="mb-6 grid gap-3 rounded-[8px] border border-hairline bg-cream-soft/40 p-4">
            <div className="grid grid-cols-[80px_1fr] gap-2 text-[13px]">
              <span className="text-faint">系统版本</span>
              <span className="text-ink">1.0.3</span>
            </div>
            <div className="grid grid-cols-[80px_1fr] gap-2 text-[13px]">
              <span className="text-faint">开发人</span>
              <span className="text-ink">Arlene</span>
            </div>
            <div className="grid grid-cols-[80px_1fr] gap-2 text-[13px]">
              <span className="text-faint">建议反馈</span>
              <a href="https://github.com/genudhfg3-dot/qiandian/issues" className="text-teal-deep hover:underline">GitHub Issues</a>
            </div>
          </section>

          <section>
            <h2 className="mb-3 font-serif text-[17px] font-medium text-ink">版本更新记录</h2>
            <ol className="grid gap-3">
              {releases.map((release) => (
                <li key={release.version} className="rounded-[8px] border border-hairline bg-surface/60 p-4">
                  <div className="mb-3 flex items-baseline justify-between">
                    <span className="font-serif text-[15px] font-medium text-ink">v{release.version}</span>
                    <span className="text-[11px] text-faint">{release.date}</span>
                  </div>
                  <div className="grid gap-4">
                    {release.sections.map((section) => (
                      <div key={section.title}>
                        <div className="mb-1.5 text-[12px] font-medium text-ink">{section.title}</div>
                        <ul className="grid gap-1 text-[13px] text-soft-ink">
                          {section.items.map((item, index) => (
                            <li key={index} className="pl-3 before:mr-2 before:content-['·']">{item}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-[11px] text-faint">后续版本更新会追加在此处。</p>
          </section>
        </main>
      </div>
    </div>
  )
}
