# Instagram 视频下载器

一个强大的 Instagram 视频自动下载工具，支持用户跟踪、去重检测和定时任务调度。

## ✨ 功能特性

- 🍪 **Cookie 认证** - 支持导入浏览器 Cookies，解决登录墙问题
- 🎯 **多用户跟踪** - 同时追踪多个 Instagram 账号
- 🔄 **智能去重** - 自动识别已下载的视频，避免重复下载
- 🌍 **代理支持** - 内置免费代理池 + 自定义代理配置
- ⏰ **定时调度** - 支持 cron 定时任务，自动运行下载
- 📊 **统计分析** - 查看每个用户的下载历史和统计信息
- 🚀 **批量下载** - 并发下载多个视频，自动选择最佳质量
- 💾 **断点续传** - 下载失败自动重试，带指数退避策略
- 🎨 **友好界面** - 彩色终端输出，实时进度提示
- 🔍 **干运行模式** - 预览下载内容而不实际下载
- 🛡️ **反检测** - 浏览器指纹模拟，降低被检测风险

## 📦 安装

### 环境要求

- Node.js 18+
- npm
- macOS / Linux / Windows

### 方式一：通过 npm 全局安装（推荐）

```bash
# 全局安装
npm install -g instagram-video-dl

# 安装 Playwright 浏览器（首次运行需要）
npx playwright install chromium

# 现在可以直接使用 igd 命令
igd --help
```

### 方式二：通过 npx 临时运行

```bash
# 无需安装，直接运行（每次都会下载最新版本）
npx igd --help
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

### 1. 配置 Cookie 认证（重要！）

**大多数 Instagram 内容需要登录才能访问**，请先导入你的 Cookies：

```bash
# 从浏览器导出 cookies.txt 文件，然后导入
igd config import-cookies ~/cookies.txt

# 查看是否导入成功
igd config | grep -i cookie
```

**如何获取 Cookies**：

1. 使用浏览器登录 Instagram 网页版
2. 安装扩展如 "Get cookies.txt LOCALLY"（Chrome）
3. 导出 instagram.com 的 cookies 为 `.txt` 文件
4. 执行上面的导入命令

**支持的格式**：

- Netscape 格式（`.txt`）- 推荐
- JSON 格式（`.json`）- 标准 Playwright 格式

### 2. 添加要跟踪的用户

```bash
# 添加用户
igd add natgeo --note "国家地理"

# 限制最大视频数
igd add bbcnews --max-videos 5
```

### 3. 查看跟踪列表

```bash
igd list
```

### 4. 下载视频

```bash
# 下载所有用户的新视频
igd run

# 只下载特定用户
igd run natgeo

# 预览模式（不实际下载）
igd run --dry-run

# 限制下载数量
igd run natgeo --max-videos 10
```

### 5. 配置定时任务

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

**可用配置项**：

| 配置项           | 说明                 | 示例                                         |
| ---------------- | -------------------- | -------------------------------------------- |
| `download-dir`   | 设置下载目录         | `igd config download-dir ~/Videos/Instagram` |
| `max-videos`     | 设置默认最大视频数   | `igd config max-videos 20`                   |
| `scroll-timeout` | 设置滚动超时（毫秒） | `igd config scroll-timeout 30000`            |
| `schedule`       | 设置 cron 定时表达式 | `igd config schedule "0 8,20 * * *"`         |
| `import-cookies` | 导入 Cookie 文件     | `igd config import-cookies ~/cookies.txt`    |
| `clear-cookies`  | 清除已导入的 Cookies | `igd config clear-cookies`                   |
| `free-proxy`     | 启用/禁用免费代理    | `igd config free-proxy on`                   |

**Cookie 配置示例**：

```bash
# 从浏览器导出的 cookies.txt 文件导入
igd config import-cookies ~/Downloads/cookies.txt

# 导入后查看 Cookie 数量
igd config
# 输出示例: Cookies: 24 个

# 如果不需要 Cookie 了（如使用公开账号）
igd config clear-cookies
```

**代理配置示例**：

```bash
# 使用免费代理池（自动获取可用代理）
igd config free-proxy on

# 禁用代理（直接连接）
igd config free-proxy off

# 使用自定义 HTTP 代理
igd config proxy http://proxy.example.com:8080

# 使用带认证的代理
igd config proxy http://proxy.example.com:8080 --proxy-user username --proxy-pass password

# 移除代理设置
igd config remove-proxy
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

### 配置文件位置

- **主配置**: `~/.ig-downloader/config.json`
- **下载历史**: `~/.ig-downloader/history.json`
- **代理缓存**: `~/.ig-downloader/proxy-pool.json`

### 完整配置示例

