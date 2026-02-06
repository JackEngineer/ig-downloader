# AGENTS.md

这是一个 **opencode 工作空间** - Instagram 视频下载器 CLI 工具，具有用户跟踪、去重和定时调度功能。

## 构建/检查/测试命令

本项目使用 **npm** 作为包管理器，配合 TypeScript、ESLint、Prettier 和 Vitest。

```bash
# 安装依赖
npm install

# 构建（编译 TypeScript）
npm run build

# 开发监听模式
npm run dev

# 运行 CLI
npm start
npm run run-all    # 为所有跟踪的用户运行下载器
```

### 代码检查与格式化

```bash
# 运行 ESLint
npm run lint
npm run lint:fix   # 自动修复问题

# 运行 Prettier
npm run format      # 格式化所有文件
npm run format:check # 检查格式而不写入
```

### 使用 Vitest 测试

```bash
# 运行所有测试
npm run test

# 运行单个测试文件
npx vitest run src/config.test.ts

# 运行匹配模式的测试
npx vitest run --reporter=verbose config

# 开发监听模式
npm run test:watch

# 生成覆盖率报告
npm run test:coverage
```

## 代码风格指南

### TypeScript 配置

- **启用严格模式** - 所有严格编译器选项已开启
- **ES2022 目标** 配合 Node16 模块解析
- **ES 模块** (`"type": "module"`) - 导入路径中使用 `.js` 扩展名
- 为所有模块生成 **声明文件**
- 启用 **源映射** 用于调试

### 文件组织

```
src/
├── cli.ts              # CLI 入口点和命令处理器
├── config.ts           # 配置管理（JSON 持久化）
├── config.test.ts      # 配置模块测试
├── extractor.ts        # 基于 Playwright 的视频提取
├── downloader.ts       # 文件下载逻辑（带重试）
├── downloader.test.ts  # 下载器模块测试
├── history.ts          # 下载跟踪 / 去重
├── logger.ts           # 彩色控制台输出工具
└── logger.test.ts      # 日志模块测试
```

### 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| 文件 | 短横线命名法 | `extractor.ts` |
| 类 | 帕斯卡命名法 | `InstagramExtractor` |
| 接口 | 帕斯卡命名法 | `VideoInfo`, `ExtractResult` |
| 函数/方法 | 驼峰命名法 | `extractFromPost()`, `sanitizeFilename()` |
| 常量 | 大写下划线命名法 | `CDN_PATTERN`, `MAX_RETRIES` |
| 私有成员 | 下划线前缀 | `_privateMethod()` |
| 类型别名 | 帕斯卡命名法 | `DownloadTask`, `HistoryData` |

### 导入与导出

- **仅使用命名导出** - 不使用默认导出
- 在导入路径中 **使用 `.js` 扩展名**（ES 模块必需）
- **分组导入**：(1) 外部包, (2) 内部模块, (3) Node.js 内置模块

```typescript
import { chromium, Browser } from "playwright";
import { InstagramExtractor } from "./extractor.js";
import { readFile } from "fs/promises";
```

### 类型模式

- 公共函数和方法使用 **显式返回类型**
- 数据结构使用 **接口**，联合/复杂类型使用 **类型别名**
- 可选属性使用 `?:` 标记
- 适当使用 **泛型**（如 `Promise<T>`）
- **空安全** - 始终使用严格检查处理 `null`/`undefined`

### 错误处理

- 异步操作和文件 I/O **始终使用 `try/catch`**
- 错误对象使用 **类型保护**：`error instanceof Error ? error.message : String(error)`
- **提前返回** 用于保护子句，避免深层嵌套
- 从工具函数抛出 **描述性错误**，在命令级别捕获
- 网络操作使用 **指数退避重试逻辑**

### 代码组织

- **章节注释** 带视觉分隔符：

```typescript
// ============================================================================
// 章节名称
// ============================================================================
```

- 文件头部使用 **JSDoc** 描述模块用途
- **私有方法** 分组在类末尾
- **常量** 定义在导入之后文件顶部

### 异步模式

- **始终使用 async/await**，不使用原始 Promise
- 并行操作使用 `Promise.all()` 或 `Promise.allSettled()`
- 顺序重要时使用 `for...of` 顺序迭代
- **在 finally 块中清理**（浏览器上下文、文件句柄）

### 测试模式

- 使用 globals 启用的 **Vitest**
- 测试与源文件并列存放（`*.test.ts`）
- 使用 `withConfig()` 模式作为带清理的测试辅助函数
- 在 `finally` 块中使用临时目录并清理

```typescript
import { describe, it, expect } from "vitest";

describe("功能", () => {
  it("应该执行某操作", async () => {
    // 准备、执行、断言
  });
});
```

### 字符串与格式化

- 字符串使用 **双引号**（"示例"）
- 插值和多行字符串使用 **模板字面量**
- 多行对象/数组字面量使用 **尾随逗号**
- **2 空格缩进**（Prettier 强制执行）
- **打印宽度**：100 字符
- **分号**：必需

### ESLint 规则

- `@typescript-eslint/explicit-function-return-type`: warn
- `@typescript-eslint/no-unused-vars`: error（允许 `_` 前缀）
- `@typescript-eslint/no-explicit-any`: error
- `@typescript-eslint/prefer-nullish-coalescing`: error
- `no-console`: warn（允许 `console.error` 和 `console.warn`）

## 核心原则

1. **严格 TypeScript** - 不使用 `any` 类型，无解释不使用 `@ts-ignore`
2. **防御式编程** - 处理边界情况（空输入、网络故障）
3. **用户友好错误** - CLI 级别清晰消息，技术细节记录在日志中
4. **资源清理** - 始终关闭浏览器上下文，即使出错时
5. **幂等操作** - 可安全重复运行（通过历史记录跟踪去重）
