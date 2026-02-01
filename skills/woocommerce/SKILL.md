---
name: woocommerce
description: "Manage WooCommerce stores — products, orders, customers, and coupons via the REST API."
metadata: {"moltbot":{"emoji":"🛒","requires":{"bins":["curl","jq"],"env":["WOOCOMMERCE_URL","WOOCOMMERCE_KEY","WOOCOMMERCE_SECRET"]}}}
---

# WooCommerce

Manage products, orders, and customers via the WooCommerce REST API.

## Environment Variables

- `WOOCOMMERCE_URL` - Store URL (e.g. `https://mystore.com`)
- `WOOCOMMERCE_KEY` - Consumer key
- `WOOCOMMERCE_SECRET` - Consumer secret

## List products

```bash
curl -s -u "$WOOCOMMERCE_KEY:$WOOCOMMERCE_SECRET" \
  "$WOOCOMMERCE_URL/wp-json/wc/v3/products?per_page=10" | jq '.[] | {id, name, status, price, stock_quantity}'
```

## Create product

```bash
curl -s -X POST -u "$WOOCOMMERCE_KEY:$WOOCOMMERCE_SECRET" \
  -H "Content-Type: application/json" \
  "$WOOCOMMERCE_URL/wp-json/wc/v3/products" \
  -d '{"name":"New Product","type":"simple","regular_price":"29.99","description":"Product description","sku":"SKU-001"}' | jq '{id, name}'
```

## List orders

```bash
curl -s -u "$WOOCOMMERCE_KEY:$WOOCOMMERCE_SECRET" \
  "$WOOCOMMERCE_URL/wp-json/wc/v3/orders?per_page=10" | jq '.[] | {id, status, total, billing_email: .billing.email}'
```

## Update order status

```bash
curl -s -X PUT -u "$WOOCOMMERCE_KEY:$WOOCOMMERCE_SECRET" \
  -H "Content-Type: application/json" \
  "$WOOCOMMERCE_URL/wp-json/wc/v3/orders/ORDER_ID" \
  -d '{"status":"completed"}' | jq '{id, status}'
```

## List customers

```bash
curl -s -u "$WOOCOMMERCE_KEY:$WOOCOMMERCE_SECRET" \
  "$WOOCOMMERCE_URL/wp-json/wc/v3/customers?per_page=10" | jq '.[] | {id, email, first_name, last_name, orders_count, total_spent}'
```

## Notes

- Uses basic auth with consumer key/secret.
- Always confirm before creating or updating orders/products.
