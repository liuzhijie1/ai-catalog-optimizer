import { Form, useSearchParams } from "react-router";

type UpgradeButtonProps = {
  label?: string;
  disabled?: boolean;
  promoCode?: string;
};

export function UpgradeButton({
  label = "Upgrade to Pro — $29/mo",
  disabled = false,
  promoCode,
}: UpgradeButtonProps) {
  const [searchParams] = useSearchParams();
  const query = searchParams.toString();
  const action = query ? `/app/billing?${query}` : "/app/billing";

  return (
    <Form method="post" action={action}>
      <input type="hidden" name="intent" value="upgrade" />
      {promoCode ? (
        <input type="hidden" name="promoCode" value={promoCode} />
      ) : null}
      <s-button variant="primary" type="submit" disabled={disabled}>
        {label}
      </s-button>
    </Form>
  );
}
