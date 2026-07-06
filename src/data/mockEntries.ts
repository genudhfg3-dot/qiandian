import type {
  Entry,
  Tag,
  TagCategory,
} from '../domain/knowledge'

export const mockTagCategories: TagCategory[] = [
  { id: 'work', name: '工作', parentId: null, color: 'work', sortOrder: 1 },
  { id: 'reading', name: '阅读', parentId: null, color: 'reading', sortOrder: 2 },
  { id: 'inspiration', name: '灵感', parentId: null, color: 'inspiration', sortOrder: 3 },
  { id: 'tools', name: '工具', parentId: null, color: 'tools', sortOrder: 4 },
  { id: 'personal', name: '个人', parentId: null, color: 'personal', sortOrder: 5 },
  { id: 'uncategorized', name: '未分类', parentId: null, color: 'uncategorized', sortOrder: 6 },
]

export const mockTags: Tag[] = [
  { id: 'product', name: '产品', categoryId: 'work', color: 'work' },
  { id: 'engineering', name: '研发', categoryId: 'work', color: 'work' },
  { id: 'paper', name: '论文', categoryId: 'reading', color: 'reading' },
  { id: 'article', name: '文章', categoryId: 'reading', color: 'reading' },
  { id: 'design', name: '设计', categoryId: 'inspiration', color: 'inspiration' },
  { id: 'writing', name: '表达', categoryId: 'inspiration', color: 'inspiration' },
]

const byId = new Map(mockTags.map((tag) => [tag.id, tag]))
const tagRefs = (ids: string[]) =>
  ids.map((id) => {
    const tag = byId.get(id)
    if (!tag) {
      throw new Error(`Unknown mock tag: ${id}`)
    }
    return tag
  })

export const mockEntries: Entry[] = [
  {
    id: '1',
    title: 'SQLite + FTS5 的中文分词坑',
    contentMd:
      '默认 unicode61 tokenizer 把中文当一整段，没法做子句搜索。jieba 或 simple+trigram 是两条路。',
    excerpt: '默认 unicode61 tokenizer 把中文当一整段，没法做子句搜索。jieba 或 simple+trigram 是两条路…',
    images: [],
    source: { app: 'Chrome', title: 'SQLite forum' },
    tags: tagRefs(['engineering']),
    createdAt: Date.parse('2026-06-23T07:30:00+08:00'),
    updatedAt: Date.parse('2026-06-23T07:30:00+08:00'),
  },
  {
    id: '2',
    title: '剪贴板 HTML 的稳定读法',
    contentMd:
      'Windows 下 Office 系包装的 fragment 要剥壳再交给 turndown，常见的几种 wrapper 处理方法对比。',
    excerpt: 'Windows 下 Office 系包装的 fragment 要剥壳再交给 turndown，常见的几种 wrapper 处理方法对比…',
    images: ['images/clipboard-html.png'],
    source: { app: 'Chrome' },
    tags: tagRefs(['engineering', 'design']),
    createdAt: Date.parse('2026-06-22T16:20:00+08:00'),
    updatedAt: Date.parse('2026-06-22T16:20:00+08:00'),
  },
  {
    id: '3',
    title: '打标签挤进一栏的几种 UX',
    contentMd:
      'Notion / Linear / Things 多层下拉做法对比，关键差异在分组渲染与键盘新建的回路。',
    excerpt: 'Notion / Linear / Things 多层下拉做法对比，关键差异在分组渲染与键盘新建的回路…',
    images: [],
    source: { app: 'Chrome' },
    tags: tagRefs(['engineering', 'design']),
    createdAt: Date.parse('2026-06-20T11:40:00+08:00'),
    updatedAt: Date.parse('2026-06-20T11:40:00+08:00'),
  },
  {
    id: '4',
    title: '把笔记当作思考的延伸，而不是归档',
    contentMd:
      '真正的知识库不是抽屉，而是接力棒。重要的从来不是"存在哪里"，而是"什么时候被再次拿起"。',
    excerpt: '真正的知识库不是抽屉，而是接力棒。重要的从来不是"存在哪里"，而是"什么时候被再次拿起"。',
    images: ['images/latent-space.png'],
    source: { app: 'Chrome', title: 'Latent Space' },
    tags: tagRefs(['article', 'writing']),
    createdAt: Date.parse('2026-06-16T09:10:00+08:00'),
    updatedAt: Date.parse('2026-06-16T09:10:00+08:00'),
  },
  {
    id: '5',
    title: 'WYSIWYG 编辑器选 TipTap 还是 Milkdown',
    contentMd:
      'TipTap 生态成熟、文档全，Markdown 扩展用 markdown-it。Milkdown 原生 Markdown、插件化更彻底但生态偏小。',
    excerpt: 'TipTap 生态成熟、文档全，Markdown 扩展用 markdown-it。Milkdown 原生 Markdown、插件化更彻底但生态偏小。',
    images: [],
    source: { app: 'Chrome' },
    tags: tagRefs(['engineering']),
    createdAt: Date.parse('2026-06-15T14:30:00+08:00'),
    updatedAt: Date.parse('2026-06-15T14:30:00+08:00'),
  },
]
