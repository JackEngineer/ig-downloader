# AGENTS.md

这是一个 **opencode 工作空间** - 一个 Instagram 视频下载器 CLI 工具，具有用户跟踪和 cron 调度功能。

## 构建/检查/测试命令

本项目使用 **npm** 作为包管理器，使用 TypeScript 进行编译。目前没有配置代码检查、测试或格式化工具。

```bash
# 安装依赖
npm install

# 构建（编译 TypeScript）
npm run build

# 监听模式开发
npm run dev

# 运行 CLI
npm start
npm run run-all    # 为所有跟踪的用户运行下载器
```

### 运行单个测试

目前没有配置测试框架。以后要添加测试：

- 安装 **Jest**: `npm install --save-dev jest @types/jest ts-jest`
- 安装 **Vitest**: `npm install --save-dev vitest`
- 使用 **Jest** 运行: `npx jest <test-file>`
- 使用 **Vitest** 运行: `npx vitest run <test-file>`

## 代码风格指南

### TypeScript 配置

- **启用严格模式** - 所有严格的 TypeScript 编译器选项都已开启
- **ES2022 目标** 配合 Node16 模块解析
- **ES 模块** (`"type": "module"`) - 在导入路径中使用 `.js` 扩展名
- 为所有模块生成 **声明文件**
- 启用 **源代码映射** 以便调试

### 文件组织

```
src/
├── cli.ts        # CLI 入口点和命令处理器
├── config.ts     # 配置管理（JSON 持久化）
├── extractor.ts  # 基于 Playwright 的视频提取
├── downloader.ts # 文件下载逻辑（带重试）
├── history.ts    # 下载跟踪 / 去重
└── logger.ts     # 彩色控制台输出工具
```

### 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| 文件 | 短横线命名法 | `extractor.ts` |
| 类 | 帕斯卡命名法 | `InstagramExtractor` |
| 接口 | 帕斯卡命名法 | `VideoInfo`, `ExtractResult` |
| 函数/方法 | 驼峰命名法 | `extractFromPost()`, `sanitizeFilename()` |
| 常量 | 大写下划线命名法 | `CDN_PATTERN`, `MAX_RETRIES` |
| 私有成员 | 下划线前缀（方法） | `_privateMethod()` |
| 类型别名 | 帕斯卡命名法 | `DownloadTask`, `HistoryData` |

### 导入和导出

- **仅使用命名导出** - 不使用默认导出
- 在导入路径中 **使用 `.js` 扩展名**（ES 模块必需）
- 分组导入: (1) 外部包, (2) 内部模块, (3) Node.js 内置模块
- 示例:

  ```typescript
  import { chromium, Browser } from "playwright";
  import { InstagramExtractor } from "./extractor.js";
  import { readFile } from "fs/promises";
  ```

### 类型模式

- 公共函数和方法使用 **显式返回类型**
- 数据结构使用 **接口**，联合/复杂类型使用 **类型别名**
- 可选属性使用 `?:` 标记
- 适当使用 **泛型**（例如 `Promise<T>`）
- **空安全** - 始终使用严格检查处理 `null`/`undefined`

### 错误处理

- 异步操作和文件 I/O **始终使用 `try/catch`**
- 错误对象使用 **类型保护**: `error instanceof Error ? error.message : String(error)`
- **提前返回** 用于保护子句，避免深层嵌套
- 从工具函数抛出 **描述性错误**，在命令级别捕获
- 网络操作使用 **指数退避重试逻辑**

### 代码组织

- 使用视觉分隔符的 **章节注释**:

  ```typescript
  // ============================================================================
  // 章节名称
  // ============================================================================
  ```

- **文件头部 JSDoc** 描述模块用途
- **私有方法** 分组在类末尾
- **常量** 定义在导入之后文件顶部

### 异步/等待模式

- **始终使用 async/await**，从不使用原始 Promise
- 并行操作使用 `Promise.all()` 或 `Promise.allSettled()`
- 当顺序重要时使用 `for...of` 顺序迭代
- **在 finally 块中清理**（浏览器上下文、文件句柄）

### 注释和文档

- 公共 API 使用 **JSDoc** - 描述参数、返回值和行为
- 复杂逻辑或非显而易见的行为使用 **内联注释**
- 对象字面量中的复杂数据结构使用 **JSDoc @typedef**

### 字符串和格式

- 字符串使用 **双引号** ("示例")
- 插值和多行字符串使用 **模板字面量**
- 多行对象/数组字面量使用 **尾随逗号**
- **2 空格缩进**

## 核心原则

1. **严格 TypeScript** - 不使用 `any` 类型，没有解释不使用 `@ts-ignore`
2. **防御式编程** - 处理边界情况（空输入、网络故障）
3. **用户友好的错误** - CLI 级别显示清晰消息，技术细节记录在日志中
4. **资源清理** - 始终关闭浏览器上下文，即使在出错时
5. **幂等操作** - 可以安全地重复运行（通过历史记录跟踪去重）
