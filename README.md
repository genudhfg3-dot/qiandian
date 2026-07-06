# 千点

管理你的碎片化知识~以标签体系为核心的桌面知识管理工具。从任何地方复制内容，点击悬浮按钮，打上标签，知识即刻入库。

> "一条一条的知识点，慢慢积累成千点。"
<img width="3609" height="1845" alt="156a6df7201fc9add26593aa4f952807" src="https://github.com/user-attachments/assets/d2b250aa-7105-4510-9e39-c15336f81494" />


## 功能特性

- **一键捕获**：全局快捷键 `Ctrl+Shift+K` 或悬浮按钮，快速记录剪贴板内容
- **标签体系**：分类 · 标签两级结构，八色调色板，支持搜索和新建
- **来源追踪**：自动识别来源应用、窗口标题、URL
- **全文检索**：FTS5 全文搜索，覆盖标题、正文、摘要、来源
- **AI 元数据**（可选）：兼容 OpenAI 协议，自动生成标题、摘要、标签建议
- **完全离线**：所有数据存本地 SQLite，API Key 通过系统加密存储

## 下一步更新计划

- **知识框架构建**：基于目前AI生成的题目、摘要、场景、关键词，构建知识框架（还没想好展现形式，可能是图谱）
- **AI检索与生成**：接入AI检索与内容生成
- **万序集成**：目前还在开发万序个人文件管理系统，可能会与本地文件管理进行集成

## 快速开始

前置：Node.js 20+ 与 npm；Windows 打包还需要 Python 3（better-sqlite3 编译依赖）。

```bash
npm install
npm run electron:dev   # 启动开发环境
```

若 better-sqlite3 / active-win 报错（常见于版本升级后），重编原生模块：

```bash
npm run rebuild:native
```

## 打包 Windows 安装包

```bash
npm run build          # 只产出 dist / dist-electron
npm run package:win    # 产出 release/千点-*-x64.exe
```

打包期间 exe 若被 Windows Defender 短暂锁，等 30-60 秒重跑；
或加 `--config.directories.output=<OneDrive 之外的路径>` 换个输出目录。

## 目录结构

```
src/            React + TypeScript 渲染进程
electron/       Electron 主进程 + preload
scripts/        构建 / 验证 / 打包脚本
build/          NSIS 打包资源 (app.ico)
docs/           开发笔记
PRD.md          产品需求文档
```

## 数据位置

SQLite 与图片全存在 `%APPDATA%\千点\` 下，不会随源码或安装包分发。
API Key 通过 Electron safeStorage（Windows DPAPI）加密，绑定当前用户账户。

## 技术栈

- Electron 42 + React 19 + TypeScript
- Vite + Tailwind CSS 4
- better-sqlite3（本地存储）
- turndown（HTML → Markdown）
- active-win（来源应用识别）

## 许可证

[GPL-3.0](LICENSE)
