import { serve } from "@hono/node-server";

import { bootstrap } from "./bootstrap.js";

const { app, environment } = await bootstrap();

serve({ fetch: app.fetch, hostname: "0.0.0.0", port: environment.PORT }, (info) => {
  console.log(`API listening on http://localhost:${info.port}`);
});
