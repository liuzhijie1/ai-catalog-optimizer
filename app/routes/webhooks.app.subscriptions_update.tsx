import type { ActionFunctionArgs } from "react-router";

import { authenticate } from "../shopify.server";
import { setShopPlan } from "../services/billing.server";

type SubscriptionPayload = {
  app_subscription?: {
    status?: string;
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  const status = (payload as SubscriptionPayload).app_subscription?.status;
  const plan = status === "ACTIVE" ? "pro" : "free";

  await setShopPlan(shop, plan);

  return new Response();
};
