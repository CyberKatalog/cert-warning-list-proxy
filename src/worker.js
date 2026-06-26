const DEFAULT_TARGET_DOMAIN = "hole.cert.pl";
const DEFAULT_ALLOWED_PREFIXES = ["/domains", "/domains/v2"];

export default {
  async fetch(request, env) {
    return handleRequest(request, resolveConfig(env));
  },
};

function parseList(value) {
  return typeof value === "string"
    ? value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];
}

function resolveConfig(env) {
  const allowedPrefixes = parseList(env.ALLOWED_PREFIXES);

  return {
    allowedOrigins: parseList(env.ALLOWED_ORIGINS),
    targetDomain: env.TARGET_DOMAIN || DEFAULT_TARGET_DOMAIN,
    allowedPrefixes:
      allowedPrefixes.length > 0 ? allowedPrefixes : DEFAULT_ALLOWED_PREFIXES,
  };
}

function isPathAllowed(pathname, config) {
  return config.allowedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isAllowedOrigin(request, config) {
  const origin = request.headers.get("Origin");
  return origin !== null && config.allowedOrigins.includes(origin);
}

function isAllowedRequest(request, config) {
  if (isAllowedOrigin(request, config)) {
    return true;
  }

  const referer = request.headers.get("Referer");
  return (
    referer !== null &&
    config.allowedOrigins.some((allowed) => referer.startsWith(allowed))
  );
}

function resolveAllowedOrigin(request, config) {
  const origin = request.headers.get("Origin");
  return origin !== null && config.allowedOrigins.includes(origin)
    ? origin
    : config.allowedOrigins[0] || "null";
}

function getCorsHeaders(request, config, contentType = null) {
  const headers = {
    "Access-Control-Allow-Origin": resolveAllowedOrigin(request, config),
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };

  if (contentType) {
    headers["Content-Type"] = contentType;
  }

  return headers;
}

function forbidden() {
  return new Response("Forbidden: request origin is not allowed", {
    status: 403,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

async function handleRequest(request, config) {
  try {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return isAllowedOrigin(request, config)
        ? new Response(null, {
            status: 200,
            headers: {
              ...getCorsHeaders(request, config),
              "Access-Control-Max-Age": "86400",
            },
          })
        : forbidden();
    }

    if (!isAllowedRequest(request, config)) {
      return forbidden();
    }

    if (!isPathAllowed(url.pathname, config)) {
      return new Response(
        "Not Found - this proxy only handles /domains and /domains/v2 (and their subpaths)",
        {
          status: 404,
          headers: getCorsHeaders(request, config, "text/plain; charset=utf-8"),
        },
      );
    }

    if (!["GET", "HEAD"].includes(request.method)) {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: {
          ...getCorsHeaders(request, config),
          Allow: "GET, HEAD, OPTIONS",
        },
      });
    }

    const targetUrl = `https://${config.targetDomain}${url.pathname}${url.search}`;

    const upstreamRequest = new Request(targetUrl, {
      method: request.method,
      headers: {
        "User-Agent": "Cloudflare-Worker-Proxy/1.0",
        Accept: request.headers.get("Accept") || "*/*",
        "Accept-Encoding":
          request.headers.get("Accept-Encoding") || "gzip, deflate",
        "Accept-Language":
          request.headers.get("Accept-Language") || "en-US,en;q=0.9",
      },
    });

    const upstreamResponse = await fetch(upstreamRequest);

    if (!upstreamResponse.ok) {
      return new Response(
        `Upstream error: ${upstreamResponse.status} ${upstreamResponse.statusText}`,
        {
          status: upstreamResponse.status,
          headers: getCorsHeaders(request, config, "text/plain; charset=utf-8"),
        },
      );
    }

    const responseHeaders = new Headers();

    const headersToForward = [
      "content-type",
      "content-length",
      "content-encoding",
      "content-disposition",
      "last-modified",
      "etag",
      "expires",
      "cache-control",
    ];

    headersToForward.forEach((header) => {
      const value = upstreamResponse.headers.get(header);
      if (value) {
        responseHeaders.set(header, value);
      }
    });

    Object.entries(getCorsHeaders(request, config)).forEach(([key, value]) => {
      responseHeaders.set(key, value);
    });

    if (!responseHeaders.has("cache-control")) {
      responseHeaders.set("Cache-Control", "public, max-age=3600");
    }

    responseHeaders.set("X-Proxied-By", "Cloudflare-Worker");
    responseHeaders.set("X-Proxy-Source", config.targetDomain);

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("Worker error:", error);
    return new Response(`Proxy error: ${error.message}`, {
      status: 500,
      headers: getCorsHeaders(request, config, "text/plain; charset=utf-8"),
    });
  }
}
