const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

export type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      role: string;
      content: string;
    };
  }>;
  error?: {
    message?: string;
    code?: number;
  };
};

export function getOpenRouterApiKey(): string | undefined {
  return process.env.OPENROUTER_API_KEY;
}

export async function createChatCompletionStream(
  messages: ChatMessage[],
  model = "deepseek/deepseek-v4-flash",
): Promise<Response | { error: string }> {
  const apiKey = getOpenRouterApiKey();

  if (!apiKey) {
    return { error: "OPENROUTER_API_KEY is not configured in environment variables." };
  }

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.SHOPIFY_APP_URL || "https://localhost",
      "X-OpenRouter-Title": "AI Catalog Optimizer",
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
    }),
  });

  if (!response.ok) {
    const data = (await response.json()) as ChatCompletionResponse;
    return {
      error: data.error?.message || `OpenRouter request failed (${response.status})`,
    };
  }

  if (!response.body) {
    return { error: "OpenRouter returned an empty stream." };
  }

  return new Response(response.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

export async function createChatCompletion(
  messages: ChatMessage[],
  model = "deepseek/deepseek-v4-flash",
): Promise<{ content: string } | { error: string }> {
  const apiKey = getOpenRouterApiKey();

  if (!apiKey) {
    return { error: "OPENROUTER_API_KEY is not configured in environment variables." };
  }

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.SHOPIFY_APP_URL || "https://localhost",
      "X-OpenRouter-Title": "AI Catalog Optimizer",
    },
    body: JSON.stringify({
      model,
      messages,
    }),
  });

  const data = (await response.json()) as ChatCompletionResponse;

  if (!response.ok) {
    return {
      error: data.error?.message || `OpenRouter request failed (${response.status})`,
    };
  }

  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    return { error: "OpenRouter returned an empty response." };
  }

  return { content };
}
