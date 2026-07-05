import type { ActionFunctionArgs } from "react-router";

import { deleteShopData } from "../services/compliance.server";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  await deleteShopData(shop);

  return new Response();
};
