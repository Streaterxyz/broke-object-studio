/* ============================================================
 * BROKE — Shopify Storefront client (public token, browser-safe)
 * Endpoint: broke-studios-xyz.myshopify.com
 * ============================================================ */

const SHOP_DOMAIN = "broke-studios-xyz.myshopify.com";
const STOREFRONT_TOKEN = "7dfeb836ef1c0e78f4e776a93ff61043";
const API_VERSION = "2025-01";
const ENDPOINT = `https://${SHOP_DOMAIN}/api/${API_VERSION}/graphql.json`;

const CART_ID_KEY = "broke:cartId";

// Curated product order for the catalogue (01–04).
// Note: handle "broke-vitamins-white-tee" maps to "BROKE VITAMINS HEAVYWEIGHT TEE".
export const PRODUCT_HANDLES = [
  "broke-vitamins-signature-tee",
  "broke-vitamins-heavyweight-tee", // alias, falls back to white-tee below
  "broke-vitamins-hoodie",
  "broke-vitamins-cotton-shorts",
];

// Real handles in the store (the order we want to display them).
export const PRODUCT_ORDER = [
  "broke-vitamins-signature-tee",
  "broke-vitamins-white-tee",        // displays as HEAVYWEIGHT TEE
  "broke-vitamins-hoodie",
  "broke-vitamins-cotton-shorts",
];

async function gql(query, variables = {}) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": STOREFRONT_TOKEN,
      "Accept": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Shopify ${res.status}`);
  const json = await res.json();
  if (json.errors) {
    console.error("GQL errors:", json.errors);
    throw new Error(json.errors[0]?.message || "GraphQL error");
  }
  return json.data;
}

const PRODUCT_FRAGMENT = `
  fragment Product on Product {
    id
    handle
    title
    descriptionHtml
    availableForSale
    priceRange {
      minVariantPrice { amount currencyCode }
      maxVariantPrice { amount currencyCode }
    }
    options { name values }
    images(first: 8) {
      edges { node { url altText width height } }
    }
    variants(first: 50) {
      edges {
        node {
          id
          title
          availableForSale
          price { amount currencyCode }
          selectedOptions { name value }
          image { url altText }
        }
      }
    }
  }
`;

// ---------- products ----------

export async function getProductsByHandles(handles) {
  // Build aliased query — one product field per handle, in order.
  const fields = handles.map((h, i) =>
    `p${i}: product(handle: "${h.replace(/"/g, '\\"')}") { ...Product }`
  ).join("\n");
  const query = `query { ${fields} } ${PRODUCT_FRAGMENT}`;
  const data = await gql(query);
  return handles.map((_, i) => data[`p${i}`]).filter(Boolean);
}

export async function getProduct(handle) {
  const query = `
    query Product($handle: String!) {
      product(handle: $handle) { ...Product }
    }
    ${PRODUCT_FRAGMENT}
  `;
  const data = await gql(query, { handle });
  return data.product;
}

// ---------- cart ----------

const CART_FRAGMENT = `
  fragment Cart on Cart {
    id
    checkoutUrl
    totalQuantity
    cost {
      subtotalAmount { amount currencyCode }
      totalAmount { amount currencyCode }
    }
    lines(first: 50) {
      edges {
        node {
          id
          quantity
          merchandise {
            ... on ProductVariant {
              id
              title
              price { amount currencyCode }
              image { url altText }
              selectedOptions { name value }
              product { handle title }
            }
          }
        }
      }
    }
  }
`;

export async function cartCreate() {
  const query = `
    mutation { cartCreate { cart { ...Cart } userErrors { message } } }
    ${CART_FRAGMENT}
  `;
  const data = await gql(query);
  const cart = data.cartCreate.cart;
  if (cart) localStorage.setItem(CART_ID_KEY, cart.id);
  return cart;
}

export async function getCart() {
  const id = localStorage.getItem(CART_ID_KEY);
  if (!id) return null;
  const query = `
    query Cart($id: ID!) { cart(id: $id) { ...Cart } }
    ${CART_FRAGMENT}
  `;
  try {
    const data = await gql(query, { id });
    if (!data.cart) {
      // Cart expired/not found — clear it.
      localStorage.removeItem(CART_ID_KEY);
      return null;
    }
    return data.cart;
  } catch (e) {
    console.warn("getCart failed:", e);
    return null;
  }
}

async function ensureCart() {
  let cart = await getCart();
  if (!cart) cart = await cartCreate();
  return cart;
}

export async function addToCart(variantId, quantity = 1) {
  const cart = await ensureCart();
  const query = `
    mutation Add($cartId: ID!, $lines: [CartLineInput!]!) {
      cartLinesAdd(cartId: $cartId, lines: $lines) {
        cart { ...Cart }
        userErrors { message }
      }
    }
    ${CART_FRAGMENT}
  `;
  const data = await gql(query, {
    cartId: cart.id,
    lines: [{ merchandiseId: variantId, quantity }],
  });
  return data.cartLinesAdd.cart;
}

export async function updateLine(lineId, quantity) {
  const cart = await ensureCart();
  const query = `
    mutation Update($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
      cartLinesUpdate(cartId: $cartId, lines: $lines) {
        cart { ...Cart }
        userErrors { message }
      }
    }
    ${CART_FRAGMENT}
  `;
  const data = await gql(query, {
    cartId: cart.id,
    lines: [{ id: lineId, quantity }],
  });
  return data.cartLinesUpdate.cart;
}

export async function removeLine(lineId) {
  const cart = await ensureCart();
  const query = `
    mutation Remove($cartId: ID!, $lineIds: [ID!]!) {
      cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
        cart { ...Cart }
        userErrors { message }
      }
    }
    ${CART_FRAGMENT}
  `;
  const data = await gql(query, { cartId: cart.id, lineIds: [lineId] });
  return data.cartLinesRemove.cart;
}

// ---------- formatting ----------

export function formatMoney(amount, currencyCode = "AUD") {
  const n = Number(amount);
  try {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: currencyCode,
      maximumFractionDigits: Number.isInteger(n) ? 0 : 2,
    }).format(n);
  } catch {
    return `${currencyCode} ${n.toFixed(2)}`;
  }
}
