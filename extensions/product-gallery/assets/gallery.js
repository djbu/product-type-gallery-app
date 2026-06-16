/*
 * Product Type Gallery — storefront loader.
 *
 * Fetches matching gallery media from the app proxy and either:
 *   - dispatches `product-gallery:loaded` (always), so your theme can render it, or
 *   - auto-appends a simple grid after the native product media (when enabled).
 *
 * Append only — it never removes or replaces native Shopify media.
 */
(function () {
  var node = document.querySelector("script[data-product-type-gallery-context]");
  if (!node) return;

  var ctx;
  try {
    ctx = JSON.parse(node.textContent);
  } catch (e) {
    return;
  }
  if (!ctx || !ctx.productId) return;

  var settings = ctx.settings || {};

  // Build the proxy URL. Passing productType/title/tags lets the app skip a
  // GraphQL lookup entirely — the <100ms hot path.
  var params = new URLSearchParams();
  params.set("productId", String(ctx.productId));
  if (ctx.productType) params.set("productType", ctx.productType);
  if (ctx.title) params.set("title", ctx.title);
  if (Array.isArray(ctx.tags) && ctx.tags.length) {
    params.set("tags", ctx.tags.join(","));
  }

  fetch(ctx.endpoint + "?" + params.toString(), {
    headers: { Accept: "application/json" },
  })
    .then(function (res) {
      return res.ok ? res.json() : { images: [], videos: [] };
    })
    .then(function (data) {
      data = data || { images: [], videos: [] };
      var images = data.images || [];
      var videos = settings.showVideos === false ? [] : data.videos || [];

      // Expose for theme code that prefers to read state directly.
      window.ProductTypeGalleryData = { images: images, videos: videos };

      // Always notify the theme. Existing custom galleries listen here.
      document.dispatchEvent(
        new CustomEvent("product-gallery:loaded", {
          detail: { images: images, videos: videos },
        })
      );

      if (settings.autoAppend) {
        autoAppend(images, videos, settings);
      }
    })
    .catch(function () {
      /* fail silently — never break the product page */
    });

  function autoAppend(images, videos, settings) {
    if (!images.length && !videos.length) return;

    var container = document.querySelector("[data-product-type-gallery]");
    var grid = document.querySelector("[data-product-type-gallery-grid]");
    if (!container || !grid) return;

    images.forEach(function (img) {
      grid.appendChild(buildImage(img));
    });
    videos.forEach(function (vid) {
      grid.appendChild(buildVideo(vid));
    });

    container.hidden = false;

    // Move the gallery after the native media group, if we can find it.
    var selector = settings.targetSelector;
    if (selector) {
      var anchor = document.querySelector(selector);
      if (anchor && anchor.parentNode) {
        anchor.parentNode.insertBefore(container, anchor.nextSibling);
      }
    }
  }

  function buildImage(img) {
    var fig = document.createElement("figure");
    fig.className = "product-type-gallery__item product-type-gallery__item--image";
    var el = document.createElement("img");
    el.src = img.url;
    el.loading = "lazy";
    el.alt = "";
    el.className = "product-type-gallery__media";
    fig.appendChild(el);
    return fig;
  }

  function buildVideo(vid) {
    var fig = document.createElement("figure");
    fig.className = "product-type-gallery__item product-type-gallery__item--video";
    var el = document.createElement("video");
    el.src = vid.url;
    el.controls = true;
    el.playsInline = true;
    el.preload = "metadata";
    el.className = "product-type-gallery__media";
    fig.appendChild(el);
    return fig;
  }
})();
