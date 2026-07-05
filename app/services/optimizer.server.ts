import { chat } from "./llm.server";

export interface OptimizeResult {
  title: string;
  description: string;
  tags: string[];
  score_before: number;
  score_after: number;
  improvements: string[];
  /** Facts inferred or added that were not explicitly in the original product data */
  inferred_notes: string[];
}

export interface OptimizeInput {
  title: string;
  description: string;
  productType: string;
  tags: string;
}

function buildPrompt(product: OptimizeInput): string {
  return `你是电商 AI 渠道优化专家。AI 购物助手（ChatGPT、Gemini）推荐商品时依赖结构化数据。

请优化以下商品，让它更容易被 AI 搜索匹配和推荐：

标题：${product.title}
描述：${product.description || "（无描述）"}
类型：${product.productType || "（未分类）"}
标签：${product.tags || "（无标签）"}

优化原则：
1. 标题优先包含：品类 + 核心特征 + 适用场景；仅当输入中明确出现品牌时才写品牌
2. 描述前两句说清"给谁用、解决什么问题"
3. 补充 AI 匹配属性（材质、尺寸、场景、人群），但只能写输入中已有或可合理概括的内容
4. 标签覆盖用户自然语言搜索意图，基于已有信息扩展同义词
5. 保持商品原语言（英文商品输出英文）

事实约束（必须严格遵守）：
1. 严禁编造输入中未出现的具体事实：品牌名、材质名、具体尺寸/尺码、产地、认证、型号等
2. 输入无品牌时，标题不要添加任何虚构品牌
3. 输入无材质/尺寸等属性时：不要写具体材料或数值；可省略该属性，或写笼统表述（如 "comfortable fit"），或写 "Specifications not provided"
4. 不要为让文案更完整而捏造产品细节；宁可简短准确，也不要丰富但虚假
5. improvements 中用 "[Grounded]" 标记基于原数据的改动，用 "[Inferred]" 标记推断性补充（推断应尽量少）
6. 所有推断性内容必须同步写入 inferred_notes，供商家审核

只返回 JSON，不要任何其他内容：
{
  "title": "...",
  "description": "...(HTML)",
  "tags": ["..."],
  "score_before": 45,
  "score_after": 88,
  "improvements": ["[Grounded] ...", "[Inferred] ..."],
  "inferred_notes": ["..."]
}`;
}

function parseOptimizeResult(raw: string): OptimizeResult {
  const clean = raw.replace(/```json\s*|```/gi, "").trim();
  const jsonMatch = clean.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    throw new Error("LLM response did not contain JSON.");
  }

  const parsed = JSON.parse(jsonMatch[0]) as Partial<OptimizeResult>;

  if (
    typeof parsed.title !== "string" ||
    typeof parsed.description !== "string" ||
    !Array.isArray(parsed.tags) ||
    typeof parsed.score_before !== "number" ||
    typeof parsed.score_after !== "number" ||
    !Array.isArray(parsed.improvements)
  ) {
    throw new Error("LLM response JSON is missing required fields.");
  }

  return {
    title: parsed.title,
    description: parsed.description,
    tags: parsed.tags.map(String),
    score_before: parsed.score_before,
    score_after: parsed.score_after,
    improvements: parsed.improvements.map(String),
    inferred_notes: Array.isArray(parsed.inferred_notes)
      ? parsed.inferred_notes.map(String)
      : [],
  };
}

export async function optimizeForAI(
  product: OptimizeInput,
): Promise<OptimizeResult> {
  const raw = await chat(buildPrompt(product));
  return parseOptimizeResult(raw);
}
