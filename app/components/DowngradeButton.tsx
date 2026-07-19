import { useFetcher } from "react-router";

type DowngradeButtonProps = {
  label?: string;
  disabled?: boolean;
};

export function DowngradeButton({
  label = "Switch to Free",
  disabled = false,
}: DowngradeButtonProps) {
  const fetcher = useFetcher();
  const isLoading = fetcher.state !== "idle";

  return (
    <s-button
      disabled={disabled || isLoading}
      {...(isLoading ? { loading: true } : {})}
      onClick={() =>
        fetcher.submit({ intent: "downgrade" }, { method: "POST", action: "/app/billing" })
      }
    >
      {label}
    </s-button>
  );
}
