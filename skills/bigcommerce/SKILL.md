---
name: bigcommerce
description: "Manage BigCommerce stores — products, orders, and customers via the REST API."
metadata: {"moltbot":{"emoji":"🏬","requires":{"bins":["curl","jq"],"env":["BIGCOMMERCE_STORE_HASH","BIGCOMMERCE_ACCESS_TOKEN"]}}}
---

# BigCommerce

Manage products, orders, and customers via the BigCommerce API.

## Environment Variables

- `BIGCOMMERCE_STORE_HASH` - Store hash (e.g. `abc123`)
- `BIGCOMMERCE_ACCESS_TOKEN` - API access token

## List products

```bash
curl -s -H "X-Auth-Token: $BIGCOMMERCE_ACCESS_TOKEN" \
  "https://api.bigcommerce.com/stores/$BIGCOMMERCE_STORE_HASH/v3/catalog/products?limit=10" | jq '.data[] | {id, name, price, inventory_level}'
```

## List orders

```bash
curl -s -H "X-Auth-Token: $BIGCOMMERCE_ACCESS_TOKEN" \
  "https://api.bigcommerce.com/stores/$BIGCOMMERCE_STORE_HASH/v2/orders?limit=10" | jq '.[] | {id, status, total_inc_tax}'
```

## List customers

```bash
curl -s -H "X-Auth-Token: $BIGCOMMERCE_ACCESS_TOKEN" \
  "https://api.bigcommerce.com/stores/$BIGCOMMERCE_STORE_HASH/v3/customers?limit=10" | jq '.data[] | {id, email, first_name, last_name}'
```

## Notes

- V2 API for orders, V3 for products/customers.
- Confirm before modifying store data.
