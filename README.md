# CERT.PL Warning List Proxy - Cloudflare Worker

This Cloudflare Worker acts as a proxy for `hole.cert.pl/domains/` and `hole.cert.pl/domains/v2/` endpoints, allowing file downloads through Cloudflare infrastructure instead of directly from the source server.

## Why this proxy exists

**Problem:** Often `hole.cert.pl` blocks GitHub IP ranges, making it impossible to use the API in CI/CD and applications hosted on GitHub. Cloudflare has distributed infrastructure, making it difficult for services to manually block all Cloudflare IPs, which makes this proxy more reliable.

**Solution:** This proxy provides stable access to cert.pl data through Cloudflare infrastructure, which is harder to block.

## Installation and Configuration

### 1. Prerequisites

```bash
# Install pnpm (if not already installed)
npm install -g pnpm

# Install Wrangler CLI globally via pnpm
pnpm add -g wrangler

# Login to Cloudflare
wrangler login
```

### 2. Install dependencies and deploy

```bash
# Install dependencies
pnpm install

# Deploy worker to Cloudflare
pnpm deploy

# Alternative - local testing
pnpm dev

# View real-time logs
pnpm logs
```

### 3. Custom domain configuration (optional)

Edit `wrangler.toml` to configure your custom domain:

```toml
# Uncomment and change to your domain
route = "proxy.your-domain.com/domains/*"
```

## Usage Examples

### Original URL vs Proxy

| Original                                               | Proxy                                                             |
| ------------------------------------------------------ | ----------------------------------------------------------------- |
| `https://hole.cert.pl/domains/domains.json`            | `https://your-worker.workers.dev/domains/domains.json`            |
| `https://hole.cert.pl/domains/v2/domains.json`         | `https://your-worker.workers.dev/domains/v2/domains.json`         |
| `https://hole.cert.pl/domains/v2/expired_domains.json` | `https://your-worker.workers.dev/domains/v2/expired_domains.json` |

### JavaScript/Fetch API

```javascript
// Through proxy (with CORS support)
const response = await fetch(
  "https://your-worker.workers.dev/domains/v2/domains.json"
);
const data = await response.json();
console.log(data);
```

### cURL

```bash
# JSON API
curl -H "Accept: application/json" https://your-worker.workers.dev/domains/v2/domains.json

# Legacy API
curl https://your-worker.workers.dev/domains/domains.json
```

## Security Features

- **CORS headers** - Enables access from web applications
- **Path filtering** - Only handles `/domains/` and `/domains/v2/*` paths
- **Restricted target** - Only `hole.cert.pl` domain
- **Limited HTTP methods** - Only GET, HEAD, OPTIONS
- **Header sanitization** - Forwards only safe headers
- **Rate limiting** - Built into Cloudflare

## Monitoring and Debugging

### Real-time log viewing

```bash
pnpm logs
```

### Testing

```bash
# Basic test
curl -v https://your-worker.workers.dev/domains/v2/domains.json

# CORS test
curl -H "Origin: https://example.com" \
     -H "Access-Control-Request-Method: GET" \
     -X OPTIONS \
     https://your-worker.workers.dev/domains/v2/domains.json

# Invalid path test
curl https://your-worker.workers.dev/invalid-path
```

## Troubleshooting

### Common Errors

1. **404 Not Found** - Check if path starts with `/domains/` or `/domains/v2/`
2. **500 Internal Server Error** - Check logs via `pnpm logs`
3. **CORS errors** - Make sure you're using the proxy URL, not the original
4. **Rate limiting** - Check limits in Cloudflare Dashboard

## Project Structure

```
cert-warning-list-proxy/
├── src/
│   └── worker.js          # Main Cloudflare Worker code
├── package.json           # pnpm configuration and scripts
├── wrangler.toml          # Cloudflare Worker configuration
├── .gitignore            # Files ignored by git
├── LICENSE               # MIT License
└── README.md             # Documentation (this file)
```

## License

This project is released under the MIT License. See the [LICENSE](./LICENSE) file for details.

## Author

This project was created for [Cyber Katalog](https://cyberkatalog.pl) by [Silesian Solutions](https://silesiansolutions.com).
