# CERT.PL Warning List Proxy - Cloudflare Worker

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)

A Cloudflare Worker that proxies the `hole.cert.pl/domains/` and `hole.cert.pl/domains/v2/` endpoints, providing reliable access to CERT Polska's phishing domain warning list through Cloudflare's distributed infrastructure.

## Why this proxy exists

**Problem:** `hole.cert.pl` frequently blocks GitHub IP ranges, making it impossible to consume the API in CI/CD pipelines and applications hosted on GitHub infrastructure.

**Solution:** Cloudflare's globally distributed edge network is significantly harder to block en masse, making this proxy a more reliable intermediary.

## Installation and Configuration

### Prerequisites

- Node.js `>=24.0.0` (a `.nvmrc` file is included - run `nvm use` to switch automatically)
- pnpm `>=10.0.0`

```bash
# Switch to the correct Node.js version (requires nvm)
nvm use

# Install pnpm (if not already installed)
npm install -g pnpm

# Install Wrangler CLI globally
pnpm add -g wrangler

# Authenticate with Cloudflare
wrangler login
```

### Install dependencies and deploy

```bash
# Install dependencies
pnpm install

# Deploy to Cloudflare Workers
pnpm deploy

# Run locally for development
pnpm dev

# Stream real-time logs from the deployed worker
pnpm logs
```

### Custom domain (optional)

Edit `wrangler.toml` to bind the worker to your own domain:

```toml
# Uncomment and replace with your domain
route = "proxy.your-domain.com/domains/*"
```

## Usage

### URL mapping

Replace `<worker-name>` and `<cf-username>` with your Cloudflare Worker name and account subdomain.

| Original URL                                           | Proxy URL                                                                         |
| ------------------------------------------------------ | --------------------------------------------------------------------------------- |
| `https://hole.cert.pl/domains/domains.json`            | `https://<worker-name>.<cf-username>.workers.dev/domains/domains.json`            |
| `https://hole.cert.pl/domains/v2/domains.json`         | `https://<worker-name>.<cf-username>.workers.dev/domains/v2/domains.json`         |
| `https://hole.cert.pl/domains/v2/domains.csv`          | `https://<worker-name>.<cf-username>.workers.dev/domains/v2/domains.csv`          |
| `https://hole.cert.pl/domains/v2/domains.txt`          | `https://<worker-name>.<cf-username>.workers.dev/domains/v2/domains.txt`          |
| `https://hole.cert.pl/domains/v2/domains.xml`          | `https://<worker-name>.<cf-username>.workers.dev/domains/v2/domains.xml`          |
| `https://hole.cert.pl/domains/v2/domains_adblock.txt`  | `https://<worker-name>.<cf-username>.workers.dev/domains/v2/domains_adblock.txt`  |
| `https://hole.cert.pl/domains/v2/domains_hosts.txt`    | `https://<worker-name>.<cf-username>.workers.dev/domains/v2/domains_hosts.txt`    |
| `https://hole.cert.pl/domains/v2/domains_mikrotik.rsc` | `https://<worker-name>.<cf-username>.workers.dev/domains/v2/domains_mikrotik.rsc` |
| `https://hole.cert.pl/domains/v2/domains_rpz.db`       | `https://<worker-name>.<cf-username>.workers.dev/domains/v2/domains_rpz.db`       |
| `https://hole.cert.pl/domains/v2/domains_ublock.txt`   | `https://<worker-name>.<cf-username>.workers.dev/domains/v2/domains_ublock.txt`   |
| `https://hole.cert.pl/domains/v2/actions_2026.log`     | `https://<worker-name>.<cf-username>.workers.dev/domains/v2/actions_2026.log`     |

All `actions_YYYY.log` files (2020–2026) are available under `/domains/v2/`.

### Available formats

