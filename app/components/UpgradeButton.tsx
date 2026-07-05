import { useFetcher } from "react-router";

type UpgradeButtonProps = {
  label?: string;
  disabled?: boolean;
};

export function UpgradeButton({
  label = "Upgrade to Pro — $29/mo",
  disabled = false,
}: UpgradeButtonProps) {
  const fetcher = useFetcher();
  const isLoading = fetcher.state !== "idle";

  return (
    <s-button
      variant="primary"
      disabled={disabled || isLoading}
      {...(isLoading ? { loading: true } : {})}
      onClick={() =>
        fetcher.submit({ intent: "upgrade" }, { method: "POST", action: "/app/billing" })
      }
    >
      {label}
    </s-button>
  );
}
