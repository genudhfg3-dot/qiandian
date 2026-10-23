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
    version: '1.2.2',
    date: '2026-10-23',
    sections: [{ title: '问答窗口修复', items: ['修复连续问答后输入栏下方出现大块空白、窗口出现双层滚动条的问题。长回答仅在消息区滚动，输入栏始终保持在底部。'] }],
  },
  {
    version: '1.2.1',
    date: '2026-10-21',
    sections: [{
      title: '收藏与问答，一点即达',
      items: ['保留熟悉的圆形爱心按钮，点击直接快捷收藏；右上角新增 AI 星形角标，点击直接打开随手问，无需再次选择。按住任意区域即可拖动整个按钮。'],
    }],
  },
  {
    version: '1.2.0',
    date: '2026-10-21',
    sections: [
      {
        title: '新增「随手问」助手',
        items: [
          '截图之后，随手问一问：使用 Snipaste 等工具截图并复制，即可通过提示打开助手，针对图片里的内容提问，让日常查阅和理解更方便',
          '看图翻译与答疑：一键翻译图片、提取文字或解释内容，也可以继续追问，围绕同一张图聊清楚',
          '有用的问答随手收藏：将助手的回答连同对话中的原始文字和截图保存到知识库，整理标题和标签后，方便以后查找与复用',
          '不只支持截图：也可以直接输入问题、粘贴文字或图片，选中知识正文中的文字进行翻译和答疑',
          '随时唤起，随时使用：点击悬浮按钮或按默认快捷键 Alt+R 打开助手；可在 AI 设置中自定义快捷键，也可将助手窗口置顶',
          '沿用千点已有的 AI 模型配置，无需重复填写；请使用支持图片理解（视觉／多模态）的大模型，纯文字模型无法处理截图',
        ],
      },
    ],
  },
  {
    version: '1.0.9',
    date: '2026-07-27',
    sections: [
      {
        title: '新增功能',
        items: [
          '知识详情正文新增三套可切换的外观方案——D 底线粗细分层、E 色彩字重、F 彩色锚点，标题层级和装饰线各有不同风格',
          '左侧筛选栏底部新增「正文外观」切换器，选择会持久化保存到本地，重启后保留',
        ],
      },
      {
        title: '稳定性修复',
        items: [
          '修复删除某条知识后再点击其他知识进入编辑时,标题和内容无法编辑的问题——切换条目时未正确退出编辑模式并重置草稿,导致旧草稿残留覆盖了新条目数据',
          '修复编辑过程中切换条目时偶发的草稿错乱问题——加入竞态保护,快速切换时旧请求结果不会覆盖新条目',
          '修复删除标签后偶发的编辑状态卡死问题',
        ],
      },
      {
        title: '体验优化',
        items: [
          '知识详情正文文字加深为 ink 色,对比度提升,长时间阅读更舒适',
          '列表项符号改为 terracotta 色,与正文形成节奏感',
        ],
      },
    ],
  },
  {
    version: '1.0.8',
    date: '2026-07-13',
    sections: [
      {
        title: '稳定性修复',
        items: [
          '修复快速笔记里粘贴 Excel/WPS 表格被误判成图片的问题——这类来源复制表格时会额外附带一张兜底截图，之前优先识别成了图片粘贴，现在优先按表格解析',
        ],
      },
    ],
  },
  {
    version: '1.0.7',
    date: '2026-07-13',
    sections: [
      {
        title: '新增功能',
        items: [
          '快速笔记和知识详情现在支持粘贴表格——从 Excel/WPS 复制的表格可以直接粘贴，自动转换成标准表格显示',
          '知识列表卡片遇到表格内容会收成一行摘要，不占用预览空间；打开详情页可看到完整表格',
        ],
      },
    ],
  },
  {
    version: '1.0.6',
    date: '2026-07-08',
    sections: [
      {
        title: '稳定性修复',
        items: [
          '修复知识库页面在部分显卡/驱动环境下整页显示为纯色、看不到任何内容的问题——移除有兼容性风险的自定义标题栏渲染方式，改回系统标准标题栏',
        ],
      },
      {
        title: '性能优化',
        items: [
          '搜索输入加入防抖，停止打字后才真正查询，减少无意义的数据库扫描',
          '知识列表预览不再对超长正文做全文处理，只取前段内容用于预览，大幅降低长文章较多时的列表渲染耗时',
        ],
      },
    ],
  },
  {
    version: '1.0.5',
    date: '2026-07-08',
    sections: [
      {
        title: '稳定性修复',
        items: [
          '修复手动填写的标题在 AI 生成摘要后被悄悄改动的问题——标题现在有持久化的"手动/自动"标记，不再靠字符串猜测',
          '标题保护下沉到数据层：即使调用方出错，仓库层也会拒绝覆盖手动标题',
        ],
      },
    ],
  },
  {
    version: '1.0.4',
    date: '2026-07-07',
    sections: [
      {
        title: '稳定性修复',
        items: [
          '清空默认笔记后再次启动不再报「知识库尚未初始化」——seed 逻辑改用持久化标记,老库启动时自动补齐,不会重复插入分类',
          '初始化 seed 失败不再阻塞 IPC,数据库照常可用',
        ],
      },
      {
        title: '编辑器修复',
        items: [
          '快速笔记里图文混合的笔记,关闭再打开不再丢失文字——修复富文本转 Markdown 时 <figure> 内子节点被误吞的问题',
          '图片嵌入到段落内部也能正确保留(inline IMG 转 Markdown 补齐)',
        ],
      },
    ],
  },
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
              <span className="text-ink">{releases[0]?.version ?? '1.0.0'}</span>
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
