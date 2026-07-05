import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher, useLoaderData, useRevalidator } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";

import {
  BatchOptimizeProgress,
  type BatchItemResult,
  type BatchRunState,
} from "../components/BatchOptimizeProgress";
import { OptimizePreviewModal } from "../components/OptimizePreviewModal";
import { UpgradeButton } from "../components/UpgradeButton";
import type { OptimizeResult } from "../services/optimizer.server";
import {
  applyProductOptimization,
  fetchProductNode,
  optimizeAndApplyProduct,
  optimizeProduct,
} from "../services/product-optimize.server";
import { logOptimizationApplied } from "../services/optimization-log.server";
import { syncShopPlanFromBilling } from "../services/billing.server";
import { getUsageSummary, type UsageSummary } from "../services/usage.server";
import { authenticate } from "../shopify.server";
import type { ProductListItem } from "../types/product";

const PRODUCTS_QUERY = `#graphql
  query ProductsList($first: Int!) {
    products(first: $first, sortKey: UPDATED_AT, reverse: true) {
      nodes {
        id
        title
        handle
        status
        description
        productType
        tags
        updatedAt
        featuredMedia {
          preview {
            image {
              url
              altText
            }
          }
        }
      }
    }
  }
`;

type OptimizeActionData = {
  intent: "optimize";
  product: ProductListItem;
  result: OptimizeResult;
  usage: UsageSummary;
};

type OptimizeApplyActionData = {
  intent: "optimize-and-apply";
  productId: string;
  title: string;
  usage: UsageSummary;
};

type ApplyActionData = {
  intent: "apply";
  success: true;
  productId: string;
};

type ErrorActionData = {
  intent: "optimize" | "apply" | "optimize-and-apply";
  error: string;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, billing, session } = await authenticate.admin(request);
  await syncShopPlanFromBilling(session.shop, billing);
  const usage = await getUsageSummary(session.shop);

  const response = await admin.graphql(PRODUCTS_QUERY, {
    variables: { first: 25 },
  });

  const responseJson = await response.json();
  const data = responseJson.data;

  if (!data?.products) {
    throw new Response("Failed to load products", { status: 500 });
  }

  const products: ProductListItem[] = (data.products.nodes ?? []).map(
    (node: {
      id: string;
      title: string;
      handle: string;
      status: ProductListItem["status"];
      description: string;
      productType: string;
      tags: string[];
      updatedAt: string;
      featuredMedia?: {
        preview?: {
          image?: {
            url?: string;
            altText?: string | null;
          };
        };
      };
    }) => ({
      id: node.id,
      title: node.title,
      handle: node.handle,
      status: node.status,
      description: node.description,
      productType: node.productType,
      tags: node.tags,
      updatedAt: node.updatedAt,
      imageUrl: node.featuredMedia?.preview?.image?.url ?? null,
      imageAlt: node.featuredMedia?.preview?.image?.altText ?? node.title,
    }),
  );

  return { products, usage };
};

