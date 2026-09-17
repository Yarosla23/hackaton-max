import { readEnvironment } from "./config.js";
import { createApp } from "./app.js";
import {
  CompositeMarketSource,
  DemoMarketSource,
  HhSource,
  SuperJobSource,
  TrudvsemSource,
  type MarketSource,
} from "./market-source.js";
import { createStore } from "./ydb.js";

export async function bootstrap() {
  const environment = readEnvironment();
  const store = await createStore(environment);
  const liveSources: MarketSource[] = [
    new TrudvsemSource(environment.TRUDVSEM_API_URL),
    new HhSource(
      environment.HH_API_URL,
      environment.HH_USER_AGENT ?? "RynokRyadom/0.3 (local-development)",
      environment.HH_ACCESS_TOKEN,
    ),
  ];
  if (environment.SUPERJOB_API_KEY) {
    liveSources.push(
      new SuperJobSource(environment.SUPERJOB_API_URL, environment.SUPERJOB_API_KEY),
    );
  }
  const marketSource: MarketSource = environment.MARKET_SOURCE === "demo"
    ? new DemoMarketSource()
    : new CompositeMarketSource(liveSources);
  return {
    app: createApp({ environment, store, marketSource }),
    environment,
    store,
    marketSource,
  };
}
