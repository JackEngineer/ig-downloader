# AGENTS.md

This is an **opencode workspace** - an Instagram video downloader CLI tool with user tracking and cron scheduling.

## Build/Lint/Test Commands

This project uses **npm** as the package manager with TypeScript for compilation. No linting, testing, or formatting tools are currently configured.

```bash
# Install dependencies
npm install

# Build (compile TypeScript)
npm run build

# Watch mode development
npm run dev

# Run CLI
npm start
npm run run-all    # Run downloader for all tracked users
```

### Running Single Tests

No test framework is configured. To add tests later:
- Install **Jest**: `npm install --save-dev jest @types/jest ts-jest`
- Install **Vitest**: `npm install --save-dev vitest`
- Run with **Jest**: `npx jest <test-file>`
- Run with **Vitest**: `npx vitest run <test-file>`

## Code Style Guidelines

### TypeScript Configuration

- **Strict mode enabled** - All strict TypeScript compiler options are on
- **ES2022 target** with Node16 module resolution
- **ES modules** (`"type": "module"`) - use `.js` extensions in imports
- **Declaration files** generated for all modules
- **Source maps** enabled for debugging

### File Organization

```
src/
├── cli.ts        # CLI entry point and command handlers
├── config.ts     # Configuration management (JSON persistence)
├── extractor.ts  # Playwright-based video extraction
├── downloader.ts # File download logic with retry
├── history.ts    # Download tracking / deduplication
└── logger.ts     # Colored console output utilities
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files | kebab-case | `extractor.ts` |
| Classes | PascalCase | `InstagramExtractor` |
| Interfaces | PascalCase | `VideoInfo`, `ExtractResult` |
| Functions/Methods | camelCase | `extractFromPost()`, `sanitizeFilename()` |
| Constants | UPPER_SNAKE_CASE | `CDN_PATTERN`, `MAX_RETRIES` |
| Private members | Underscore prefix (methods) | `_privateMethod()` |
| Type aliases | PascalCase | `DownloadTask`, `HistoryData` |

### Imports and Exports

- **Named exports only** - no default exports
- **Use `.js` extension** in import paths (required for ES modules)
- Group imports: (1) external packages, (2) internal modules, (3) Node.js builtins
- Example:
  ```typescript
  import { chromium, Browser } from "playwright";
  import { InstagramExtractor } from "./extractor.js";
  import { readFile } from "fs/promises";
  ```

### Type Patterns

- **Explicit return types** on public functions and methods
- **Interfaces** for data structures, **type aliases** for unions/complex types
- **Optional properties** with `?:` notation
- **Generics** when appropriate (e.g., `Promise<T>`)
- **Null safety** - always handle `null`/`undefined` with strict checks

### Error Handling

- **Always use `try/catch`** for async operations and file I/O
- **Type guards** for error objects: `error instanceof Error ? error.message : String(error)`
- **Early returns** for guard clauses, avoid deep nesting
- **Throw descriptive errors** from utilities, catch at command level
- **Retry logic** with exponential backoff for network operations

### Code Organization

- **Section comments** with visual separators:
  ```typescript
  // ============================================================================
  // Section Name
  // ============================================================================
  ```
- **File header JSDoc** describing module purpose
- **Private methods** grouped at end of class
- **Constants** defined at top of file after imports

### Async/Await Patterns

- **Always use async/await**, never raw promises
- **Parallel operations** with `Promise.all()` or `Promise.allSettled()`
- **Sequential iteration** with `for...of` when order matters
- **Cleanup in finally blocks** (browser contexts, file handles)

### Comments and Documentation

- **JSDoc for public APIs** - describe parameters, returns, and behavior
- **Inline comments** for complex logic or non-obvious behavior
- **JSDoc @typedef** for complex data structures in object literals

### String and Formatting

- **Double quotes** for strings ("example")
- **Template literals** for interpolation and multi-line strings
- **Trailing commas** in multi-line object/array literals
- **2-space indentation**

## Key Principles

1. **Strict TypeScript** - No `any` types, no `@ts-ignore` without explanation
2. **Defensive programming** - Handle edge cases (empty inputs, network failures)
3. **User-friendly errors** - Clear messages at CLI level, technical details in logs
4. **Resource cleanup** - Always close browser contexts, even on errors
5. **Idempotent operations** - Safe to re-run (deduplication via history tracking)