function toListProduct(
  node: Awaited<ReturnType<typeof fetchProductNode>>,
  product?: ProductListItem,
): ProductListItem {
  return {
    id: node.id,
    title: node.title,
    handle: product?.handle ?? "",
    status: product?.status ?? "ACTIVE",
    description: node.description,
    productType: node.productType,
    tags: node.tags,
    updatedAt: product?.updatedAt ?? "",
    imageUrl: product?.imageUrl ?? null,
    imageAlt: product?.imageAlt ?? node.title,
  };
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "optimize") {
    const productId = formData.get("productId");
    if (typeof productId !== "string" || !productId) {
      return { intent: "optimize", error: "Missing product ID." } satisfies ErrorActionData;
    }

    try {
      const node = await fetchProductNode(admin, productId);
      const { result, usage } = await optimizeProduct(session.shop, node);

      return {
        intent: "optimize",
        product: toListProduct(node),
        result,
        usage,
      } satisfies OptimizeActionData;
    } catch (error) {
      return {
        intent: "optimize",
        error:
          error instanceof Error ? error.message : "Optimization failed.",
      } satisfies ErrorActionData;
    }
  }

  if (intent === "optimize-and-apply") {
    const productId = formData.get("productId");
    if (typeof productId !== "string" || !productId) {
      return {
        intent: "optimize-and-apply",
        error: "Missing product ID.",
      } satisfies ErrorActionData;
    }

    try {
      const result = await optimizeAndApplyProduct(
        admin,
        session.shop,
        productId,
      );

      return {
        intent: "optimize-and-apply",
        productId: result.productId,
        title: result.title,
        usage: result.usage,
      } satisfies OptimizeApplyActionData;
    } catch (error) {
      return {
        intent: "optimize-and-apply",
        error:
          error instanceof Error ? error.message : "Batch item failed.",
      } satisfies ErrorActionData;
    }
  }

  if (intent === "apply") {
    const productId = formData.get("productId");
    const title = formData.get("title");
    const descriptionHtml = formData.get("descriptionHtml");
    const tagsJson = formData.get("tags");
    const scoreBefore = formData.get("scoreBefore");
    const scoreAfter = formData.get("scoreAfter");
    const productTitle = formData.get("productTitle");

    if (
      typeof productId !== "string" ||
      typeof title !== "string" ||
      typeof descriptionHtml !== "string" ||
      typeof tagsJson !== "string"
    ) {
      return { intent: "apply", error: "Missing product data." } satisfies ErrorActionData;
    }

    let tags: string[];
    try {
      tags = JSON.parse(tagsJson) as string[];
    } catch {
      return { intent: "apply", error: "Invalid tags data." } satisfies ErrorActionData;
    }

    try {
      await applyProductOptimization(admin, productId, {
        title,
        description: descriptionHtml,
        tags,
      });

      if (
        typeof scoreBefore === "string" &&
        typeof scoreAfter === "string" &&
        typeof productTitle === "string"
      ) {
        await logOptimizationApplied({
          shop: session.shop,
          productId,
          productTitle,
          scoreBefore: Number(scoreBefore),
          scoreAfter: Number(scoreAfter),
        });
      }

      return {
        intent: "apply",
        success: true,
        productId,
      } satisfies ApplyActionData;
    } catch (error) {
      return {
        intent: "apply",
        error: error instanceof Error ? error.message : "Update failed.",
      } satisfies ErrorActionData;
    }
  }

  return { intent: "optimize", error: "Unknown action." } satisfies ErrorActionData;
};