```json
{
  "downloadDir": "/Users/username/ig-downloads",
  "maxVideosPerUser": 20,
  "scrollTimeout": 30000,
  "schedule": "0 9,21 * * *",
  "useFreeProxy": false,
  "cookies": [
    {
      "name": "sessionid",
      "value": "your-session-id",
      "domain": ".instagram.com",
      "path": "/",
      "expires": 1799764899,
      "httpOnly": true,
      "secure": true,
      "sameSite": "Lax"
    },
    {
      "name": "csrftoken",
      "value": "your-csrf-token",
      "domain": ".instagram.com",
      "path": "/"
    }
  ],
  "users": [
    {
      "username": "natgeo",
      "enabled": true,
      "maxVideos": 10,
      "note": "国家地理",
      "addedAt": "2024-01-15T10:30:00.000Z"
    },
    {
      "username": "bbcnews",
      "enabled": true,
      "note": "BBC新闻"
    }
  ]
}
```

**配置字段说明**：

| 字段               | 类型    | 说明                   | 必填 |
| ------------------ | ------- | ---------------------- | ---- |
| `downloadDir`      | string  | 下载目录路径           | 是   |
| `maxVideosPerUser` | number  | 每个用户默认最大下载数 | 是   |
| `scrollTimeout`    | number  | 页面滚动超时（毫秒）   | 是   |
| `schedule`         | string  | Cron 定时表达式        | 是   |
| `useFreeProxy`     | boolean | 是否使用免费代理池     | 否   |
| `proxy`            | object  | 自定义代理配置         | 否   |
| `cookies`          | array   | Instagram 认证 Cookies | 否   |
| `users`            | array   | 跟踪的用户列表         | 是   |

**重要 Cookie 字段**：

- `sessionid` - Instagram 会话 ID（最关键）
- `csrftoken` - CSRF 防护令牌
- `ds_user_id` - 用户 ID
- `ig_did` - 设备标识
- `mid` - 浏览器会话

### 手动编辑配置

```bash
# 编辑配置文件
nano ~/.ig-downloader/config.json

# 验证 JSON 格式
npx jsonlint ~/.ig-downloader/config.json

# 重新加载配置
igd config
```

## 📁 目录结构

下载的视频按用户名组织：

```
~/ig-downloads/
├── natgeo/
│   ├── 1,006_likes,_25_comments_-_natgeo_on_January_5,_2024_ABC123.mp4
│   ├── 2,557_likes,_43_comments_-_natgeo_on_January_25,_2024_DEF456.mp4
│   └── ...
├── bbcnews/
│   └── bbcnews_789XYZ_2024-01-20.mp4
└── somicmqz/
    └── ...
```

**文件命名格式**：`{点赞数}_likes,_{评论数}_comments_-_{用户名}_on_{日期}_{标题}_{shortCode}.mp4`

### 历史记录格式

`~/.ig-downloader/history.json`：

```json
{
  "users": {
    "natgeo": {
      "records": [
        {
          "shortCode": "ABC123",
          "filePath": "/Users/username/ig-downloads/natgeo/..._ABC123.mp4",
          "caption": "Amazing wildlife footage",
          "size": 15482931,
          "downloadedAt": "2024-01-15T14:32:10.123Z"
        }
      ]
    }
  }
}
```

## 🐛 故障排除

### 常见问题速查

#### ❌ "Instagram 可能需要登录"

**症状**：运行后显示"未找到链接。Instagram 可能需要登录"

**原因**：Instagram 需要登录才能查看大多数用户内容

**解决方案**：

```bash
# 1. 在浏览器中登录 Instagram
# 2. 使用扩展导出 cookies（推荐 "Get cookies.txt LOCALLY"）
# 3. 导入 cookies
igd config import-cookies ~/Downloads/cookies.txt

# 4. 验证导入成功
igd config | grep -i cookie
# 应该显示: Cookies: XX 个
```

#### ❌ "Timeout 60000ms exceeded"

**症状**：页面加载超时，无法收集链接

**可能原因**：

- 网络连接问题
- 代理服务器不稳定
- Instagram 限流

**解决方案**：

```bash
# 方案1: 禁用代理，直接连接
igd config free-proxy off

# 方案2: 增加超时时间
igd config scroll-timeout 60000

# 方案3: 检查网络连接，稍后重试
```

#### ❌ "browserContext.addCookies: Invalid cookie fields"

**症状**：Cookie 导入失败

**原因**：Cookie 格式不正确或缺少关键字段

**解决方案**：

- 确保使用浏览器扩展导出的原始格式
- 检查是否包含 `sessionid` 等关键 Cookie
- 重新导出并导入：
  ```bash
  igd config clear-cookies
  igd config import-cookies ~/fresh-cookies.txt
  ```

#### ❌ "net::ERR_TUNNEL_CONNECTION_FAILED"

**症状**：使用代理时出现隧道连接错误

**原因**：免费代理不稳定或已被 Instagram 封锁

**解决方案**：