| Format                                         | Path                               |
| ---------------------------------------------- | ---------------------------------- |
| Plain text - active domains only, one per line | `/domains/v2/domains.txt`          |
| TSV (tab-separated values)                     | `/domains/v2/domains.csv`          |
| JSON                                           | `/domains/v2/domains.json`         |
| XML                                            | `/domains/v2/domains.xml`          |
| AdBlock / uBlock Origin / AdGuard compatible   | `/domains/v2/domains_adblock.txt`  |
| uBlock Origin (compact)                        | `/domains/v2/domains_ublock.txt`   |
| Hosts file                                     | `/domains/v2/domains_hosts.txt`    |
| MikroTik / RouterOS `.rsc` (max 4 096 B)       | `/domains/v2/domains_mikrotik.rsc` |
| Response Policy Zones                          | `/domains/v2/domains_rpz.db`       |
| Legacy JSON                                    | `/domains/domains.json`            |

### Postman collection

Three files are included for Postman:

| File                                  | Purpose                                                   |
| ------------------------------------- | --------------------------------------------------------- |
| `postman_collection.json`             | All requests - import once                                |
| `postman_environment_local.json`      | Points `base_url` to `http://localhost:8787` (`pnpm dev`) |
| `postman_environment_production.json` | Points `base_url` to your deployed Cloudflare Worker      |

**Setup:**

1. Import `postman_collection.json` into Postman
2. Import both environment files
3. Edit the **Production** environment and replace `<your-cf-username>` with your Cloudflare account subdomain
4. Switch between **Local** and **Production** using the environment dropdown in the top-right corner of Postman

Every request uses the `{{base_url}}` variable - switching the environment is all it takes to target a different deployment.

### JavaScript / Fetch API

```javascript
const response = await fetch(
  "https://<worker-name>.<cf-username>.workers.dev/domains/v2/domains.json",
);
const data = await response.json();
console.log(data);
```

### cURL

```bash
# JSON - active domains
curl -H "Accept: application/json" \
  https://<worker-name>.<cf-username>.workers.dev/domains/v2/domains.json

# Plain text - active domains
curl https://<worker-name>.<cf-username>.workers.dev/domains/v2/domains.txt

# Legacy endpoint
curl https://<worker-name>.<cf-username>.workers.dev/domains/domains.json
```

## Security features

- **CORS headers** - enables access from browser-based applications
- **Path filtering** - only `/domains/` and `/domains/v2/*` paths are handled
- **Restricted upstream** - only ever forwards requests to `hole.cert.pl`
- **Allowed methods** - `GET`, `HEAD`, `OPTIONS` only
- **Header sanitization** - only safe, necessary headers are forwarded upstream
- **Rate limiting** - provided by Cloudflare's platform

## Monitoring and debugging

```bash
# Stream live logs from the deployed worker
pnpm logs
```

### Test commands

```bash
# Basic connectivity
curl -v https://<worker-name>.<cf-username>.workers.dev/domains/v2/domains.json

# CORS preflight
curl -H "Origin: https://example.com" \
     -H "Access-Control-Request-Method: GET" \
     -X OPTIONS \
     https://<worker-name>.<cf-username>.workers.dev/domains/v2/domains.json

# Invalid path - should return 404
curl https://<worker-name>.<cf-username>.workers.dev/invalid-path
```

### Common errors

| Error                       | Likely cause                                                    |
| --------------------------- | --------------------------------------------------------------- |
| `404 Not Found`             | Path does not start with `/domains/` or `/domains/v2/`          |
| `500 Internal Server Error` | Inspect with `pnpm logs`                                        |
| CORS error in browser       | Ensure you are using the proxy URL, not `hole.cert.pl` directly |
| Rate limited                | Review limits in the Cloudflare Dashboard                       |

## Project structure

```
cert-warning-list-proxy/
├── src/
│   └── worker.js                          # Cloudflare Worker source
├── postman_collection.json                # Postman collection
├── postman_environment_local.json         # Postman environment - Local (localhost:8787)
├── postman_environment_production.json    # Postman environment - Production (workers.dev)
├── package.json                           # pnpm config and scripts
├── wrangler.toml                          # Cloudflare Worker config
├── .nvmrc                                 # Node.js version pin
├── .gitignore
├── LICENSE
└── README.md
```

## License

Released under the MIT License. See [LICENSE](./LICENSE) for details.

## Author

Created for [Cyber Katalog](https://cyberkatalog.pl) by [Silesian Solutions](https://silesiansolutions.com).
