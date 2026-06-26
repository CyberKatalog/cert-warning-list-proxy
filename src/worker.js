const ALLOWED_PREFIXES = ["/domains", "/domains/v2"];
const TARGET_DOMAIN = "hole.cert.pl";
const ALLOWED_ORIGINS = [
  "https://cyberkatalog.pl",
  "http://localhost:5173",
  "http://localhost:4173",
];

export default {
  async fetch(request) {
    return handleRequest(request);
  },
};

function isPathAllowed(pathname) {
  return ALLOWED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isAllowedOrigin(request) {
  const origin = request.headers.get("Origin");
  return origin !== null && ALLOWED_ORIGINS.includes(origin);
}

function isAllowedRequest(request) {
  if (isAllowedOrigin(request)) {
    return true;
  }

  const referer = request.headers.get("Referer");
  return (
    referer !== null &&
    ALLOWED_ORIGINS.some((allowed) => referer.startsWith(allowed))
  );
}

function resolveAllowedOrigin(request) {
  const origin = request.headers.get("Origin");
  return origin !== null && ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[0];
}

function getCorsHeaders(request, contentType = null) {
  const headers = {
    "Access-Control-Allow-Origin": resolveAllowedOrigin(request),
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
  return new Response("Forbidden: Access only allowed from cyberkatalog.pl", {
    status: 403,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

async function handleRequest(request) {
  try {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return isAllowedOrigin(request)
        ? new Response(null, {
            status: 200,
            headers: {
              ...getCorsHeaders(request),
              "Access-Control-Max-Age": "86400",
            },
          })
        : forbidden();
    }

    if (!isAllowedRequest(request)) {
      return forbidden();
    }

    if (!isPathAllowed(url.pathname)) {
      return new Response(
        "Not Found - this proxy only handles /domains and /domains/v2 (and their subpaths)",
        {
          status: 404,
          headers: getCorsHeaders(request, "text/plain; charset=utf-8"),
        },
      );
    }

    if (!["GET", "HEAD"].includes(request.method)) {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: {
          ...getCorsHeaders(request),
          Allow: "GET, HEAD, OPTIONS",
        },
      });
    }

    const targetUrl = `https://${TARGET_DOMAIN}${url.pathname}${url.search}`;

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
          headers: getCorsHeaders(request, "text/plain; charset=utf-8"),
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

    Object.entries(getCorsHeaders(request)).forEach(([key, value]) => {
      responseHeaders.set(key, value);
    });

    if (!responseHeaders.has("cache-control")) {
      responseHeaders.set("Cache-Control", "public, max-age=3600");
    }

    responseHeaders.set("X-Proxied-By", "Cloudflare-Worker");
    responseHeaders.set("X-Proxy-Source", TARGET_DOMAIN);

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("Worker error:", error);
    return new Response(`Proxy error: ${error.message}`, {
      status: 500,
      headers: getCorsHeaders(request, "text/plain; charset=utf-8"),
    });
  }
}
