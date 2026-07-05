import type { ActionFunctionArgs } from "react-router";

import { deleteShopData } from "../services/compliance.server";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  if (topic === "SHOP_REDACT") {
    await deleteShopData(shop);
  }

  // customers/data_request & customers/redact: no customer PII is stored.
  return new Response();
};
