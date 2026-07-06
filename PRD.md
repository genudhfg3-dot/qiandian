# 个人知识库桌面应用 · PRD 与开发计划(v2)

> 用途:本文件作为 vibe coding 的总纲,可直接交给 Claude Code / Codex 逐阶段实现。
> 原则:本地优先、单人使用、界面精简美观、操作快;先把最难的 10% 绕过去,用最稳的方式拿到 90% 的价值。

---

## 1. 产品目标

一个常驻桌面的个人知识库工具。看到任何有价值的内容(图文),用最少的动作收进库里,补上标签和来源,之后能按时间 / 标签 / 来源快速回溯。

**一句话定位**:复制一下、点一下、打个标签,知识就沉淀下来了。

---

## 2. 已锁定的产品决定(v2)

| 主题 | 决定 |
|---|---|
| 捕获方式 | 主路径:屏幕常驻置顶小按钮,先复制(⌘/Ctrl+C)再点它,把剪贴板吸进来。辅助:可绑全局热键 |
| 内容格式 | 统一以 **Markdown** 为存储载体,编辑用富文本(所见即所得),按需在富文本/源码间切换。**图片内联在正文中**,不再作为独立附件 |
| 剪贴板自动转换 | HTML(带格式)→ 转 Markdown;纯文本 → 原样;图片 → 落盘并以 `![](images/xxx.png)` 内联插入。图文混合则混合处理 |
| 来源 | 用户不手填。用 `active-win` 自动抓应用名、窗口标题;URL 尽力而为,抓不到接受为空 |
| 标签(捕获时) | **只占一栏**。点击下拉选择(**分类支持至少两层**);直接输入文字 + 回车即新建标签 |
| 标签管理 | 独立管理页,管理分类(多层)与标签归属:新建/重命名/合并/删除、拖动改分类 |
| 前台筛选 | 按时间 / 标签 / 来源筛;时间支持**正序、倒序**切换 |
| 前台标签展示 | 更专业的标签区:按分类分组、带使用数量、可点选筛选,已选标签以筛选条呈现 |
| 视觉与操作 | 见第 3 节设计原则:精简、留白、键盘可达、即点即存 |
| 存储 | 全本地,SQLite + 本地图片文件夹,不上传任何服务器 |

**明确推到 v2.x / 以后的功能**:
- 划词即浮现按钮(全局选区监听 + 无障碍 API);第一版用"复制 + 点按钮 / 热键"代替。
- 浏览器内精确抓取网页 URL。
- 跨设备同步。

---

## 3. 视觉与交互设计原则

- **精简**:捕获窗只保留正文、来源一行、标签一栏、保存一键;次要信息收起。
- **美观**:统一圆角、0.5px 细边、克制配色;标签按分类配色,卡片留白充足;支持浅/深色。
- **快**:全程键盘可达 —— 捕获后焦点落在正文;`⌘/Ctrl+↵` 保存;标签栏可纯键盘选择与新建。
- **即时反馈**:保存后给轻量 toast,不打断;捕获窗保存即关。

---

## 4. 数据模型(SQLite)

