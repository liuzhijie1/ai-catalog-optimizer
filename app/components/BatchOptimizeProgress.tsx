import type { ProductListItem } from "../types/product";

export type BatchItemResult = {
  productId: string;
  title: string;
  ok: boolean;
  error?: string;
};

export type BatchRunState = {
  status: "running" | "done";
  total: number;
  completed: number;
  results: BatchItemResult[];
  queue: ProductListItem[];
};

type BatchProgressProps = {
  batch: BatchRunState;
  onRetryFailed: () => void;
  onDismiss: () => void;
};

export function BatchOptimizeProgress({
  batch,
  onRetryFailed,
  onDismiss,
}: BatchProgressProps) {
  const successCount = batch.results.filter((r) => r.ok).length;
  const failedCount = batch.results.filter((r) => !r.ok).length;
  const percent =
    batch.total > 0 ? Math.round((batch.completed / batch.total) * 100) : 0;
  const currentItem = batch.queue[batch.completed];

  return (
    <s-box padding="base" borderWidth="base" borderRadius="base">
      <s-stack direction="block" gap="base">
        <s-stack direction="inline" gap="base">
          <s-heading>
            {batch.status === "running"
              ? "Batch optimizing..."
              : "Batch complete"}
          </s-heading>
          <s-text tone="neutral">
            {batch.completed}/{batch.total}
          </s-text>
        </s-stack>

        <div
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          style={{
            height: "8px",
            borderRadius: "999px",
            background: "var(--p-color-bg-surface-secondary, #e3e3e3)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${percent}%`,
              height: "100%",
              background: "var(--p-color-bg-fill-success, #29845a)",
              transition: "width 0.2s ease",
            }}
          />
        </div>

        {batch.status === "running" && currentItem && (
          <s-text tone="neutral">Processing: {currentItem.title}</s-text>
        )}

        {batch.status === "done" && (
          <s-stack direction="inline" gap="base">
            <s-badge tone="success">{successCount} succeeded</s-badge>
            {failedCount > 0 && (
              <s-badge tone="critical">{failedCount} failed</s-badge>
            )}
          </s-stack>
        )}

        {batch.results.length > 0 && (
          <s-unordered-list>
            {batch.results.map((item) => (
              <s-list-item key={item.productId}>
                {item.ok ? "✓" : "✗"} {item.title}
                {!item.ok && item.error ? ` — ${item.error}` : ""}
              </s-list-item>
            ))}
          </s-unordered-list>
        )}

        {batch.status === "done" && (
          <s-stack direction="inline" gap="base">
            {failedCount > 0 && (
              <s-button onClick={onRetryFailed}>Retry failed</s-button>
            )}
            <s-button variant="secondary" onClick={onDismiss}>
              Dismiss
            </s-button>
          </s-stack>
        )}
      </s-stack>
    </s-box>
  );
}