```bash
# 方案1: 禁用代理
igd config free-proxy off

# 方案2: 使用付费代理（如 Bright Data、Oxylabs）
igd config proxy http://your-paid-proxy:port

# 方案3: 刷新代理池
rm ~/.ig-downloader/proxy-pool.json
igd config free-proxy on
```

#### ❌ 下载了 50 个视频但实际只有 20 个文件

**症状**：统计数字与实际文件数不匹配

**原因**：修复前版本会为同一视频的不同质量版本创建多个任务

**解决方案**：

- 更新到最新版本（已修复）
- 清理重复文件：
  ```bash
  rm -rf ~/ig-downloads/username/*.mp4
  igd run username  # 重新下载最佳质量版本
  ```

#### ❌ 浏览器未安装

如果遇到 "Executable doesn't exist" 错误：

```bash
npx playwright install chromium
```

#### ❌ 定时任务未运行

检查步骤：

```bash
# 查看 crontab 配置
crontab -l

# 查看日志文件
tail -f ~/ig-downloader.log

# 确认任务状态
igd cron

# 确保 igd 命令在 PATH 中
which igd
```

#### ❌ 权限问题

确保下载目录有写入权限：

```bash
chmod 755 ~/Downloads/Instagram
```

### 调试模式

查看详细日志：

```bash
# 启用调试输出
DEBUG=1 igd run natgeo

# 或查看日志文件
tail -f ~/.ig-downloader/ig-downloader.log
```

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
├── proxy-manager.ts    # 免费代理池管理
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

### ⚠️ 使用须知

1. **仅供学习和个人使用** - 本工具仅供个人学习、备份自己发布的内容使用
2. **遵守 Instagram 条款** - 请遵守 [Instagram 使用条款](https://help.instagram.com/581066165581870) 和当地法律法规
3. **避免频繁请求** - 建议：
   - 不要连续下载大量用户
   - 每次下载后等待 1-2 分钟再继续
   - 使用 `--max-videos` 限制单次下载数量
4. **尊重版权** - 下载的内容版权归原作者所有，请勿用于商业用途或二次传播
5. **账号安全** - 使用 cookies 时注意：
   - 不要在公共设备上保存 cookies
   - 定期更换密码
   - 发现异常登录立即撤销会话

### 💡 使用技巧

**1. 首次使用建议**：

```bash
# 1. 导入 cookies
igd config import-cookies ~/cookies.txt

# 2. 添加测试用户（自己或少量用户）
igd add username --max-videos 3

# 3. 预览模式测试
igd run --dry-run

# 4. 确认无误后正式运行
igd run
```

**2. 批量添加用户**：

```bash
# 创建用户列表文件 users.txt
# 每行一个用户名
cat users.txt | while read user; do
  igd add "$user" --max-videos 10
done
```

**3. 定期清理历史**：

```bash
# 如果历史记录太大，可以清理特定用户的记录
# 编辑 ~/.ig-downloader/history.json 删除不需要的记录
```

**4. 网络优化**：

```bash
# 如果遇到网络问题，可以尝试：

# 1. 禁用代理（国内用户）
igd config free-proxy off

# 2. 使用代理（海外用户被封锁时）
igd config free-proxy on

# 3. 增加超时时间
igd config scroll-timeout 60000

# 4. 减少同时下载数量（默认3个）
# 修改 src/downloader.ts 中的 DOWNLOAD_BATCH_SIZE
```

**5. Cookie 管理**：

```bash
# Cookie 通常有效期为 1-2 周，过期后需要重新导入

# 检查 Cookie 是否有效
igd config | grep -i cookie

# 如果显示 "未设置" 或数量很少，需要重新导入
igd config clear-cookies
igd config import-cookies ~/fresh-cookies.txt
```

## 📊 版本更新日志

### v1.1.0 (最新)

- ✅ **Cookie 认证支持** - 支持导入浏览器 Cookies 进行登录
- ✅ **免费代理池** - 自动获取和验证免费代理（不稳定，建议禁用）
- ✅ **重复下载修复** - 修复了同一视频多个质量版本导致的重复计数问题
- ✅ **错误处理增强** - 更好的错误提示和恢复机制
- ✅ **反检测增强** - 浏览器指纹模拟，降低被检测为爬虫的概率

### v1.0.0

- 🎯 多用户跟踪
- 🔄 智能去重
- ⏰ 定时任务调度
- 📊 下载统计
- 🚀 批量并发下载

## 📄 许可证

MIT License

## 🙏 致谢

- [Playwright](https://playwright.dev) - 浏览器自动化框架
- 所有贡献者和测试用户

---

**Made with ❤️ by JackEngineer**

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 🔗 相关资源

- [Playwright 文档](https://playwright.dev)
- [Cron 表达式指南](https://crontab.guru)
- [TypeScript 文档](https://www.typescriptlang.org)

---

如有问题或建议，欢迎反馈！
