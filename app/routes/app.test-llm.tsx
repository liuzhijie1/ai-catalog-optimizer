import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { getActiveModel } from "../services/llm.server";
import { optimizeForAI } from "../services/optimizer.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  try {
    const result = await optimizeForAI({
      title: "Blue Shoes",
      description: "Good shoes, very comfortable",
      productType: "Shoes",
      tags: "shoes",
    });

    return { ok: true as const, model: getActiveModel(), result };
  } catch (error) {
    return {
      ok: false as const,
      model: getActiveModel(),
      error: error instanceof Error ? error.message : "Optimization failed.",
    };
  }
};

export default function TestLlmPage() {
  const data = useLoaderData<typeof loader>();

  return (
    <s-page heading="LLM Test">
      <s-section heading="Optimize sample product">
        <s-paragraph>
          Runs <s-text type="strong">optimizeForAI</s-text> against a hardcoded
          sample product. Model: <s-text type="strong">{data.model}</s-text>
        </s-paragraph>

        {!data.ok && (
          <s-banner tone="critical">{data.error}</s-banner>
        )}

        {data.ok && data.result.inferred_notes.length > 0 && (
          <s-banner tone="warning">
            {data.result.inferred_notes.length} inferred note(s) — review before
            applying to Shopify.
          </s-banner>
        )}

        {data.ok && (
          <s-banner tone="success">
            Optimization succeeded. score_before: {data.result.score_before} →
            score_after: {data.result.score_after}
          </s-banner>
        )}

        <s-box
          padding="base"
          borderWidth="base"
          borderRadius="base"
          background="subdued"
        >
          <pre
            style={{
              margin: 0,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            <code>{JSON.stringify(data, null, 2)}</code>
          </pre>
        </s-box>
      </s-section>

      <s-section slot="aside" heading="Input">
        <s-unordered-list>
          <s-list-item>title: Blue Shoes</s-list-item>
          <s-list-item>description: Good shoes, very comfortable</s-list-item>
          <s-list-item>productType: Shoes</s-list-item>
          <s-list-item>tags: shoes</s-list-item>
        </s-unordered-list>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