```sql
CREATE TABLE entries (
  id            INTEGER PRIMARY KEY,
  title         TEXT,                 -- 可由用户填或取正文首行
  content_md    TEXT NOT NULL,        -- 正文,统一 Markdown(图片以 ![](images/xxx) 内联)
  source_app    TEXT,                 -- 例:Chrome / Word / Preview
  source_title  TEXT,                 -- 前台窗口标题
  source_url    TEXT,                 -- 尽力而为,可为空
  created_at    INTEGER NOT NULL,     -- Unix 毫秒
  updated_at    INTEGER NOT NULL
);

-- 图片仍落盘成文件;此表只用于文件生命周期管理(找孤儿文件/级联清理),
-- 不作为"附件"展示 —— 展示永远在正文内联。
CREATE TABLE images (
  id         INTEGER PRIMARY KEY,
  entry_id   INTEGER REFERENCES entries(id) ON DELETE CASCADE,
  file_path  TEXT NOT NULL,           -- 相对 appData/images 的路径
  created_at INTEGER NOT NULL
);

-- 分类支持多层:parent_id 自引用
CREATE TABLE tag_categories (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  parent_id  INTEGER REFERENCES tag_categories(id) ON DELETE SET NULL,
  color      TEXT,                     -- 前台标签配色
  sort_order INTEGER DEFAULT 0,
  UNIQUE(parent_id, name)
);

CREATE TABLE tags (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  category_id INTEGER REFERENCES tag_categories(id) ON DELETE SET NULL  -- 挂在最末级分类上;空=未分类
);

CREATE TABLE entry_tags (
  entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  tag_id   INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (entry_id, tag_id)
);

CREATE VIRTUAL TABLE entries_fts USING fts5(title, content_md, content='entries', content_rowid='id');
```

查询模式:
- 时间正/倒序:`ORDER BY created_at ASC | DESC`
- 按时间段:`WHERE created_at BETWEEN ? AND ?`
- 按标签:`JOIN entry_tags ... WHERE tag_id IN (...)`(多标签可 AND/OR)
- 按来源:`WHERE source_app = ?`
- 搜索:`entries_fts MATCH ?`
- 标签计数(前台展示用):`SELECT tag_id, COUNT(*) ... GROUP BY tag_id`

---

## 5. 关键流程细节

### 5.1 捕获(主路径)
1. 用户在任意软件复制内容(⌘/Ctrl+C)。
2. 点击置顶小按钮(或按全局热键)。
3. 主进程读剪贴板并**按格式自动转换**:
   - `clipboard.readHTML()` 非空 → 用 `turndown` 转 Markdown。
   - 否则 `clipboard.readText()` → 原样作为 Markdown。
   - `clipboard.readImage()` 非空 → 存 `appData/images/{uuid}.png`,在正文相应位置插入 `![](images/{uuid}.png)`,并在 images 表登记。
4. 取来源(见 5.3),打开捕获窗,字段预填,焦点落在正文。

### 5.2 编辑 + 打标签
- **编辑器**:富文本(WYSIWYG)读写 Markdown,图片内联渲染。推荐 TipTap(+ markdown 扩展)或 Milkdown;轻量可用 `@uiw/react-md-editor`。提供"富文本 / 源码"切换。
- **标签栏(单栏)**:
  - 已选标签为可删除 chip;右侧 chevron 点开下拉。
  - 下拉按**两层及以上分类**分组罗列历史标签,支持键盘上下选择、自动补全。
  - 输入框输入文字 + 回车 → 新建标签(默认归"未分类",可在管理页归类)。
- 保存 → 写 entries / entry_tags,新标签写 tags;`⌘/Ctrl+↵` 触发。

### 5.3 来源自动捕获
- **热键路径**:按键瞬间前台应用即来源,直接 `activeWin()`。
- **点按钮路径**:点按钮会抢焦点,需"上一个外部前台窗口"。主进程每 ~1s 轮询 `activeWin()`,忽略本应用,缓存 `lastExternalWindow`,捕获时取该缓存。
- URL:macOS 对部分浏览器可返回(需屏幕录制/辅助功能权限);Windows 多数拿不到。拿不到置空,不阻塞保存。

---

## 6. 分阶段开发计划(可逐段喂给 AI)

每阶段给「目标 / 交付物 / 验收标准」。建议每阶段独立分支,跑通验收再进下一段。

### Phase 0 · 脚手架
- 目标:跑起空 Electron + Vite + React 应用。
- 交付物:可启动主窗口;`electron-rebuild` 配进 `postinstall`。
- 验收:`npm run dev` 能开窗;原生模块编译通过。

