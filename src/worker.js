/**
 * Cloudflare Worker - Proxy for hole.cert.pl/domains/
 *
 * Provides reliable access to the CERT Polska phishing domain warning list
 * through Cloudflare's distributed infrastructure with full CORS support.
 *
 * Background: hole.cert.pl frequently blocks GitHub IP ranges, breaking CI/CD
 * pipelines and GitHub-hosted applications. Cloudflare's edge network is
 * significantly harder to block en masse, making this proxy more resilient.
 */

const ALLOWED_PREFIXES = ["/domains", "/domains/v2"];
const TARGET_DOMAIN = "hole.cert.pl";

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

async function handleRequest(request) {
  try {
    const url = new URL(request.url);

    if (!isPathAllowed(url.pathname)) {
      return new Response(
        "Not Found - this proxy only handles /domains and /domains/v2 (and their subpaths)",
        {
          status: 404,
          headers: getCorsHeaders("text/plain; charset=utf-8"),
        },
      );
    }

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 200,
        headers: {
          ...getCorsHeaders(),
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    if (!["GET", "HEAD"].includes(request.method)) {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: {
          ...getCorsHeaders(),
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
          headers: getCorsHeaders("text/plain; charset=utf-8"),
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

    Object.entries(getCorsHeaders()).forEach(([key, value]) => {
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
      headers: getCorsHeaders("text/plain; charset=utf-8"),
    });
  }
}

function getCorsHeaders(contentType = null) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (contentType) {
    headers["Content-Type"] = contentType;
  }

  return headers;
}
