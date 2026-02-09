# 本地测试指南

本文档详细介绍了如何在本地测试 Instagram 视频下载器。

## 目录

1. [环境准备](#环境准备)
2. [单元测试](#单元测试)
3. [CLI 命令测试](#cli-命令测试)
4. [模拟运行测试](#模拟运行测试)
5. [实际下载测试](#实际下载测试)
6. [常见问题测试](#常见问题测试)

---

## 环境准备

### 1. 安装依赖

```bash
npm install
```

### 2. 构建项目

```bash
# 构建 TypeScript
npm run build

# 或使用监听模式（开发时）
npm run dev
```

### 3. 安装 Playwright 浏览器（首次运行必需）

```bash
npx playwright install chromium
```

---

## 单元测试

### 运行所有测试

```bash
npm test
```

### 监听模式（开发时自动重新运行测试）

```bash
npm run test:watch
```

### 生成覆盖率报告

```bash
npm run test:coverage
```

### 测试单个文件

```bash
npx vitest run src/config.test.ts
npx vitest run src/logger.test.ts
npx vitest run src/downloader.test.ts
```

### 按名称运行特定测试

```bash
npx vitest run -t "should add user"
```

---

## CLI 命令测试

### 测试帮助命令

```bash
# 显示帮助信息
node dist/cli.js --help

# 或使用 npm
npm start -- --help
```

### 测试配置命令

```bash
# 查看当前配置
node dist/cli.js config

# 设置下载目录
node dist/cli.js config download-dir ~/test-downloads

# 设置最大视频数
node dist/cli.js config max-videos 5

# 禁用代理
node dist/cli.js config free-proxy off
```

### 测试用户管理

```bash
# 添加测试用户（使用公开测试账号）
node dist/cli.js add natgeo --note "国家地理测试账号"
node dist/cli.js add instagram --max-videos 3

# 查看用户列表
node dist/cli.js list

# 禁用用户
node dist/cli.js disable natgeo

# 启用用户
node dist/cli.js enable natgeo

# 删除用户
node dist/cli.js remove instagram
```

### 测试统计命令

```bash
node dist/cli.js stats
```

---

## 模拟运行测试

### 干运行模式（预览但不下载）

这是测试下载流程的最佳方式，不会实际下载任何文件：

```bash
# 为所有用户干运行
node dist/cli.js run --dry-run

# 为特定用户干运行
node dist/cli.js run natgeo --dry-run
```

### 预期输出

```
  ___ ____ ____
 |_ _/ ___|  _ \
  | | |  _| | | |
  | | |_| | |_| |
 |___\____|____/


⚠️  未检测到 Cookie 配置
大多数 Instagram 内容需要登录才能访问
建议导入浏览器 Cookie 以获得最佳体验

    igd config import-cookies ~/cookies.txt

ℹ 正在处理 1 个用户...
  下载目录: /Users/xxx/test-downloads
⚠ 模拟运行 — 不会实际下载文件。
✔ 浏览器已初始化。

@natgeo
──────────────────────────────────────
→ 正在收集帖子/Reel 链接 (最大: 5)...
ℹ 找到 12 个链接。正在检查新内容...
ℹ 12 个新视频待下载 (0 个已下载过)。
→ 正在提取视频链接...
  将下载: https://www.instagram.com/reel/ABC123/
  将下载: https://www.instagram.com/reel/DEF456/
  ...
```

---

## 实际下载测试

### 准备 Cookie（必需）

Instagram 大多数内容需要登录，你需要准备 Cookie：

**方法 1：从浏览器导出**

1. 在 Chrome/Firefox 中登录 instagram.com
2. 安装扩展 "Get cookies.txt LOCALLY"
3. 导出 instagram.com 的 cookies 为 `.txt` 文件
4. 导入到工具：

```bash
node dist/cli.js config import-cookies ~/Downloads/cookies.txt
```

**方法 2：手动创建测试配置**

在 `~/.ig-downloader/config.json` 中手动添加 cookies（不推荐用于测试）

### 运行实际下载测试

```bash
# 添加一个公开账号进行测试
node dist/cli.js add natgeo --max-videos 3

# 运行下载（最多下载 3 个视频）
node dist/cli.js run natgeo

# 查看下载的文件
ls ~/ig-downloads/natgeo/
```

### 清理测试数据

```bash
# 清除下载历史（可重新下载）
rm ~/.ig-downloader/history.json

# 删除下载的文件
rm -rf ~/ig-downloads/natgeo/

# 清除所有配置（完全重置）
rm -rf ~/.ig-downloader/
```

---

## 常见问题测试

### 测试浏览器未安装错误

```bash
# 临时移动 Playwright 浏览器位置来模拟错误
mv ~/Library/Caches/ms-playwright ~/Library/Caches/ms-playwright-backup

# 运行命令，应该显示浏览器安装指南
node dist/cli.js run --dry-run

# 恢复浏览器
mv ~/Library/Caches/ms-playwright-backup ~/Library/Caches/ms-playwright
```

### 测试无用户引导

```bash
# 重置配置
rm -rf ~/.ig-downloader/

# 运行 list 命令，应该显示添加用户引导
node dist/cli.js list

# 运行 run 命令，应该显示添加用户引导
node dist/cli.js run
```

### 测试无 Cookie 警告

```bash
# 如果有 cookie，先清除
node dist/cli.js config clear-cookies

# 运行 dry-run，应该显示 Cookie 警告
node dist/cli.js run --dry-run
```

### 测试初次使用引导

```bash
# 完全重置
rm -rf ~/.ig-downloader/
rm -rf ~/ig-downloads/

# 运行任何命令（除了 help），应该显示完整的引导向导
node dist/cli.js config
```

---

## 调试技巧

### 查看详细日志

在 `src/extractor.ts` 中，提取器会输出导航日志：

```
[scrape] Navigating to https://www.instagram.com/xxx/
[scrape] Page loaded, waiting for content...
[auth] Loaded X Instagram cookies
```

### 检查配置文件

```bash
# 查看配置文件
cat ~/.ig-downloader/config.json | jq .

# 查看历史记录
cat ~/.ig-downloader/history.json | jq .
```

### 使用 Node.js 调试器

```bash
# 使用 --inspect 启动调试
node --inspect-brk dist/cli.js run --dry-run

# 然后在 Chrome 中打开 chrome://inspect
```

---

## 持续集成测试

### 运行完整的检查流程

```bash
# 1. 代码格式检查
npm run format:check

# 2. 代码检查
npm run lint

# 3. 构建
npm run build

# 4. 运行所有测试
npm test

# 5. 测试 CLI 命令
node dist/cli.js --help
node dist/cli.js config
```

---

## 测试检查清单

在提交代码前，确保完成以下测试：

- [ ] `npm run build` 成功无错误
- [ ] `npm test` 所有测试通过
- [ ] `node dist/cli.js --help` 显示正确的帮助信息
- [ ] `node dist/cli.js list` 正常显示用户列表
- [ ] `node dist/cli.js config` 正常显示配置
- [ ] `node dist/cli.js run --dry-run` 正常预览（如果有用户）
- [ ] `node dist/cli.js stats` 正常显示统计信息
- [ ] 重置配置后（`rm -rf ~/.ig-downloader/`），初次使用引导正常显示

---

## 快速测试脚本

创建一个快速测试脚本：

```bash
#!/bin/bash
set -e

echo "=== 构建项目 ==="
npm run build

echo "=== 运行单元测试 ==="
npm test

echo "=== 测试 CLI 命令 ==="
node dist/cli.js --help > /dev/null && echo "✓ help 命令正常"
node dist/cli.js config > /dev/null && echo "✓ config 命令正常"
node dist/cli.js list > /dev/null && echo "✓ list 命令正常"
node dist/cli.js stats > /dev/null && echo "✓ stats 命令正常"

echo "=== 所有测试通过 ==="
```

保存为 `quick-test.sh`，然后：

```bash
chmod +x quick-test.sh
./quick-test.sh
```
