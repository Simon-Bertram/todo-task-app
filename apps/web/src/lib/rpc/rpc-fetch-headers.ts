/**
 * Build fetch headers for the web → server service binding.
 * RPCLink passes a Headers instance; object-spread of Headers is `{}`,
 * which drops Content-Type and breaks procedures with required input.
 */
export function mergeServiceBindingHeaders(
  initHeaders: HeadersInit | undefined,
  cookie: string
): Headers {
  const headers = new Headers(initHeaders);
  if (cookie) {
    headers.set("cookie", cookie);
  }
  return headers;
}
