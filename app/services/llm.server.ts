import OpenAI from "openai";

const DEFAULT_DEV_MODEL = "deepseek/deepseek-v4-flash";
const DEFAULT_PROD_MODEL = "anthropic/claude-sonnet-4.5";

function getModel(): string {
  if (process.env.LLM_MODEL) {
    return process.env.LLM_MODEL;
  }

  return process.env.NODE_ENV === "production"
    ? DEFAULT_PROD_MODEL
    : DEFAULT_DEV_MODEL;
}

function getClient(): OpenAI {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured.");
  }

  return new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey,
    defaultHeaders: {
      "HTTP-Referer": process.env.SHOPIFY_APP_URL || "https://localhost",
      "X-OpenRouter-Title": "AI Catalog Optimizer",
    },
  });
}

export async function chat(prompt: string): Promise<string> {
  const client = getClient();
  const model = getModel();

  const completion = await client.chat.completions.create({
    model,
    messages: [{ role: "user", content: prompt }],
  });

  const content = completion.choices[0]?.message?.content;

  if (!content) {
    throw new Error("LLM returned an empty response.");
  }

  return content;
}

export function getActiveModel(): string {
  return getModel();
}
