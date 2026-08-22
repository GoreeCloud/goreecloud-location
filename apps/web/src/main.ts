import "./styles.css";

const app = document.querySelector<HTMLElement>("#app");

if (!app) {
  throw new Error("GoreeCloud Location application root was not found.");
}

app.innerHTML = `
  <section class="shell" aria-labelledby="page-title">
    <div class="eyebrow">GoreeCloud Location</div>
    <h1 id="page-title">Private location, under your control.</h1>
    <p class="lede">
      The native GoreeCloud Location foundation is under active development.
      Live tracking, history, sharing, geofencing, trips, and insights will be
      introduced through reviewed milestones rather than presented as working
      features before they are implemented.
    </p>

    <div class="status" role="status" aria-label="Project lifecycle">
      <span class="status-dot" aria-hidden="true"></span>
      <strong>Development</strong>
      <span>Milestone 0 — repository and service foundation</span>
    </div>

    <div class="principles" aria-label="Project principles">
      <article>
        <h2>Private by default</h2>
        <p>Location ownership and sharing are enforced on the server, not only in the interface.</p>
      </article>
      <article>
        <h2>Self-hosted</h2>
        <p>The authoritative location record stays in GoreeCloud-controlled storage.</p>
      </article>
      <article>
        <h2>Portable</h2>
        <p>Open exports and replaceable map providers protect long-term ownership and independence.</p>
      </article>
    </div>
  </section>
`;
