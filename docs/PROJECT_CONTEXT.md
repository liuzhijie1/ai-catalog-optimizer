# AI Catalog Optimizer — 项目上下文

> 本文档是项目的单一事实来源（Single Source of Truth）。在 Cursor 中开发时可直接 `@docs/PROJECT_CONTEXT.md` 引用，无需重复粘贴背景信息。

最后更新：2026-07-05

---

## 项目背景

**产品名**：ai-catalog-optimizer（Shopify App）

**GitHub**：https://github.com/liuzhijie1/ai-catalog-optimizer

**一句话定位**：帮 Shopify 商家优化商品数据（标题 / 描述 / 标签 / 属性），让商品更容易被 AI 购物助手（ChatGPT、Gemini、Copilot 等）搜索和推荐。

**核心卖点**：「Shopify Magic 帮你写描述，我们帮你卖给 AI」

### 市场逻辑

- 2026 年 Shopify 已默认为所有符合条件的商家开启 Agentic Storefronts，商品自动进入 Shopify Catalog 并被同步到 ChatGPT / Gemini / Copilot 等 AI 平台
- AI 推荐商品依赖结构化数据质量（标题、描述、属性、标签），大多数商家数据质量差
- 现有竞品（ChatGPT-AI Product Description、GoWise 等）主要面向传统 Google SEO，缺少针对 AI 渠道推荐逻辑的优化产品——这是差异化空白
- Shopify 免费内置的 Shopify Magic 只做基础描述生成，同样不覆盖 AI 渠道优化

---

## 技术栈

| 类别 | 选型 |
|------|------|
| 框架 | React Router 7 + TypeScript（Shopify CLI 官方模板，原 Remix 架构） |
| UI | **Polaris UI Kit** 设计规范，代码层使用 **Polaris Web Components**（`s-page`、`s-button`、`s-text-field` 等） |
| 数据库 | Prisma（模板自带，存 session） |
| LLM | OpenRouter API（OpenAI SDK 兼容格式） |
| Shopify API | Admin GraphQL API |
| 部署计划 | Vercel 或 Railway |

### LLM 配置

- **环境变量**：`OPENROUTER_API_KEY`（根目录 `.env`，已加入 `.gitignore`）
- **当前 Playground 默认模型**：`deepseek/deepseek-v4-flash`（已验证可用）
- **计划**：
  - 开发调试：`deepseek/*` 系列（省钱）
  - 生产优化：`anthropic/claude-sonnet-4.5`（质量）
- **模型切换**：通过 `LLM_PROVIDER` 环境变量 + 适配层切换，不写死在业务代码里（待实现）

### Shopify Scopes

当前 `shopify.app.toml` 配置：

```
write_products, write_metaobjects, write_metaobject_definition
```

**待补充**：`read_products`（商品列表页需要读取商品）

### 开发者背景

- 前端工程师，熟悉 Node
- 位于中国大陆，因此使用 OpenRouter 而非 Anthropic 直连

### UI 开发参考

- Polaris Web Components：https://shopify.dev/docs/api/app-home/using-polaris-components
- 设计规范：Polaris UI Kit

---

## 当前进度

### ✅ 已完成

| 项 | 说明 |
|----|------|
| Shopify Partner 账号 + development store | 已创建 |
| 项目初始化 | `shopify app init`（React Router 7 + TS 模板） |
| 本地开发 | `shopify app dev` 成功运行，App 已嵌入测试店铺后台 |
| 环境变量 | `.env` 配置完成（`OPENROUTER_API_KEY`） |
| GitHub 仓库 | liuzhijie1/ai-catalog-optimizer |
| App 图标 | 1200×1200 PNG（深墨蓝底 + 荧光绿星芒，2×2 商品网格概念） |
| OpenRouter 基础集成 | `app/openrouter.server.ts`，API Key 只在服务端 |
| Playground 对话测试页 | `/app/playground`，含 SSE 流式响应 + 自适应打字机效果 |

### ❌ 未完成

| 项 | 说明 |
|----|------|
| 商品列表页 | `app/routes/app.products.tsx` 尚未创建 |
| LLM 优化引擎 | 无 `optimizer.server.ts`，无优化 Prompt |
| 优化对比预览 UI | 无优化前后对比 + 评分展示 |
| 写回 Shopify | 无 `productUpdate` 优化流程 |
| 批量优化 | 未实现 |
| Billing API | 无免费额度 / Pro 订阅 |
| 部署 | `application_url` 仍为 `example.com` |
| App Store 上架 | 未开始 |
| `LLM_PROVIDER` 模型适配层 | 未实现 |
| 首页替换 | `app._index.tsx` 仍是模板 Demo（生成 snowboard） |

