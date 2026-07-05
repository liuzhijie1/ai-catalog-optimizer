const SUPPORT_EMAIL =
  process.env.SUPPORT_EMAIL ?? "liu831666@gmail.com";

export default function PrivacyPolicyPage() {
  const lastUpdated = "July 5, 2026";

  return (
    <main
      style={{
        maxWidth: "720px",
        margin: "0 auto",
        padding: "48px 24px 64px",
        fontFamily:
          'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        color: "#202223",
        lineHeight: 1.6,
      }}
    >
      <h1 style={{ fontSize: "28px", marginBottom: "8px" }}>
        Privacy Policy — AI Catalog Optimizer
      </h1>
      <p style={{ color: "#6d7175", marginBottom: "32px" }}>
        Last updated: {lastUpdated}
      </p>

      <p>
        AI Catalog Optimizer (&quot;the App&quot;) is a Shopify application that
        helps merchants optimize product catalog data for AI shopping discovery.
        This policy explains what information we collect, how we use it, and your
        choices.
      </p>

      <h2 style={{ fontSize: "20px", marginTop: "32px" }}>Information we collect</h2>
      <ul>
        <li>
          <strong>Shop and account data</strong> from Shopify when you install or
          use the App, including shop domain, access tokens, and staff profile
          fields provided by Shopify OAuth.
        </li>
        <li>
          <strong>Product data</strong> you choose to optimize, such as product
          titles, descriptions, tags, and related catalog fields accessed through
          the Shopify Admin API.
        </li>
        <li>
          <strong>Usage and billing data</strong>, including plan status (Free or
          Pro), monthly optimization counts, and records of successful
          optimizations applied to your store.
        </li>
      </ul>

      <h2 style={{ fontSize: "20px", marginTop: "32px" }}>How we use information</h2>
      <ul>
        <li>Authenticate your shop and provide App functionality.</li>
        <li>
          Send selected product content to our AI provider to generate
          optimization suggestions.
        </li>
        <li>Apply approved changes back to your Shopify store when you confirm.</li>
        <li>Enforce plan limits, process subscriptions, and improve the App.</li>
      </ul>

      <h2 style={{ fontSize: "20px", marginTop: "32px" }}>Third-party services</h2>
      <ul>
        <li>
          <strong>Shopify</strong> — hosting, authentication, and store data
          access.
        </li>
        <li>
          <strong>OpenRouter</strong> — AI processing of product text you submit
          for optimization. Product content is sent only when you run an
          optimization.
        </li>
        <li>
          <strong>Railway</strong> — application hosting and PostgreSQL database
          storage for sessions, plan status, usage, and optimization logs.
        </li>
      </ul>

      <h2 style={{ fontSize: "20px", marginTop: "32px" }}>Data retention</h2>
      <p>
        We retain session and App data while the App is installed on your store.
        When you uninstall the App, Shopify session data is removed via our
        uninstall webhook. Other records may be retained for a reasonable period
        for billing, security, or legal compliance, then deleted or anonymized.
      </p>

      <h2 style={{ fontSize: "20px", marginTop: "32px" }}>Your choices</h2>
      <ul>
        <li>You control which products are optimized and must approve before changes are applied (single-product flow).</li>
        <li>You may uninstall the App at any time from your Shopify admin.</li>
        <li>
          You may request access to or deletion of your data by contacting us
          (see Contact below).
        </li>
      </ul>

      <h2 style={{ fontSize: "20px", marginTop: "32px" }}>Security</h2>
      <p>
        We use industry-standard practices to protect data in transit and at rest,
        including HTTPS and secured database access. No method of transmission or
        storage is 100% secure.
      </p>

      <h2 style={{ fontSize: "20px", marginTop: "32px" }}>Changes</h2>
      <p>
        We may update this policy from time to time. We will post the revised
        version on this page and update the &quot;Last updated&quot; date.
      </p>

      <h2 style={{ fontSize: "20px", marginTop: "32px" }}>Contact</h2>
      <p>
        Questions about this policy or your data:{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
      </p>
    </main>
  );
}