### Phase 1 · 数据层
- 目标:落地第 4 节 schema + 主进程数据访问层 + IPC 通道。
- 交付物:建表/迁移、CRUD、`contextBridge` 安全 API。
- 验收:能通过 IPC 新建/读取 entry、tag、分类(含父子分类)。

### Phase 2 · 捕获触发 + 剪贴板转换
- 目标:置顶小按钮 + 全局热键;读剪贴板并按 5.1 自动转 Markdown;图片落盘内联。
- 交付物:无边框 always-on-top 小按钮窗;`globalShortcut`;`turndown` 接入;图片保存与内联插入。
- 验收:复制带格式网页内容→正文为对应 Markdown;复制图片→正文内联显示且文件已存盘。

### Phase 3 · 编辑器 + 单栏标签
- 目标:富文本/Markdown 编辑器(图片内联);单栏标签下拉(两层分类、回车新建);保存进库。
- 交付物:编辑器组件;标签选择器组件(分组下拉 + 自动补全 + 键盘操作);保存逻辑。
- 验收:能改正文、切换富文本/源码;能下拉选标签、回车新建;`⌘/Ctrl+↵` 保存后数据正确。

### Phase 4 · 来源捕获
- 目标:接入 `active-win`,实现 5.3 两条路径。
- 交付物:`lastExternalWindow` 轮询缓存;写入 source 字段。
- 验收:从 Chrome / Word 复制后捕获,来源分别正确显示。

### Phase 5 · 标签管理页
- 目标:管理多层分类与标签归属。
- 交付物:分类树(可展开/折叠、新建子分类);标签列表(重命名、合并、删除、拖动改分类、使用次数)。
- 验收:能建两层以上分类;能把标签从一个分类拖到另一个;合并标签后引用关系正确迁移。

### Phase 6 · 知识库前台
- 目标:列表 + 时间正倒序 + 按标签/来源筛 + 搜索 + 查看/编辑/删除。
- 交付物:前台页;时间正倒序切换;按分类分组、带数量的标签筛选面板;已选筛选条;条目卡片(富文本预览 + 内联图缩略 + 分类配色标签);详情/编辑视图。
- 验收:正倒序、三类筛选、搜索均正确;删条目级联清理标签关联与孤儿图片文件。

### Phase 7 · 打磨与打包
- 目标:托盘图标、开机自启(可选)、打包;浅深色统一;toast 反馈。
- 交付物:tray 菜单;`electron-builder` 配置;安装包。
- 验收:关闭主窗仍驻留托盘;产出可安装包;深色模式无失效配色。

---

## 7. 建议的 AI 分工(Claude Code + Codex)

- **Claude Code**:Phase 0/1/2/4 —— Electron 主进程、原生模块、IPC、剪贴板转换、系统权限,多文件强上下文、需终端反复调,在仓库里迭代最顺。
- **Codex**:Phase 3/5/6 里自包含的 React 组件(编辑器封装、标签选择器、分类树、条目卡片、筛选面板),给清 props 与数据结构后独立产出再贴回。
- 把本 PRD 的「数据模型」「关键流程细节」「设计原则」三节作为共享上下文喂给两者,避免接口与风格不一致。

---

## 8. 推荐依赖
- `better-sqlite3`(库)、`active-win`(来源)、`turndown`(HTML→MD)
- 编辑器:`@tiptap/react`(+ markdown)或 `milkdown`,或轻量 `@uiw/react-md-editor`
- 渲染预览:`markdown-it` / `marked`
- 打包:`electron-builder`;原生模块:`@electron/rebuild`

## 9. 非功能要求
- **隐私**:库 + 图片只存本地 appData,绝不外发。
- **健壮**:剪贴板为空、图片解码失败、来源/URL 抓取失败,都不阻塞保存。
- **可迁移**:库文件单独可备份;预留"导出 Markdown / JSON"入口。

## 10. 待定 / 以后
- 划词即浮现按钮;浏览器精确 URL;跨设备同步;标签的批量管理与智能推荐。