function truncate(text: string, maxLength = 120) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength)}…`;
}

function statusTone(status: ProductListItem["status"]) {
  switch (status) {
    case "ACTIVE":
      return "success";
    case "DRAFT":
      return "warning";
    case "ARCHIVED":
      return "neutral";
    default:
      return "neutral";
  }
}

function formatStatus(status: ProductListItem["status"]) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function getModalElement() {
  return document.getElementById("optimize-preview-modal") as
    | (HTMLElement & { showOverlay: () => void; hideOverlay: () => void })
    | null;
}

async function submitBatchItem(productId: string) {
  const formData = new FormData();
  formData.set("intent", "optimize-and-apply");
  formData.set("productId", productId);

  const response = await fetch("/app/products", {
    method: "POST",
    body: formData,
    credentials: "same-origin",
  });

  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }

  return (await response.json()) as OptimizeApplyActionData | ErrorActionData;
}

export default function ProductsPage() {
  const { products, usage } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const revalidator = useRevalidator();
  const shopify = useAppBridge();

  const [preview, setPreview] = useState<{
    product: ProductListItem;
    result: OptimizeResult;
  } | null>(null);
  const [optimizingId, setOptimizingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batch, setBatch] = useState<BatchRunState | null>(null);

  const isBatchRunning = batch?.status === "running";
  const isBusy = fetcher.state !== "idle" || isBatchRunning;
  const isApplying =
    fetcher.state !== "idle" && fetcher.formData?.get("intent") === "apply";

  const selectedProducts = useMemo(
    () => products.filter((p) => selectedIds.has(p.id)),
    [products, selectedIds],
  );

  const allSelected =
    products.length > 0 && selectedIds.size === products.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;

    if ("error" in fetcher.data && fetcher.data.error) {
      setActionError(fetcher.data.error);
      setOptimizingId(null);
      shopify.toast.show(fetcher.data.error, { isError: true });
      return;
    }

    const data = fetcher.data;

    if (data.intent === "optimize" && "result" in data && data.result && data.product) {
      const listProduct =
        products.find((p) => p.id === data.product.id) ?? data.product;
      setPreview({
        product: listProduct,
        result: data.result,
      });
      setOptimizingId(null);
      setActionError(null);
      requestAnimationFrame(() => getModalElement()?.showOverlay());
      return;
    }

    if (fetcher.data.intent === "apply" && "success" in fetcher.data) {
      getModalElement()?.hideOverlay();
      setPreview(null);
      setActionError(null);
      shopify.toast.show("Product updated in Shopify");
    }
  }, [fetcher.state, fetcher.data, shopify, products]);

  const toggleSelect = (productId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(productId);
      else next.delete(productId);
      return next;
    });
  };

  const toggleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? new Set(products.map((p) => p.id)) : new Set());
  };

  const runBatch = useCallback(
    async (queue: ProductListItem[]) => {
      if (queue.length === 0) return;

      setBatch({
        status: "running",
        total: queue.length,
        completed: 0,
        results: [],
        queue,
      });
      setActionError(null);

      const results: BatchItemResult[] = [];

      for (let i = 0; i < queue.length; i++) {
        const product = queue[i];

        try {
          const data = await submitBatchItem(product.id);

          if ("error" in data && data.error) {
            results.push({
              productId: product.id,
              title: product.title,
              ok: false,
              error: data.error,
            });
          } else {
            results.push({
              productId: product.id,
              title: product.title,
              ok: true,
            });
          }
        } catch (error) {
          results.push({
            productId: product.id,
            title: product.title,
            ok: false,
            error: error instanceof Error ? error.message : "Request failed.",
          });
        }

        setBatch((prev) =>
          prev
            ? {
                ...prev,
                completed: i + 1,
                results: [...results],
              }
            : prev,
        );
      }

      setBatch((prev) => (prev ? { ...prev, status: "done" } : prev));
      setSelectedIds(new Set());
      revalidator.revalidate();

      const succeeded = results.filter((r) => r.ok).length;
      const failed = results.length - succeeded;
      shopify.toast.show(
        failed > 0
          ? `Batch done: ${succeeded} succeeded, ${failed} failed`
          : `Batch done: ${succeeded} products optimized`,
        failed > 0 ? { isError: true } : undefined,
      );
    },
    [revalidator, shopify],
  );

  const handleBatchStart = () => {
    if (selectedProducts.length === 0 || usage.isLimited) return;

    const remaining = usage.remaining ?? selectedProducts.length;
    const queue =
      usage.plan === "pro"
        ? selectedProducts
        : selectedProducts.slice(0, remaining);

    if (queue.length === 0) {
      shopify.toast.show("No optimizations remaining this month.", {
        isError: true,
      });
      return;
    }

    if (
      usage.plan === "free" &&
      selectedProducts.length > queue.length
    ) {
      shopify.toast.show(
        `Only ${queue.length} item(s) will run due to Free plan quota.`,
      );
    }

    void runBatch(queue);
  };

  const handleRetryFailed = () => {
    if (!batch) return;

    const failedIds = new Set(
      batch.results.filter((r) => !r.ok).map((r) => r.productId),
    );
    const queue = batch.queue.filter((p) => failedIds.has(p.id));

    void runBatch(queue);
  };

  const handleOptimize = (product: ProductListItem) => {
    setActionError(null);
    setOptimizingId(product.id);
    fetcher.submit(
      { intent: "optimize", productId: product.id },
      { method: "POST" },
    );
  };

  const handleApply = () => {
    if (!preview) return;

    fetcher.submit(
      {
        intent: "apply",
        productId: preview.product.id,
        productTitle: preview.product.title,
        title: preview.result.title,
        descriptionHtml: preview.result.description,
        tags: JSON.stringify(preview.result.tags),
        scoreBefore: String(preview.result.score_before),
        scoreAfter: String(preview.result.score_after),
      },
      { method: "POST" },
    );
  };

  const handleCloseModal = () => {
    setPreview(null);
  };

  return (
    <s-page heading="Products">
      {selectedIds.size > 0 && (
        <s-button
          slot="primary-action"
          onClick={handleBatchStart}
          disabled={isBusy || usage.isLimited}
          {...(isBatchRunning ? { loading: true } : {})}
        >
          Optimize selected ({selectedIds.size})
        </s-button>
      )}

      {usage.plan === "pro" ? (
        <s-banner tone="success">Pro plan — unlimited optimizations</s-banner>
      ) : usage.isLimited ? (
        <s-banner tone="warning">
          <s-stack direction="inline" gap="base">
            <s-text>
              You&apos;ve used all {usage.limit} free optimizations this month.
              Upgrade to Pro for unlimited access.
            </s-text>
            <UpgradeButton />
          </s-stack>
        </s-banner>
      ) : (
        <s-banner tone="info">
          {usage.used}/{usage.limit} optimizations used this month (
          {usage.remaining} remaining on Free plan)
        </s-banner>
      )}

      {actionError && !preview && (
        <s-banner tone="critical">{actionError}</s-banner>
      )}

      {batch && (
        <s-section heading="Batch progress">
          <BatchOptimizeProgress
            batch={batch}
            onRetryFailed={handleRetryFailed}
            onDismiss={() => setBatch(null)}
          />
        </s-section>
      )}

      <s-section heading={`${products.length} products`} padding="none">
        {products.length === 0 ? (
          <s-box padding="large">
            <s-stack direction="block" gap="base">
              <s-heading>No products yet</s-heading>
              <s-paragraph>
                Add a few test products in your Shopify admin, then refresh this
                page.
              </s-paragraph>
            </s-stack>
          </s-box>
        ) : (
          <s-table variant="auto">
            <s-table-header-row>
              <s-table-header listSlot="labeled">
                <s-checkbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onChange={(e) => toggleSelectAll(e.currentTarget.checked)}
                  labelAccessibilityVisibility="exclusive"
                  accessibilityLabel="Select all products"
                />
              </s-table-header>
              <s-table-header listSlot="primary">Product</s-table-header>
              <s-table-header listSlot="inline">Status</s-table-header>
              <s-table-header listSlot="labeled">Tags</s-table-header>
              <s-table-header listSlot="secondary">Description</s-table-header>
              <s-table-header listSlot="labeled">Action</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {products.map((product) => (
                <s-table-row key={product.id}>
                  <s-table-cell>
                    <s-checkbox
                      checked={selectedIds.has(product.id)}
                      onChange={(e) =>
                        toggleSelect(product.id, e.currentTarget.checked)
                      }
                      labelAccessibilityVisibility="exclusive"
                      accessibilityLabel={`Select ${product.title}`}
                    />
                  </s-table-cell>
                  <s-table-cell>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                      }}
                    >
                      <s-thumbnail
                        src={product.imageUrl ?? undefined}
                        alt={product.imageAlt ?? product.title}
                        size="small"
                      />
                      <s-stack direction="block" gap="small">
                        <s-text type="strong">{product.title}</s-text>
                        <s-text tone="neutral">{product.handle}</s-text>
                      </s-stack>
                    </div>
                  </s-table-cell>
                  <s-table-cell>
                    <s-badge tone={statusTone(product.status)}>
                      {formatStatus(product.status)}
                    </s-badge>
                  </s-table-cell>
                  <s-table-cell>
                    {product.tags.length > 0
                      ? product.tags.slice(0, 3).join(", ")
                      : "—"}
                  </s-table-cell>
                  <s-table-cell>
                    {product.description
                      ? truncate(product.description)
                      : "No description"}
                  </s-table-cell>
                  <s-table-cell>
                    <s-button
                      onClick={() => handleOptimize(product)}
                      disabled={isBusy || usage.isLimited}
                      {...(optimizingId === product.id ? { loading: true } : {})}
                    >
                      Optimize
                    </s-button>
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        )}
      </s-section>

      <OptimizePreviewModal
        product={preview?.product ?? null}
        result={preview?.result ?? null}
        isApplying={isApplying}
        onApply={handleApply}
        onClose={handleCloseModal}
      />

      <s-section slot="aside" heading="Usage">
        {usage.plan === "pro" ? (
          <s-paragraph>
            <s-text type="strong">Pro plan</s-text> — unlimited optimizations.
          </s-paragraph>
        ) : (
          <s-stack direction="block" gap="base">
            <s-unordered-list>
              <s-list-item>
                Plan: <s-text type="strong">Free</s-text>
              </s-list-item>
              <s-list-item>
                This month: {usage.used}/{usage.limit} used
              </s-list-item>
              <s-list-item>{usage.remaining} remaining</s-list-item>
            </s-unordered-list>
            <UpgradeButton />
          </s-stack>
        )}
      </s-section>

      <s-section slot="aside" heading="Batch optimize">
        <s-paragraph>
          Select multiple products, then use Optimize selected. Batch mode
          optimizes and applies changes automatically without a preview step.
        </s-paragraph>
      </s-section>

      <s-section slot="aside" heading="About this page">
        <s-paragraph>
          Single Optimize opens a preview with inferred notes. Batch optimize
          is best when you trust the AI output for many products at once.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
