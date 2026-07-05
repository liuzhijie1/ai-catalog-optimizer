import type { OptimizeResult } from "./optimizer.server";
import { optimizeForAI } from "./optimizer.server";
import { logOptimizationApplied } from "./optimization-log.server";
import {
  assertCanOptimize,
  recordOptimization,
  type UsageSummary,
} from "./usage.server";

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
      }
      userErrors {
        field
        message
      }
    }
  }
`;

type AdminClient = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
};

type ProductNode = {
  id: string;
  title: string;
  description: string;
  productType: string;
  tags: string[];
};

export type OptimizeApplyResult = {
  productId: string;
  title: string;
  result: OptimizeResult;
  usage: UsageSummary;
};

export async function fetchProductNode(
  admin: AdminClient,
  productId: string,
): Promise<ProductNode> {
  const response = await admin.graphql(PRODUCT_QUERY, {
    variables: { id: productId },
  });
  const { data } = await response.json();
  const node = data?.product;

  if (!node) {
    throw new Error("Product not found.");
  }

  return node;
}

export async function optimizeProduct(
  shop: string,
  node: ProductNode,
): Promise<{ result: OptimizeResult; usage: UsageSummary }> {
  await assertCanOptimize(shop);

  const result = await optimizeForAI({
    title: node.title,
    description: node.description,
    productType: node.productType,
    tags: node.tags.join(", "),
  });

  const usage = await recordOptimization(shop);

  return { result, usage };
}

export async function applyProductOptimization(
  admin: AdminClient,
  productId: string,
  data: Pick<OptimizeResult, "title" | "description" | "tags">,
): Promise<void> {
  const response = await admin.graphql(PRODUCT_UPDATE_MUTATION, {
    variables: {
      input: {
        id: productId,
        title: data.title,
        descriptionHtml: data.description,
        tags: data.tags,
      },
    },
  });

  const { data: responseData } = await response.json();
  const userErrors = responseData?.productUpdate?.userErrors ?? [];

  if (userErrors.length > 0) {
    throw new Error(
      userErrors.map((e: { message: string }) => e.message).join(", "),
    );
  }
}

export async function optimizeAndApplyProduct(
  admin: AdminClient,
  shop: string,
  productId: string,
): Promise<OptimizeApplyResult> {
  const node = await fetchProductNode(admin, productId);
  const { result, usage } = await optimizeProduct(shop, node);
  await applyProductOptimization(admin, productId, result);

  await logOptimizationApplied({
    shop,
    productId: node.id,
    productTitle: node.title,
    scoreBefore: result.score_before,
    scoreAfter: result.score_after,
  });

  return {
    productId: node.id,
    title: node.title,
    result,
    usage,
  };
}
