#!/usr/bin/env bash
set -euo pipefail

# Resolve project root relative to this script
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SRC="$(cd "$SCRIPT_DIR/.." && pwd)"
STAGE="$(mktemp -d)/qiandian-src-stage"
FOLDER="千点-源码"
OUT="$SRC/$FOLDER.zip"

rm -rf "$STAGE"
mkdir -p "$STAGE/$FOLDER"

for d in src electron scripts docs; do
  cp -r "$SRC/$d" "$STAGE/$FOLDER/$d"
done

for f in .gitignore PRD.md electron-builder.yml index.html package.json package-lock.json tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts; do
  if [ -f "$SRC/$f" ]; then
    cp "$SRC/$f" "$STAGE/$FOLDER/$f"
  fi
done

mkdir -p "$STAGE/$FOLDER/build"
cp "$SRC/build/app.ico" "$STAGE/$FOLDER/build/app.ico"

cat > "$STAGE/$FOLDER/README.md" <<'EOF'
# 千点 · 源码

本地优先的桌面知识管理工具,Electron + React + SQLite。

## 快速开始

前置:Node.js 20+ 与 npm;Windows 打包还需要 Python 3(better-sqlite3 编译依赖)。

```bash
npm install
npm run electron:dev   # 启动开发环境
```

若 better-sqlite3 / active-win 报错(常见于版本升级后),重编原生模块:

```bash
npm run rebuild:native
```

## 打包 Windows 安装包

```bash
npm run build          # 只产出 dist / dist-electron
npm run package:win    # 产出 release/千点-*-x64.exe
```

打包期间 exe 若被 Windows Defender 短暂锁,等 30-60 秒重跑;
或加 `--config.directories.output=<OneDrive 之外的路径>` 换个输出目录。

## 目录

- src/          React + TypeScript 渲染进程
- electron/     Electron 主进程 + preload
- scripts/      构建 / 验证 / 打包脚本
- build/        NSIS 打包资源(app.ico)
- docs/         开发笔记
- PRD.md        产品需求文档

## 数据位置

SQLite 与图片全存在 `%APPDATA%\千点\` 下,不会随源码或安装包分发。
API Key 通过 Electron safeStorage(Windows DPAPI)加密,绑定当前用户账户。
EOF

rm -f "$OUT"
cd "$STAGE"
OUT_WIN=$(cygpath -w "$OUT")
/c/Windows/System32/tar.exe -a -c -f "$OUT_WIN" "$FOLDER"

SIZE=$(stat -c %s "$OUT" 2>/dev/null || wc -c < "$OUT")
SIZE_MB=$(awk "BEGIN { printf \"%.2f\", $SIZE / 1048576 }")
echo "wrote $OUT ($SIZE_MB MB)"

rm -rf "$STAGE"
