# AGENTS.md

这是一个 **opencode 工作空间** - Instagram 视频下载器 CLI 工具。

## 构建/检查/测试命令

使用 **npm** + TypeScript + ESLint + Prettier + Vitest。

```bash
# 依赖与构建
npm install
npm run build        # tsc 编译
npm run dev          # tsc --watch 监听模式
npm start            # node dist/cli.js

# 代码检查与格式化
npm run lint         # ESLint 检查
npm run lint:fix     # 自动修复
npm run format       # Prettier 格式化
npm run format:check # 检查格式

# 测试（Vitest）
npm run test                   # 运行所有测试
npm run test:watch             # 监听模式
npm run test:coverage          # 覆盖率报告
npx vitest run src/config.test.ts      # 单个测试文件
npx vitest run --reporter=verbose       # 详细输出
npx vitest run -t "should add user"     # 按名称运行测试
```

## 代码风格指南

### TypeScript 配置

- **严格模式** 已启用
- **ES2022** 目标 + Node16 模块解析
- **ES 模块** (`"type": "module"`) - 导入使用 `.js` 扩展名
- 生成 **声明文件** 和 **源映射**

### 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| 文件 | 短横线命名 | `extractor.ts` |
| 类/接口 | 帕斯卡命名 | `InstagramExtractor`, `VideoInfo` |
| 函数/方法 | 驼峰命名 | `extractFromPost()` |
| 常量 | 大写下划线 | `CDN_PATTERN`, `MAX_RETRIES` |
| 私有成员 | 下划线前缀 | `_privateMethod()` |
| 类型别名 | 帕斯卡命名 | `DownloadTask` |

### 导入规范

- **仅命名导出**（不使用默认导出）
- 导入路径使用 `.js` 扩展名
- **分组顺序**：(1) 外部包 → (2) 内部模块 → (3) Node.js 内置

```typescript
import { chromium } from "playwright";
import { InstagramExtractor } from "./extractor.js";
import { readFile } from "fs/promises";
```

### 类型与错误处理

- 公共函数使用 **显式返回类型**
- 数据结构用 **interface**，联合类型用 **type**
- 异步操作 **始终 try/catch**
- 错误类型保护：`error instanceof Error ? error.message : String(error)`
- 网络操作使用 **指数退避重试**

### 代码组织

```typescript
// ============================================================================
// 章节名称
// ============================================================================
```

- 文件头部使用 **JSDoc** 描述模块
- **常量** 定义在导入后顶部
- **私有方法** 分组在类末尾
- 始终使用 **async/await**
- 并行操作用 `Promise.all()` / `Promise.allSettled()`
- 在 **finally 块** 中清理资源（浏览器、文件句柄）

### 格式化（Prettier）

```json
{
  "semi": true,
  "trailingComma": "all",
  "singleQuote": false,
  "printWidth": 100,
  "tabWidth": 2
}
```

- **双引号** 字符串
- **模板字面量** 用于插值
- **尾随逗号** 必需
- **2 空格缩进**

### ESLint 规则

- `@typescript-eslint/explicit-function-return-type`: warn
- `@typescript-eslint/no-unused-vars`: error（允许 `_` 前缀）
- `@typescript-eslint/no-explicit-any`: error
- `@typescript-eslint/prefer-nullish-coalescing`: error
- `@typescript-eslint/prefer-optional-chain`: error
- `no-console`: warn（允许 `console.error`, `console.warn`）
- `prettier/prettier`: error

### 测试模式

- 使用 **Vitest**（globals 启用）
- 测试与源文件并列：`*.test.ts`
- 使用临时目录并在 `finally` 中清理

```typescript
import { describe, it, expect } from "vitest";

describe("config", () => {
  it("should add user", async () => {
    // arrange, act, assert
  });
});
```

## 核心原则

1. **严格 TypeScript** - 不使用 `any`，不用 `@ts-ignore`
2. **防御式编程** - 处理空输入、网络故障
3. **用户友好错误** - CLI 清晰消息，技术细节记日志
4. **资源清理** - 始终关闭浏览器上下文
5. **幂等操作** - 通过历史记录实现可安全重复运行
