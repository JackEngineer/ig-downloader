# Instagram 视频下载器

一个强大的 Instagram 视频自动下载工具，支持用户跟踪、去重检测和定时任务调度。

## ✨ 功能特性

- 🎯 **多用户跟踪** - 同时追踪多个 Instagram 账号
- 🔄 **智能去重** - 自动识别已下载的视频，避免重复下载
- ⏰ **定时调度** - 支持 cron 定时任务，自动运行下载
- 📊 **统计分析** - 查看每个用户的下载历史和统计信息
- 🚀 **批量下载** - 并发下载多个视频，提升效率
- 💾 **断点续传** - 下载失败自动重试，带指数退避策略
- 🎨 **友好界面** - 彩色终端输出，实时进度提示
- 🔍 **干运行模式** - 预览下载内容而不实际下载

## 📦 安装

### 环境要求

- Node.js 16+
- npm

### 方式一：通过 npm 全局安装（推荐）

```bash
# 全局安装
npm install -g ig-downloader

# 安装 Playwright 浏览器（首次运行需要）
npx playwright install chromium

# 现在可以直接使用 ig-downloader 或 igd 命令
ig-downloader --help
```

### 方式二：通过 npx 临时运行

```bash
# 无需安装，直接运行（每次都会下载最新版本）
npx ig-downloader --help
```

### 方式三：从源码安装

```bash
# 克隆仓库
git clone https://github.com/JackEngineer/ig-downloader.git
cd ig-downloader

# 安装依赖
npm install

# 构建项目
npm run build

# 安装 Playwright 浏览器（首次运行需要）
npx playwright install chromium

# 本地链接开发版本
npm link
```

## 🚀 快速开始

全局安装后，使用 `ig-downloader` 或简写 `igd` 命令：

### 1. 添加要跟踪的用户

```bash
# 添加用户
ig-downloader add natgeo --note "国家地理"
# 或简写
igd add natgeo --note "国家地理"

# 限制最大视频数
igd add bbcnews --max-videos 5
```

### 2. 查看跟踪列表

```bash
igd list
```

### 3. 下载视频

```bash
# 下载所有用户的新视频
igd run

# 只下载特定用户
igd run natgeo

# 预览模式（不实际下载）
igd run --dry-run
```

### 4. 配置定时任务

```bash
# 使用向导配置定时计划
igd schedule-wizard

# 安装到系统 crontab
igd install-cron

# 查看定时任务状态
igd cron
```

> **从源码安装的用户**：继续使用 `npm start` 命令代替 `igd`

## 📖 命令详解

### 用户管理

#### `add <用户名>` - 添加跟踪用户

```bash
igd add <用户名> [选项]
```

选项：

- `--max-videos <数量>` - 设置该用户最大下载视频数（默认 20）
- `--note <文本>` - 为用户添加备注标签

示例：

```bash
igd add natgeo --max-videos 10 --note "国家地理官方"
igd add bbcnews --note "BBC新闻"
```

#### `remove <用户名>` - 移除用户

```bash
igd remove natgeo
igd rm bbcnews  # 简写形式
```

#### `enable <用户名>` - 启用用户

重新启用已禁用的用户：

```bash
igd enable natgeo
```

#### `disable <用户名>` - 禁用用户

暂时禁用用户而不删除其历史记录：

```bash
igd disable natgeo
```

#### `list` - 查看跟踪列表

显示所有跟踪用户及其统计信息：

```bash
igd list
igd ls  # 简写形式
```

输出包括：

- 用户名
- 启用状态
- 最大视频数限制
- 已下载视频数量
- 总下载大小
- 用户备注

### 下载管理

#### `run [用户名]` - 执行下载

```bash
igd run [用户名] [选项]
```

选项：

- `--dry-run` - 预览模式，只显示将要下载的内容

示例：

```bash
# 下载所有启用用户的新视频
igd run

# 只下载特定用户
igd run natgeo

# 预览将要下载的内容
igd run --dry-run
```

工作流程：

1. 访问用户的 Instagram 主页
2. 收集 Reels 视频链接
3. 检查历史记录，过滤已下载的视频
4. 提取视频 CDN 链接
5. 批量下载新视频
6. 保存下载记录到历史数据库

### 配置管理

#### `config` - 查看/修改配置

查看当前配置：

```bash
igd config
```

修改配置项：

```bash
igd config <配置项> <值>
```

可用配置项：

- `download-dir` - 设置下载目录
- `max-videos` - 设置默认最大视频数
- `scroll-timeout` - 设置滚动超时时间（毫秒）
- `schedule` - 设置 cron 定时表达式

示例：

```bash
# 设置下载目录
igd config download-dir ~/Videos/Instagram

# 设置默认最大视频数
igd config max-videos 20

# 设置滚动超时
igd config scroll-timeout 30000

# 设置定时计划（每天早8点和晚8点）
igd config schedule "0 8,20 * * *"
```

