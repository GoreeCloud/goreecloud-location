# Timeline Order Control Contract — Development

This slice defines the user-facing ordering choices for the existing bounded, owner-scoped Timeline presentation without adding a new history authority.

The only accepted values are **Newest first** and **Oldest first**. Unknown or missing values normalize to Newest first. Applying an order delegates to the existing deterministic bounded ordering helper, so valid capture timestamps are ordered predictably, invalid timestamps remain after valid samples, ties remain stable, and the result remains capped to the current view limit.

The status projection reports only the loaded owner-scoped sample count and selected direction. It does not request additional history or infer routes, visits, stops, trips, speed, or movement.

The rendered Timeline selector still needs to consume this contract. This is Development source work only and does not establish production Identity integration, retention/backup acceptance, deployment, release, or Stable qualification.
