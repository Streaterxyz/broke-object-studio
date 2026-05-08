/* ============================================================
 * BROKE — shared cart drawer + chrome
 * Mounts top chrome (emblem mark + nav + bag) and the drawer.
 * Auto-refreshes on add/update/remove.
 * ============================================================ */

import {
  getCart, addToCart, updateLine, removeLine, formatMoney,
} from "/assets/shopify.js";

const EMBLEM_SVG = `
<svg viewBox="0 0 300 550" aria-hidden="true">
  <use href="/assets/emblem.svg#emblem"/>
</svg>`;

// We don't have an SVG <use> entry-point; fetch path data once and inline-render.
let emblemMarkup = null;
async function getEmblemMarkup() {
  if (emblemMarkup) return emblemMarkup;
  try {
    const r = await fetch("/assets/emblem.svg");
    const txt = await r.text();
    // Strip XML declaration; keep root <svg>.
    emblemMarkup = txt.replace(/<\?xml[^?]*\?>/, "").trim();
  } catch {
    emblemMarkup = "";
  }
  return emblemMarkup;
}

// ---------- chrome ----------

export async function mountChrome({ active = "" } = {}) {
  if (document.querySelector(".chrome")) return;

  const emblem = await getEmblemMarkup();
  const wrap = document.createElement("div");
  wrap.className = "chrome";
  wrap.innerHTML = `
    <a class="mark" href="/" aria-label="BROKE — home">
      <span class="emblem-mini">${emblem}</span>
      <span class="brand-word">BROKE</span>
    </a>
    <nav class="nav" aria-label="Primary">
      <a href="/" data-link="home"${active === "home" ? ' aria-current="page"' : ""}>Index</a>
      <a href="/shop/" data-link="shop"${active === "shop" ? ' aria-current="page"' : ""}>Catalogue</a>
      <button class="bag" data-open-cart aria-label="Open bag">
        <span>Bag</span>
        <span class="count" data-bag-count data-empty="1">0</span>
      </button>
    </nav>
  `;
  document.body.appendChild(wrap);

  // Quick styling for the inline mark
  const style = document.createElement("style");
  style.textContent = `
    .chrome .mark { align-items: center; }
    .chrome .emblem-mini svg { width: 22px; height: 40px; fill: var(--ink); display: block; }
    .chrome .brand-word {
      font-family: var(--serif); font-size: 22px; letter-spacing: 0.12em;
      line-height: 1; display: block;
    }
    .chrome .nav a[aria-current="page"] { color: var(--ink); }
  `;
  document.head.appendChild(style);

  document.querySelector("[data-open-cart]")?.addEventListener("click", openDrawer);

  // Now that the chrome (with [data-bag-count]) exists, sync from current cart.
  syncBagCount();
}

// Kick off the cart fetch immediately on module load so the count is
// available the moment the chrome (or anything else) needs it.
const cartPromise = getCart().catch(() => null);

async function syncBagCount() {
  const cart = await cartPromise;
  const total = cart?.totalQuantity || 0;
  document.querySelectorAll("[data-bag-count]").forEach((el) => {
    el.textContent = total;
    el.dataset.empty = total === 0 ? "1" : "0";
  });
}

// ---------- drawer ----------

let drawerEl, backdropEl, currentCart = null;

async function ensureDrawer() {
  if (drawerEl) return;

  backdropEl = document.createElement("div");
  backdropEl.className = "drawer-backdrop";
  backdropEl.addEventListener("click", closeDrawer);
  document.body.appendChild(backdropEl);

  drawerEl = document.createElement("aside");
  drawerEl.className = "drawer";
  drawerEl.setAttribute("role", "dialog");
  drawerEl.setAttribute("aria-label", "Shopping bag");
  drawerEl.innerHTML = `
    <header>
      <h2>The Bag <span data-bag-count-text style="color:var(--ink-dim);font-weight:400">— 0</span></h2>
      <button class="close" data-close-cart aria-label="Close bag">Close ×</button>
    </header>
    <div class="lines" data-lines>
      <div class="empty" data-empty-state>
        ${await getEmblemMarkup()}
        <p>The bag waits to be filled.</p>
        <small>Authenticity in Objects · Romance in Craftsmanship</small>
      </div>
    </div>
    <footer data-footer hidden>
      <div class="totals">
        <span>Subtotal</span>
        <strong data-subtotal>—</strong>
      </div>
      <a class="checkout" data-checkout href="#">
        Checkout
        <small>Secure · Shopify</small>
      </a>
    </footer>
  `;
  // Style the empty-state emblem
  const emblemSvg = drawerEl.querySelector(".empty svg");
  if (emblemSvg) {
    emblemSvg.style.width = "60px";
    emblemSvg.style.height = "auto";
    emblemSvg.style.fill = "var(--pink)";
  }
  document.body.appendChild(drawerEl);

  drawerEl.querySelector("[data-close-cart]")?.addEventListener("click", closeDrawer);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && drawerEl.dataset.open === "1") closeDrawer();
  });
}

