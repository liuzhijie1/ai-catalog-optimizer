import type { OptimizeResult } from "../services/optimizer.server";
import type { ProductListItem } from "../types/product";

type OptimizePreviewModalProps = {
  product: ProductListItem | null;
  result: OptimizeResult | null;
  isApplying: boolean;
  onApply: () => void;
  onClose: () => void;
};

export function OptimizePreviewModal({
  product,
  result,
  isApplying,
  onApply,
  onClose,
}: OptimizePreviewModalProps) {
  if (!product || !result) return null;

  return (
    <s-modal
      id="optimize-preview-modal"
      heading={`Optimize: ${product.title}`}
      size="large"
    >
      <s-stack direction="block" gap="base">
        <s-box padding="base" borderWidth="base" borderRadius="base">
          <s-stack direction="inline" gap="base">
            <s-badge tone="critical">Before: {result.score_before}</s-badge>
            <s-text tone="neutral">→</s-text>
            <s-badge tone="success">After: {result.score_after}</s-badge>
          </s-stack>
        </s-box>

        {result.inferred_notes.length > 0 && (
          <s-banner tone="warning">
            Review inferred content before applying. {result.inferred_notes.length}{" "}
            note(s) flagged.
          </s-banner>
        )}

        <s-stack direction="block" gap="small">
          <s-heading>Title</s-heading>
          <s-box padding="base" background="subdued" borderRadius="base">
            <s-text tone="neutral">Before</s-text>
            <div style={{ marginTop: "4px" }}>{product.title}</div>
          </s-box>
          <s-box padding="base" borderRadius="base" borderWidth="base">
            <s-text type="strong">After</s-text>
            <div style={{ marginTop: "4px" }}>{result.title}</div>
          </s-box>
        </s-stack>

        <s-stack direction="block" gap="small">
          <s-heading>Description</s-heading>
          <s-box padding="base" background="subdued" borderRadius="base">
            <s-text tone="neutral">Before</s-text>
            <div style={{ marginTop: "4px", whiteSpace: "pre-wrap" }}>
              {product.description || "No description"}
            </div>
          </s-box>
          <s-box padding="base" borderRadius="base" borderWidth="base">
            <s-text type="strong">After</s-text>
            <div
              style={{ marginTop: "4px" }}
              dangerouslySetInnerHTML={{ __html: result.description }}
            />
          </s-box>
        </s-stack>

        <s-stack direction="block" gap="small">
          <s-heading>Tags</s-heading>
          <s-box padding="base" background="subdued" borderRadius="base">
            <s-text tone="neutral">Before</s-text>
            <div style={{ marginTop: "4px" }}>
              {product.tags.length > 0 ? product.tags.join(", ") : "—"}
            </div>
          </s-box>
          <s-box padding="base" borderRadius="base" borderWidth="base">
            <s-text type="strong">After</s-text>
            <div style={{ marginTop: "4px" }}>{result.tags.join(", ")}</div>
          </s-box>
        </s-stack>

        <s-stack direction="block" gap="small">
          <s-heading>Improvements</s-heading>
          <s-unordered-list>
            {result.improvements.map((item, index) => (
              <s-list-item key={index}>{item}</s-list-item>
            ))}
          </s-unordered-list>
        </s-stack>

        {result.inferred_notes.length > 0 && (
          <s-stack direction="block" gap="small">
            <s-heading>Inferred notes</s-heading>
            <s-unordered-list>
              {result.inferred_notes.map((note, index) => (
                <s-list-item key={index}>{note}</s-list-item>
              ))}
            </s-unordered-list>
          </s-stack>
        )}
      </s-stack>

      <s-button
        slot="primary-action"
        variant="primary"
        onClick={onApply}
        disabled={isApplying}
        {...(isApplying ? { loading: true } : {})}
      >
        Apply to Shopify
      </s-button>
      <s-button
        slot="secondary-actions"
        variant="secondary"
        commandFor="optimize-preview-modal"
        command="--hide"
        onClick={onClose}
      >
        Cancel
      </s-button>
    </s-modal>
  );
}
