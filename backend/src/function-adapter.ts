type ApiGatewayEvent = {
  httpMethod?: string;
  url?: string;
  path?: string;
  headers?: Record<string, string>;
  queryStringParameters?: Record<string, string>;
  body?: string;
  isBase64Encoded?: boolean;
};

type FunctionResponse = {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  isBase64Encoded: false;
};

export async function handleHttpEvent(
  event: ApiGatewayEvent,
  fetchHandler: (request: Request) => Response | Promise<Response>,
): Promise<FunctionResponse> {
  const query = new URLSearchParams(event.queryStringParameters ?? {}).toString();
  const path = event.url ?? event.path ?? "/";
  const url = `https://function.local${path}${query ? `?${query}` : ""}`;
  const body = event.body
    ? event.isBase64Encoded
      ? Buffer.from(event.body, "base64")
      : event.body
    : undefined;
  const requestInit: RequestInit = { method: event.httpMethod ?? "GET" };
  if (event.headers) requestInit.headers = event.headers;
  if (!["GET", "HEAD"].includes(event.httpMethod ?? "GET") && body !== undefined) {
    requestInit.body = body;
  }
  const response = await fetchHandler(new Request(url, requestInit));

  return {
    statusCode: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    body: await response.text(),
    isBase64Encoded: false,
  };
}
