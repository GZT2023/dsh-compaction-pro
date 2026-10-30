
fix: 适配 DSH 0.2.0 接口规范，修复 TS 编译报错并更新安装文档

快速安装：
dsh plugin --profile web add github:GZT2023/dsh-compaction-pro


方式 B：本地打包安装

1.下载本仓库源码并解压。

2.进入源码目录，执行：


pnpm install
pnpm run build
pnpm pack

3.安装生成的 tgz 包：

dsh plugin --profile web add ./GZT2023-dsh-compaction-pro-0.2.0-fix.tgz



# dsh-compaction-pro

> DeepSeek Harness 的高保真上下文压缩后端 —— `dsh-compaction-basic` 的**无损升级替换**。
> 保留官方全部压力/保留/token 计量策略，只把"摘要质量"这一环换掉。

[![topic:dsh-plugin](https://img.shields.io/badge/dsh-plugin-compaction-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)](https://github.com/topics/dsh-plugin)

---

## 它解决什么问题

长会话里 dsh 会触发上下文压缩（compaction），把早期对话压成一个 checkpoint。官方后端 `dsh-compaction-basic` 的摘要提示词是**英文通用模板**，有两个痛点：

1. **丢精确值**：数字、文件路径、命令串、错误串、标识符常被"整理"或改写 —— 对**量化/编程 Agent 是致命的**（一个版本号、一个股票代码、一条命令被改掉，下游就错了）。
2. **只出英文**：中文用户的会话被压成英文摘要，回读割裂。

`dsh-compaction-pro` 只改 `summarize()` 这一环（官方文档明确标注的**唯一子类钩子**），其余策略全部继承官方实现。

---

## 与官方 `dsh-compaction-basic` 对比

| 维度 | `dsh-compaction-basic`（官方唯一实现） | `dsh-compaction-pro` |
|---|---|---|
| 摘要提示词 | 英文通用模板 | **高保真模板**：强制保留精确数值/路径/命令/标识符 |
| 语言 | 强制英文输出 | **跟随会话语言**（中文会话→中文摘要，代码/标识符逐字保留） |
| 决策还原 | 仅"关键决策" | **决策 + 理由 + 被否决的替代方案**（贴合真实推理方式） |
| 大区段处理 | 单次摘要，易在 `maxTokens` 处被截断 | **可选递归分块**：先压每块、再合并，长会话不丢信息 |
| 工具结果 | 笼统保留 | 单列「关键工具输出」段（返回结构/重要返回值/文件片段） |
| 自定义 | 无 | `customInstruction` 可整段替换提示词 |
| 策略/保留/计量 | 官方实现 | **完全一致**（继承自 `BasicCompactionEngine`） |

**一句话**：官方做"压得动"，pro 做"压不歪"。

---

## 快速开始

### 方式 A：本地开发（无需构建、无需发布）

dsh 的 loader 直接加载 `.ts` 源文件（内部 transpile；官方 dev 用 `node --import tsx`）。
把下面这段加进你的 `~/.dsh/cordis.patch.yml`（**升级安全**，重启自动重挂）：

> 若你的 dsh 构建只认已编译 JS，先 `npm run build` 再把 `name` 指向
> `lib/index.js` 即可，其余不变。

```yaml
- id: compaction-pro
  name: 'C:/Users/<you>/dsh-plugins/dsh-compaction-pro/src/index.ts'
  config:
    faithful: true
    recursive: true
    summaryLanguage: auto
    thresholdRatio: 0.8
    retainRatio: 0.16
    maxTokens: 8192
```

> ⚠️ **必做（否则 dsh 启动即崩）**：本插件与内置 `dsh-compaction-basic` 都注册同一个
> `ctx.compaction` 服务，二者**不能同时启用**。cordis 会在启动时抛
> `"ctx.compaction already provided"` 类错误。请在同一个 `cordis.patch.yml` 里**显式禁用
> basic**（下面两步放一起即可）：

```yaml
# 1) 禁用内置后端
- id: compaction-basic
  disabled: true
# 2) 注册 pro 后端
- id: compaction-pro
  name: 'C:/Users/<you>/dsh-plugins/dsh-compaction-pro/src/index.ts'
  config:
    faithful: true
    recursive: true
    summaryLanguage: auto
    thresholdRatio: 0.8
    retainRatio: 0.16
    maxTokens: 8192
```

### 方式 B：从 npm 安装（推荐）

```bash
dsh plugin --profile web add dsh-compaction-pro
```

安装后，仍需在 `~/.dsh/profiles/web/cordis.patch.yml` 里**禁用内置
`dsh-compaction-basic`**（见上方「⚠️ 必做」说明），否则两个 `ctx.compaction`
后端冲突、dsh 启动即崩。本插件已在 `apply()` 里打印启动自检横幅提示该冲突。

---

## 配置项

| 配置 | 类型 | 默认 | 含义 |
|---|---|---|---|
| `faithful` | boolean | `true` | 强制保留精确数值/路径/命令/标识符，绝不改写 |
| `summaryLanguage` | `'en' \| 'zh' \| 'auto'` | `'auto'` | 摘要语言；`auto` 跟随会话语言 |
| `recursive` | boolean | `true` | 大区段先分块压、再合并，避免截断丢信息 |
| `chunkMessages` | number | `40` | `recursive` 开启时每个分块的消息数 |
| `customInstruction` | string | — | 整段替换内置摘要提示词 |
| `thresholdRatio` | number | `0.8` | 上下文窗口的压缩触发比例（继承自官方） |
| `retainRatio` | number | `0.16` | 保留近期尾部的比例（继承自官方） |
| `maxTokens` | number | `8192` | 摘要生成上限（继承自官方） |
| `summarizationProvider` / `summarizationModel` | string | `''` | 留空则复用会话路由模型，否则钉死摘要模型 |

---

## 工作原理

```
BasicCompactionEngine  (官方：压力/保留/token 计量 + 事务)
        ▲ extends
ProCompactionEngine    (本插件：只重写 summarize() 钩子)
        ▲ 重写
proSummarize()
   ├─ 复用会话自身 system/tools/消息前缀 → ctx.llm.stream({ purpose: 'compaction' })
   │   （前缀缓存复用，不失效 provider 热缓存）
   ├─ 追加高保真提示词（faithful + 双语 + 决策/理由 + 工具输出）
   └─ recursive：区段过大时先分块压、再合并
```

- 注册为 `ctx.compaction`，**取代**内置后端；所有调用方（`compactIfNeeded` / `compactNow` / `/compact` 命令）无感切换。
- 摘要走 `ctx.llm.stream()` 直连，可在 `llm/stream` 处统一拦截；abort/资源释放会中止进行中的摘要。

---

## 开发 & 构建

```bash
npm install          # 安装 typescript / tsx（peer 由 dsh 运行时提供）
npm run typecheck    # 类型检查（无产物）
npm run build        # 产出 lib/（发布用）
```

本地联调：编辑 `src/*.ts` 后重启 dsh 即可（loader 直跑 `.ts`）。

---

## ⚠️ 开发陷阱（已踩，省你时间）

这些坑在官方文档里不会写，是实际对着已发布包类型定义踩出来的：

1. **`dsh-compaction-basic/src/summarizer` 子路径在已发布包里是死链接。**
   官方 README 暗示可以从 `…/src/summarizer` 拿 `SummarizationInput` / `SummaryResult`，
   但已发布的 npm 包**只含 `lib/` + `lib/types/`**，没有 `src/`；而且根入口
   `@deepseek-ai/dsh-compaction-basic` **不 re-export** 这两个类型。
   所以消费者无论类型检查还是运行时都拿不到它们。**本插件的解法**：在
   `src/types.ts` 里**逐字镜像**这两个类型（只依赖 `dsh-llm` 里确实导出的
   `ContentBlock/Message/ToolSchema/TokenUsage`），完全绕开死子路径。

2. **schemastery v3 没有静态 `literal` / `union` 工厂。**
   `z.literal('x')`、`z.union([...])` 会报 `Property 'literal' does not exist`。
   字符串枚举改用 `z.string()` 并在注释里写明取值集合；`object/number/string/
   boolean/array` 才是可用的静态工厂。

3. **类型检查要对着真实 dsh 运行时类型做。**
   `@deepseek-ai/*` 装在 dsh 自己的 `node_modules` 里。最稳的做法是把 dsh 运行时的
   `@deepseek-ai` 作用域整坨拷进本插件的 `node_modules/@deepseek-ai`（约 28MB），
   再普通 `tsc` 解析即可，不必折腾 `paths` / `baseUrl` 的 Windows 绝对路径坑。

4. **相对导入用 `.ts` 扩展名 + `allowImportingTsExtensions`。**
   `import { x } from './foo.ts'`，配合 `tsconfig` 的 `allowImportingTsExtensions: true`
   与 `noEmit: true`（发布构建时再切到 `.js` 扩展名）。

---

## 当前验证状态

- ✅ **类型检查通过**：对着真实 dsh 运行时类型（`@deepseek-ai/dsh-compaction-basic` 的
  `BasicCompactionEngine`、`protected summarize()` 钩子签名、`z.object` 配置形态）零报错。
  这证明了继承关系、`override` 签名、配置 schema 形状都正确。
- ✅ **运行时验证通过（2026-08-17）**：在真实 dsh web 实例（profile `web`，端口 8787）
  **干净启动、零错误日志**；`dsh --profile web --dump-config` 确认 `compaction-pro`
  作为**唯一** `ctx.compaction` 提供方生效、`compaction-basic` 已被禁用；浏览器实测
  `/compact` 命令可发现并触发。
- ⚠️ **尚未端到端验证**：摘要 LLM 的实际输出质量（faithful / 双语 / 递归分块）需要在
  配好 API Key 的真实会话里跑一次 `/compact` 才能确认。插件本身已确认正确加载与接管，
  这一步不影响"它作为后端生效"的结论。

---

## 测试

本插件带一套 **vitest** 单元测试，覆盖纯逻辑层（指令构建、配置解析、摘要编排），
并通过 mock 拦截 `@deepseek-ai/dsh-llm`，**无需真实 cordis 运行时或 API Key** 即可离线运行：

```bash
npm install      # 含 .npmrc：legacy-peer-deps，跳过重型 cordis 依赖
npm test         # vitest run —— 覆盖 buildInstruction / partialInstruction /
                 # mergeInstruction / resolveProConfig / proSummarize 全部分支
```

测试重点验证了修复过的真实缺陷：当 `summarizationProvider` / `summarizationModel`
未配置（文档默认"复用会话路由模型"）时，必须回落到路由模型而非崩溃。

CI 在每次 push / PR 到 `main` 时自动运行 `npm test`（见 `.github/workflows/ci.yml`）。

## 兼容性

- **测试版本**：`dsh` v0.1.0-rc.6（DeepSeek Harness 开发者预览期）。
- **API 稳定性警告**：dsh 处于早期、官方明确会有 **兼容性破坏性变更**。本插件通过继承
  `BasicCompactionEngine` 并复用其**内部实现细节**（`src/types.ts` 镜像了官方未导出的
  `SummarizationInput` / `SummaryResult`，构造函数需剥离 pro-only 配置键）。上游一旦改动
  这两个内部契约，本插件可能**静默失效或崩溃**——届时请升级到对应的 `dsh-compaction-pro`
  版本。README 的「开发陷阱」一节列出了全部已知耦合点，升级 dsh 后请优先核对。

## 许可证

MIT © dsh-compaction-pro contributors

> 标签：`deepseek-harness` · `dsh-plugin` · `compaction` · `context` · `summarization`
