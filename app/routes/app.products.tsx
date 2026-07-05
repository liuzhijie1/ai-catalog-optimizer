import { useEffect, useState } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { OptimizePreviewModal } from "../components/OptimizePreviewModal";
import type { OptimizeResult } from "../services/optimizer.server";
import { optimizeForAI } from "../services/optimizer.server";
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

const PRODUCT_QUERY = `#graphql
  query ProductForOptimize($id: ID!) {
    product(id: $id) {
      id
      title
      description
      productType
      tags
    }
  }
`;

const PRODUCT_UPDATE_MUTATION = `#graphql
  mutation ProductUpdate($input: ProductInput!) {
    productUpdate(input: $input) {
      product {
        id
        title
        descriptionHtml
        tags
      }
      userErrors {
        field
        message
      }
    }
  }
`;

type OptimizeActionData = {
  intent: "optimize";
  product: ProductListItem;
  result: OptimizeResult;
  error?: never;
};

type ApplyActionData = {
  intent: "apply";
  success: true;
  productId: string;
  error?: never;
};

type ErrorActionData = {
  intent: "optimize" | "apply";
  error: string;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

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

  return { products };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "optimize") {
    const productId = formData.get("productId");
    if (typeof productId !== "string" || !productId) {
      return { intent: "optimize", error: "Missing product ID." } satisfies ErrorActionData;
    }

    try {
      const response = await admin.graphql(PRODUCT_QUERY, {
        variables: { id: productId },
      });
      const { data } = await response.json();
      const node = data?.product;

      if (!node) {
        return {
          intent: "optimize",
          error: "Product not found.",
        } satisfies ErrorActionData;
      }

      const listProduct = {
        id: node.id,
        title: node.title,
        handle: "",
        status: "ACTIVE" as const,
        description: node.description,
        productType: node.productType,
        tags: node.tags,
        updatedAt: "",
        imageUrl: null,
        imageAlt: null,
      };

      const result = await optimizeForAI({
        title: node.title,
        description: node.description,
        productType: node.productType,
        tags: node.tags.join(", "),
      });

      return {
        intent: "optimize",
        product: listProduct,
        result,
      } satisfies OptimizeActionData;
    } catch (error) {
      return {
        intent: "optimize",
        error:
          error instanceof Error ? error.message : "Optimization failed.",
      } satisfies ErrorActionData;
    }
  }

  if (intent === "apply") {
    const productId = formData.get("productId");
    const title = formData.get("title");
    const descriptionHtml = formData.get("descriptionHtml");
    const tagsJson = formData.get("tags");

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
      const response = await admin.graphql(PRODUCT_UPDATE_MUTATION, {
        variables: {
          input: {
            id: productId,
            title,
            descriptionHtml,
            tags,
          },
        },
      });

      const { data } = await response.json();
      const userErrors = data?.productUpdate?.userErrors ?? [];

      if (userErrors.length > 0) {
        return {
          intent: "apply",
          error: userErrors.map((e: { message: string }) => e.message).join(", "),
        } satisfies ErrorActionData;
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

export default function ProductsPage() {
  const { products } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  const [preview, setPreview] = useState<{
    product: ProductListItem;
    result: OptimizeResult;
  } | null>(null);
  const [optimizingId, setOptimizingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const isBusy = fetcher.state !== "idle";
  const isApplying =
    isBusy && fetcher.formData?.get("intent") === "apply";

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
        title: preview.result.title,
        descriptionHtml: preview.result.description,
        tags: JSON.stringify(preview.result.tags),
      },
      { method: "POST" },
    );
  };

  const handleCloseModal = () => {
    setPreview(null);
  };

  return (
    <s-page heading="Products">
      {actionError && !preview && (
        <s-banner tone="critical">{actionError}</s-banner>
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
                      disabled={isBusy}
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

      <s-section slot="aside" heading="About this page">
        <s-paragraph>
          Click Optimize to generate AI-friendly titles, descriptions, and tags.
          Review the preview — especially inferred notes — before applying
          changes to Shopify.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
