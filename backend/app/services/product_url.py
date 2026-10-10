"""Secure public product-URL → image extraction with SSRF protections."""
from __future__ import annotations

import ipaddress
import re
import socket
from urllib.parse import urljoin, urlparse

import httpx
from fastapi import HTTPException

ALLOWED_SCHEMES = {"http", "https"}
MAX_HTML_BYTES = 2_000_000
MAX_IMAGE_BYTES = 8_000_000
REQUEST_TIMEOUT = 12.0
USER_AGENT = (
    "OutfitLens/1.0 (+local-product-image-fetcher; respectful bot; "
    "contact: local-dev-only)"
)

OG_IMAGE_RE = re.compile(
    r'<meta[^>]+(?:property|name)=["\']og:image(?::secure_url)?["\'][^>]+content=["\']([^"\']+)["\']',
    re.IGNORECASE,
)
OG_IMAGE_RE_ALT = re.compile(
    r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+(?:property|name)=["\']og:image(?::secure_url)?["\']',
    re.IGNORECASE,
)
TWITTER_IMAGE_RE = re.compile(
    r'<meta[^>]+(?:property|name)=["\']twitter:image["\'][^>]+content=["\']([^"\']+)["\']',
    re.IGNORECASE,
)
LINK_IMAGE_RE = re.compile(
    r'<link[^>]+rel=["\']image_src["\'][^>]+href=["\']([^"\']+)["\']',
    re.IGNORECASE,
)


def _is_private_ip(ip_str: str) -> bool:
    try:
        ip = ipaddress.ip_address(ip_str)
    except ValueError:
        return True
    return (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
    )


def validate_public_http_url(url: str) -> str:
    """Validate URL scheme/host and reject private/local network targets."""
    if not url or not isinstance(url, str):
        raise HTTPException(status_code=400, detail="URL is required.")

    cleaned = url.strip()
    parsed = urlparse(cleaned)
    if parsed.scheme.lower() not in ALLOWED_SCHEMES:
        raise HTTPException(
            status_code=400,
            detail="Only http:// and https:// URLs are supported.",
        )
    if not parsed.hostname:
        raise HTTPException(status_code=400, detail="URL must include a valid hostname.")
    if parsed.username or parsed.password:
        raise HTTPException(status_code=400, detail="URLs with credentials are not allowed.")

    host = parsed.hostname
    if host.lower() in {"localhost", "metadata.google.internal"}:
        raise HTTPException(status_code=400, detail="Local or metadata hosts are blocked.")

    try:
        addr_infos = socket.getaddrinfo(host, None)
    except socket.gaierror:
        raise HTTPException(
            status_code=400,
            detail="Could not resolve the hostname. Check the URL and try again.",
        )

    for info in addr_infos:
        ip = info[4][0]
        if _is_private_ip(ip):
            raise HTTPException(
                status_code=400,
                detail="URL resolves to a private or non-public address and was blocked.",
            )

    return cleaned


def _extract_candidate_image_urls(page_url: str, html: str) -> list[str]:
    candidates: list[str] = []
    for pattern in (OG_IMAGE_RE, OG_IMAGE_RE_ALT, TWITTER_IMAGE_RE, LINK_IMAGE_RE):
        for match in pattern.finditer(html):
            candidates.append(match.group(1).strip())
    # Absolute-ize and de-dupe
    resolved: list[str] = []
    seen = set()
    for c in candidates:
        abs_url = urljoin(page_url, c)
        if abs_url not in seen:
            seen.add(abs_url)
            resolved.append(abs_url)
    return resolved


async def fetch_product_image(product_url: str) -> dict:
    """
    Attempt to retrieve a representative product image from a public shopping URL.

    Many sites block bots or hide images behind JS — those are reported gracefully.
    """
    url = validate_public_http_url(product_url)
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,image/*,*/*;q=0.8",
    }

    async with httpx.AsyncClient(
        follow_redirects=True,
        timeout=REQUEST_TIMEOUT,
        headers=headers,
        max_redirects=5,
    ) as client:
        try:
            resp = await client.get(url)
        except httpx.TimeoutException:
            raise HTTPException(
                status_code=504,
                detail="Timed out fetching the product page. The site may be slow or blocking bots.",
            )
        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=502,
                detail=f"Could not reach the product URL: {exc.__class__.__name__}",
            )

        # Re-validate final URL after redirects
        final_url = str(resp.url)
        validate_public_http_url(final_url)

        content_type = (resp.headers.get("content-type") or "").lower()

        # Direct image URL
        if content_type.startswith("image/"):
            if len(resp.content) > MAX_IMAGE_BYTES:
                raise HTTPException(status_code=400, detail="Image exceeds the 8MB size limit.")
            import base64

            b64 = base64.b64encode(resp.content).decode("ascii")
            return {
                "supported": True,
                "source_url": final_url,
                "image_url": final_url,
                "image_data_url": f"data:{content_type.split(';')[0]};base64,{b64}",
                "message": "URL pointed directly to an image.",
            }

        if "html" not in content_type and "text/" not in content_type:
            raise HTTPException(
                status_code=422,
                detail=(
                    "This URL did not return HTML or an image. "
                    "Many shopping sites require JavaScript or block automated access."
                ),
            )

        html_bytes = resp.content[:MAX_HTML_BYTES]
        html = html_bytes.decode("utf-8", errors="ignore")
        candidates = _extract_candidate_image_urls(final_url, html)

        if not candidates:
            raise HTTPException(
                status_code=422,
                detail=(
                    "No product image metadata (og:image / twitter:image) was found. "
                    "This website may be unsupported — try uploading the clothing image instead."
                ),
            )

        last_error = "No candidate images could be downloaded."
        for img_url in candidates[:5]:
            try:
                validate_public_http_url(img_url)
                img_resp = await client.get(img_url)
                validate_public_http_url(str(img_resp.url))
                img_ct = (img_resp.headers.get("content-type") or "").lower()
                if not img_ct.startswith("image/"):
                    last_error = f"Candidate was not an image ({img_ct or 'unknown type'})."
                    continue
                if len(img_resp.content) > MAX_IMAGE_BYTES:
                    last_error = "Candidate image exceeded the 8MB size limit."
                    continue
                import base64

                mime = img_ct.split(";")[0]
                b64 = base64.b64encode(img_resp.content).decode("ascii")
                return {
                    "supported": True,
                    "source_url": final_url,
                    "image_url": str(img_resp.url),
                    "image_data_url": f"data:{mime};base64,{b64}",
                    "message": "Product image retrieved from public page metadata.",
                }
            except HTTPException as he:
                last_error = he.detail if isinstance(he.detail, str) else str(he.detail)
            except Exception as exc:  # noqa: BLE001
                last_error = str(exc)

        raise HTTPException(
            status_code=422,
            detail=(
                f"Found image references but could not download a usable product image. "
                f"({last_error}) Try a direct image URL or upload the file instead."
            ),
        )