### 定时任务

#### `schedule-wizard` - 定时计划向导

交互式配置定时任务（推荐）：

```bash
igd schedule-wizard
```

支持的定时模式：

- 每小时
- 每天（指定时间）
- 每周（指定星期和时间）
- 每月（指定日期和时间）
- 自定义 cron 表达式

#### `install-cron` - 安装定时任务

自动将任务添加到系统 crontab：

```bash
igd install-cron
```

功能：

- 自动检测 Node.js 路径
- 验证启用用户列表
- 添加任务到 crontab
- 配置日志输出到 `~/ig-downloader.log`

#### `uninstall-cron` - 卸载定时任务

从 crontab 中移除定时任务：

```bash
igd uninstall-cron
```

#### `cron` - 查看定时任务状态

显示当前定时任务配置和状态：

```bash
igd cron
```

输出包括：

- 当前定时计划
- 任务是否已安装
- crontab 中的任务条目
- 手动安装指南

### 统计信息

#### `stats` - 全局统计

查看所有用户的下载统计：

```bash
igd stats
```

显示：

- 跟踪用户总数
- 已下载视频总数
- 总下载大小

## ⚙️ 配置文件

配置文件存储在 `~/.ig-downloader/config.json`：

```json
{
  "downloadDir": "./downloads",
  "maxVideosPerUser": 20,
  "scrollTimeout": 30000,
  "schedule": "0 */6 * * *",
  "users": [
    {
      "username": "natgeo",
      "enabled": true,
      "maxVideos": 10,
      "note": "国家地理"
    }
  ]
}
```

历史记录存储在 `~/.ig-downloader/history.json`。

## 📁 目录结构

下载的视频按用户名组织：

```
downloads/
├── natgeo/
│   ├── natgeo_ABC123_2024-01-15.mp4
│   └── natgeo_DEF456_2024-01-16.mp4
└── bbcnews/
    └── bbcnews_GHI789_2024-01-15.mp4
```

文件命名格式：`{用户名}_{shortCode}_{日期}.mp4`

## 🔧 开发

### 项目结构

```
src/
├── cli.ts              # CLI 入口和命令处理
├── config.ts           # 配置管理
├── config.test.ts      # 配置模块测试
├── extractor.ts        # 基于 Playwright 的视频提取
├── downloader.ts       # 文件下载逻辑
├── downloader.test.ts  # 下载器模块测试
├── history.ts          # 下载历史跟踪
├── logger.ts           # 彩色日志工具
├── logger.test.ts      # 日志模块测试
├── cron-wizard.ts      # 定时任务向导
└── cron-installer.ts   # Crontab 安装工具
```

### 开发命令

```bash
# 开发模式（自动重新编译）
npm run dev

# 运行测试
npm run test

# 监听模式运行测试
npm run test:watch

# 生成测试覆盖率报告
npm run test:coverage

# 代码检查
npm run lint

# 自动修复 lint 问题
npm run lint:fix

# 格式化代码
npm run format

# 检查格式
npm run format:check
```

### 技术栈

- **TypeScript** - 类型安全的 JavaScript
- **Playwright** - 浏览器自动化和网络拦截
- **Vitest** - 快速的单元测试框架
- **ESLint + Prettier** - 代码质量和格式化工具

### 代码规范

- 使用 TypeScript 严格模式
- ES2022 + ES 模块
- 双引号字符串
- 2 空格缩进
- 显式返回类型
- 命名导出（无默认导出）

详见 `AGENTS.md` 获取完整代码风格指南。

## 🐛 故障排除

### 浏览器未安装

如果遇到 "Executable doesn't exist" 错误：

```bash
npx playwright install chromium
```

### 无法提取视频

可能原因：

- Instagram 需要登录才能访问该用户
- 用户没有公开的 Reels
- 网络问题或 Instagram 临时限流

解决方案：

- 尝试使用 `--dry-run` 检查链接收集是否正常
- 检查用户是否为公开账号
- 等待一段时间后重试

### 定时任务未运行

检查步骤：

```bash
# 查看 crontab 配置
crontab -l

# 查看日志文件
tail -f ~/ig-downloader.log

# 确认任务状态
igd cron
```

### 权限问题

确保下载目录有写入权限：

```bash
chmod 755 ~/Downloads/Instagram
```

## 📝 注意事项

⚠️ **使用须知**：

1. 本工具仅供学习和个人使用
2. 请遵守 Instagram 的使用条款
3. 避免过于频繁的请求，以免触发限流
4. 不要用于商业用途或侵犯版权
5. 下载的内容版权归原作者所有

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 🔗 相关资源

- [Playwright 文档](https://playwright.dev)
- [Cron 表达式指南](https://crontab.guru)
- [TypeScript 文档](https://www.typescriptlang.org)

---

如有问题或建议，欢迎反馈！