---

## 开发路线图

| 阶段 | 内容 | 状态 |
|------|------|------|
| 1 | 环境跑通 | ✅ 完成 |
| 1.5 | OpenRouter Playground（API Key 验证 + 流式对话） | ✅ 完成 |
| 2 | 商品列表页（Admin GraphQL 读取商品） | ❌ 下一步 |
| 3 | LLM 优化引擎（`optimizer.server.ts` + action） | 待做 |
| 4 | 优化前后对比预览 UI + 一键应用写回 | 待做 |
| 5 | 批量优化 + Billing API 收费 | 待做 |
| 6 | 部署 + 提交 App Store 审核 | 待做 |

---

## 核心功能设计

### 优化流程

```
loader 拉取商品（Admin GraphQL）
  → 商家点「优化」→ action 调 OpenRouter
  → 返回 JSON：{ title, description, tags, score_before, score_after, improvements }
  → 前端展示优化前后对比 + 评分
  → 商家确认 → productUpdate mutation 写回 Shopify
```

### LLM Prompt 优化原则（已定稿）

1. 标题 = 品牌 + 品类 + 核心特征 + 适用场景
2. 描述前两句说清「给谁用、解决什么问题」
3. 补全 AI 匹配属性：材质、尺寸、场景、人群
4. 标签覆盖自然语言搜索意图
5. 要求只返回纯 JSON，代码里做 ` ```json ` 围栏清理

### 架构约定

- LLM 调用封装在 `app/services/*.server.ts`（`.server` 后缀保证不进浏览器）
- 写模型适配层，通过 `LLM_PROVIDER` 环境变量切换模型，不写死
- API Key 只在服务端使用，绝不出现在前端代码
- UI 遵循 Polaris UI Kit，使用 Polaris Web Components

---

## 商业模式

| 计划 | 内容 |
|------|------|
| 免费版 | 每月优化 10 个商品 |
| Pro 版 | $29/月，无限量 + 批量处理 |
| Shopify 收入分成 | 前 $1M 收入 0 抽佣 |
| 定价参考 | 付费 App 平均 $58~67/月，先低价切入 |

---

## 代码结构（关键文件）

```
app/
├── openrouter.server.ts          # OpenRouter API 封装（chat + stream）
├── hooks/
│   └── useAdaptiveTypewriter.ts  # 流式打字机效果
├── utils/
│   └── openrouter-stream.client.ts  # 客户端 SSE 解析
├── routes/
│   ├── app.tsx                   # App 布局 + 导航
│   ├── app._index.tsx            # 首页（当前为模板 Demo，待替换）
│   ├── app.playground.tsx        # OpenRouter 对话测试页
│   ├── app.playground.stream.tsx # 流式 API 端点
│   ├── app.additional.tsx        # 模板附加页（可后续删除）
│   └── app.products.tsx          # 【待建】商品列表页
├── shopify.server.ts             # Shopify 认证
└── db.server.ts                  # Prisma 客户端

docs/
└── PROJECT_CONTEXT.md            # 本文档

.env                              # OPENROUTER_API_KEY（不提交 Git）
shopify.app.toml                  # App 配置 + scopes
```

### 导航结构（当前）

- Home → `/app`
- Playground → `/app/playground`
- Additional page → `/app/additional`（模板遗留，后续可移除）

### 导航结构（计划）

- Dashboard → `/app`
- Products → `/app/products`
- Playground → `/app/playground`（开发调试用，上线前可隐藏）

---

## 阶段 2 下一步（商品列表页）

1. 在 `shopify.app.toml` 补充 `read_products` scope
2. 新建 `app/routes/app.products.tsx`
   - **loader**：`admin.graphql` 拉取商品列表（title、status、featuredImage、tags 等）
   - **UI**：Polaris Web Components 列表展示
3. 在 `app/routes/app.tsx` 导航栏添加 Products 入口
4. 后续逐步替换 `app._index.tsx` 模板 Demo 为 Dashboard

---

## Cursor 使用方式

在 Cursor 对话中引用本文档：

```
@docs/PROJECT_CONTEXT.md 继续开发阶段 2 商品列表页
```

或在 Cursor Rules 中加入：

```
开发前请先阅读 docs/PROJECT_CONTEXT.md 了解项目背景、架构约定和当前进度。
```
