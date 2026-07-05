import type { ActionFunctionArgs } from "react-router";

import type { ChatMessage } from "../openrouter.server";
import { authenticate } from "../shopify.server";
import { createChatCompletionStream } from "../openrouter.server";

const DEFAULT_MODEL = "deepseek/deepseek-v4-flash";

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);

  const body = (await request.json()) as {
    message?: string;
    model?: string;
    history?: ChatMessage[];
  };

  const message = body.message?.trim();
  const model = body.model || DEFAULT_MODEL;
  const history = Array.isArray(body.history) ? body.history : [];

  if (!message) {
    return Response.json({ error: "Please enter a message." }, { status: 400 });
  }

  const messages: ChatMessage[] = [
    ...history,
    { role: "user", content: message },
  ];

  const result = await createChatCompletionStream(messages, model);

  if ("error" in result) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  return result;
};
