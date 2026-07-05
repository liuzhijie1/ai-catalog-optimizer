import { useCallback, useEffect, useRef, useState } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { useAdaptiveTypewriter } from "../hooks/useAdaptiveTypewriter";
import type { ChatMessage } from "../openrouter.server";
import { getOpenRouterApiKey } from "../openrouter.server";
import { authenticate } from "../shopify.server";
import { consumeOpenRouterStream } from "../utils/openrouter-stream.client";

const DEFAULT_MODEL = "deepseek/deepseek-v4-flash";

type StreamingState = {
  userMessage: string;
  content: string;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  return {
    hasApiKey: Boolean(getOpenRouterApiKey()),
    defaultModel: DEFAULT_MODEL,
  };
};

export default function Playground() {
  const { hasApiKey, defaultModel } = useLoaderData<typeof loader>();

  const [model, setModel] = useState(defaultModel);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState<StreamingState | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSuccess, setLastSuccess] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const isAnimating =
    Boolean(streaming) &&
    (isStreaming || streaming!.content.length > 0);
  const displayContent = useAdaptiveTypewriter(
    streaming?.content ?? "",
    isAnimating,
  );

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming, displayContent, isStreaming]);

  useEffect(() => {
    if (!streaming || isStreaming) return;
    if (displayContent !== streaming.content) return;

    setMessages((prev) => [
      ...prev,
      { role: "user", content: streaming.userMessage },
      { role: "assistant", content: streaming.content },
    ]);
    setStreaming(null);
    setLastSuccess(Boolean(streaming.content));
  }, [streaming, isStreaming, displayContent]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const handleSubmit = useCallback(async () => {
    const message = input.trim();
    if (!message || isStreaming || !hasApiKey) return;

    abortRef.current?.abort();
    const abortController = new AbortController();
    abortRef.current = abortController;

    setInput("");
    setError(null);
    setLastSuccess(false);
    setIsStreaming(true);
    setStreaming({ userMessage: message, content: "" });

    try {
      const response = await fetch("/app/playground/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          model,
          history: messages,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || `Request failed (${response.status})`);
      }

      await consumeOpenRouterStream(response, (chunk) => {
        setStreaming((prev) =>
          prev ? { ...prev, content: prev.content + chunk } : prev,
        );
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setStreaming(null);
        return;
      }

      setStreaming(null);
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsStreaming(false);
    }
  }, [hasApiKey, input, isStreaming, messages, model]);

  const handleClear = () => {
    abortRef.current?.abort();
    setMessages([]);
    setStreaming(null);
    setIsStreaming(false);
    setError(null);
    setLastSuccess(false);
  };

  const isBusy = isStreaming || Boolean(streaming);

  return (
    <s-page heading="Playground">
      <style>{`
        @keyframes playground-cursor-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
      <s-button
        slot="primary-action"
        onClick={handleClear}
        disabled={messages.length === 0 && !streaming}
      >
        Clear chat
      </s-button>

      <s-section heading="OpenRouter API Test">
        <s-paragraph>
          Send a message to verify your OpenRouter API key. Responses stream in
          real time with an adaptive typewriter effect.
        </s-paragraph>

        {!hasApiKey && (
          <s-banner tone="critical">
            OPENROUTER_API_KEY is not set. Add it to your .env file and restart
            the dev server.
          </s-banner>
        )}

        {error && <s-banner tone="critical">{error}</s-banner>}

        {lastSuccess && !error && !isBusy && (
          <s-banner tone="success">
            API key is working. Last response streamed successfully.
          </s-banner>
        )}

        <s-text-field
          label="Model"
          value={model}
          onChange={(e) => setModel(e.currentTarget.value)}
          details="e.g. deepseek/deepseek-v4-flash, openai/gpt-4o-mini, anthropic/claude-sonnet-4"
          autocomplete="off"
        />

        <s-box
          padding="base"
          borderWidth="base"
          borderRadius="base"
          background="subdued"
        >
          <div
            style={{
              minHeight: "320px",
              maxHeight: "480px",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            {messages.length === 0 && !streaming && (
              <s-text tone="neutral">
                No messages yet. Type something below to start a conversation.
              </s-text>
            )}

            {messages.map((msg, index) => (
              <ChatBubble key={index} role={msg.role} content={msg.content} />
            ))}

            {streaming && (
              <>
                <ChatBubble role="user" content={streaming.userMessage} />
                <ChatBubble
                  role="assistant"
                  content={displayContent}
                  showCursor={isBusy}
                />
              </>
            )}

            <div ref={chatEndRef} />
          </div>
        </s-box>

        <s-stack direction="inline" gap="base">
          <div style={{ flex: 1 }}>
            <s-text-field
              label="Message"
              value={input}
              onChange={(e) => setInput(e.currentTarget.value)}
              autocomplete="off"
              disabled={!hasApiKey || isBusy}
            />
          </div>
          <div style={{ alignSelf: "flex-end" }}>
            <s-button
              onClick={handleSubmit}
              disabled={!hasApiKey || !input.trim() || isBusy}
              {...(isBusy ? { loading: true } : {})}
            >
              Send
            </s-button>
          </div>
        </s-stack>
      </s-section>

      <s-section slot="aside" heading="Tips">
        <s-unordered-list>
          <s-list-item>
            API key status:{" "}
            <s-text type="strong">{hasApiKey ? "Configured" : "Missing"}</s-text>
          </s-list-item>
          <s-list-item>
            Default model: <s-text type="strong">{defaultModel}</s-text>
          </s-list-item>
          <s-list-item>
            Browse models at{" "}
            <s-link href="https://openrouter.ai/models" target="_blank">
              openrouter.ai/models
            </s-link>
          </s-list-item>
        </s-unordered-list>
      </s-section>
    </s-page>
  );
}

function ChatBubble({
  role,
  content,
  showCursor = false,
}: {
  role: ChatMessage["role"];
  content: string;
  showCursor?: boolean;
}) {
  const isUser = role === "user";

  return (
    <div
      style={{
        alignSelf: isUser ? "flex-end" : "flex-start",
        maxWidth: "85%",
      }}
    >
      <s-box
        padding="base"
        borderRadius="base"
        background={isUser ? "base" : "subdued"}
        borderWidth="base"
      >
        <s-text tone="neutral" type="strong">
          {isUser ? "You" : "Assistant"}
        </s-text>
        <div style={{ marginTop: "4px", whiteSpace: "pre-wrap" }}>
          {content}
          {showCursor && (
            <span
              style={{
                display: "inline-block",
                width: "2px",
                height: "1em",
                marginLeft: "2px",
                verticalAlign: "text-bottom",
                background: "currentColor",
                animation: "playground-cursor-blink 1s step-end infinite",
              }}
            />
          )}
        </div>
      </s-box>
    </div>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