export async function openDrawer() {
  await ensureDrawer();
  await refreshCart();
  backdropEl.dataset.open = "1";
  drawerEl.dataset.open = "1";
  document.body.style.overflow = "hidden";
}

export function closeDrawer() {
  if (!drawerEl) return;
  backdropEl.dataset.open = "0";
  drawerEl.dataset.open = "0";
  document.body.style.overflow = "";
}

// ---------- render ----------

function renderCart(cart) {
  if (!drawerEl) return;
  currentCart = cart;
  const linesEl = drawerEl.querySelector("[data-lines]");
  const footerEl = drawerEl.querySelector("[data-footer]");
  const countTxt = drawerEl.querySelector("[data-bag-count-text]");
  const subtotalEl = drawerEl.querySelector("[data-subtotal]");
  const checkoutEl = drawerEl.querySelector("[data-checkout]");

  // Update chrome bag count everywhere
  const total = cart?.totalQuantity || 0;
  document.querySelectorAll("[data-bag-count]").forEach((el) => {
    el.textContent = total;
    el.dataset.empty = total === 0 ? "1" : "0";
  });
  if (countTxt) countTxt.textContent = `— ${total}`;

  if (!cart || total === 0) {
    linesEl.innerHTML = `
      <div class="empty" data-empty-state>
        ${emblemMarkup || ""}
        <p>The bag waits to be filled.</p>
        <small>Authenticity in Objects · Romance in Craftsmanship</small>
      </div>`;
    const emblemSvg = linesEl.querySelector(".empty svg");
    if (emblemSvg) {
      emblemSvg.style.width = "60px";
      emblemSvg.style.height = "auto";
      emblemSvg.style.fill = "var(--pink)";
    }
    footerEl.hidden = true;
    return;
  }

  const rows = cart.lines.edges.map(({ node }) => {
    const v = node.merchandise;
    const opts = v.selectedOptions
      .filter((o) => o.value && o.value.toLowerCase() !== "default title")
      .map((o) => o.value)
      .join(" · ");
    const lineTotal = Number(v.price.amount) * node.quantity;
    return `
      <div class="line" data-line="${node.id}">
        <a class="thumb" href="/product/?h=${v.product.handle}">
          ${v.image ? `<img src="${v.image.url}" alt="${v.image.altText || v.product.title}">` : ""}
        </a>
        <div>
          <a class="title" href="/product/?h=${v.product.handle}">${v.product.title}</a>
          <div class="meta">${opts || "—"}</div>
          <div class="qty">
            <button data-q="dec" aria-label="Decrease">−</button>
            <span>${node.quantity}</span>
            <button data-q="inc" aria-label="Increase">+</button>
          </div>
          <a href="#" class="remove" data-remove>Remove</a>
        </div>
        <div class="price">${formatMoney(lineTotal, v.price.currencyCode)}</div>
      </div>
    `;
  }).join("");

  linesEl.innerHTML = rows;
  linesEl.querySelectorAll(".line").forEach((row) => {
    const id = row.dataset.line;
    const line = cart.lines.edges.find((e) => e.node.id === id)?.node;
    if (!line) return;
    row.querySelector('[data-q="inc"]').addEventListener("click", async () => {
      const c = await updateLine(id, line.quantity + 1);
      renderCart(c);
    });
    row.querySelector('[data-q="dec"]').addEventListener("click", async () => {
      if (line.quantity <= 1) {
        const c = await removeLine(id); renderCart(c);
      } else {
        const c = await updateLine(id, line.quantity - 1); renderCart(c);
      }
    });
    row.querySelector("[data-remove]").addEventListener("click", async (e) => {
      e.preventDefault();
      const c = await removeLine(id); renderCart(c);
    });
  });

  footerEl.hidden = false;
  subtotalEl.textContent = formatMoney(cart.cost.subtotalAmount.amount, cart.cost.subtotalAmount.currencyCode);
  checkoutEl.href = cart.checkoutUrl;
}

export async function refreshCart() {
  await ensureDrawer();
  const cart = await getCart();
  renderCart(cart);
  return cart;
}

// ---------- public API ----------

export async function addAndOpen(variantId, quantity = 1) {
  await ensureDrawer();
  const cart = await addToCart(variantId, quantity);
  renderCart(cart);
  openDrawer();
  toast("Added to bag");
  return cart;
}

let toastEl;
export function toast(text) {
  if (!toastEl) {
    toastEl = document.createElement("div");
    toastEl.className = "toast";
    toastEl.innerHTML = `<span class="dot"></span><span data-toast-text></span>`;
    document.body.appendChild(toastEl);
  }
  toastEl.querySelector("[data-toast-text]").textContent = text;
  toastEl.dataset.show = "1";
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { toastEl.dataset.show = "0"; }, 2200);
}

// Initial bag count refresh on every page that imports this module
// (in case [data-bag-count] elements exist before mountChrome is called,
// e.g. on the hero page's intro CTA, or future pages that ship their own chrome).
syncBagCount();
