# Example GraphQL Queries

This document shows example GraphQL queries that the loyalty-mcp tools expect. **Update these to match your actual GraphQL schema.**

## Customer Points Balance

```graphql
query GetPointsBalance($customerId: ID!) {
  loyalty {
    customer(id: $customerId) {
      id
      points {
        balance
        pending
        currency
        tier
        expiryDate
      }
    }
  }
}
```

**Expected Response:**
```json
{
  "data": {
    "loyalty": {
      "customer": {
        "id": "CUST123",
        "points": {
          "balance": 5000,
          "pending": 250,
          "currency": "POINTS",
          "tier": "GOLD",
          "expiryDate": "2024-12-31"
        }
      }
    }
  }
}
```

## Points Transactions History

```graphql
query GetPointsTransactions($customerId: ID!, $limit: Int, $offset: Int) {
  loyalty {
    customer(id: $customerId) {
      id
      pointsTransactions(limit: $limit, offset: $offset) {
        items {
          id
          amount
          type
          description
          timestamp
          orderId
          expiryDate
        }
        pageInfo {
          totalCount
          hasNextPage
        }
      }
    }
  }
}
```

**Expected Response:**
```json
{
  "data": {
    "loyalty": {
      "customer": {
        "id": "CUST123",
        "pointsTransactions": {
          "items": [
            {
              "id": "TXN001",
              "amount": 500,
              "type": "earned",
              "description": "Purchase reward",
              "timestamp": "2024-01-15T10:30:00Z",
              "orderId": "ORDER123",
              "expiryDate": "2025-01-15"
            }
          ],
          "pageInfo": {
            "totalCount": 150,
            "hasNextPage": true
          }
        }
      }
    }
  }
}
```

## Customer Tier Status

```graphql
query GetTierStatus($customerId: ID!) {
  loyalty {
    customer(id: $customerId) {
      id
      tier {
        currentTier
        nextTier
        pointsToNextTier
        benefits
        anniversary
      }
    }
  }
}
```

**Expected Response:**
```json
{
  "data": {
    "loyalty": {
      "customer": {
        "id": "CUST123",
        "tier": {
          "currentTier": "GOLD",
          "nextTier": "PLATINUM",
          "pointsToNextTier": 2000,
          "benefits": [
            "Free shipping on all orders",
            "Priority customer support",
            "Birthday bonus points"
          ],
          "anniversary": "2023-03-15"
        }
      }
    }
  }
}
```

## List Available Rewards

```graphql
query ListRewards($category: String, $limit: Int, $offset: Int) {
  loyalty {
    rewards(category: $category, limit: $limit, offset: $offset) {
      items {
        id
        name
        description
        pointsCost
        category
        imageUrl
        available
        expiryDate
        termsAndConditions
        discount {
          type
          value
        }
      }
      pageInfo {
        totalCount
        hasNextPage
      }
    }
  }
}
```

**Expected Response:**
```json
{
  "data": {
    "loyalty": {
      "rewards": {
        "items": [
          {
            "id": "REWARD001",
            "name": "£10 Voucher",
            "description": "£10 off your next purchase",
            "pointsCost": 1000,
            "category": "vouchers",
            "imageUrl": "https://cdn.example.com/voucher.jpg",
            "available": true,
            "expiryDate": "2024-12-31",
            "termsAndConditions": "Valid on purchases over £50",
            "discount": {
              "type": "fixed",
              "value": 1000
            }
          }
        ],
        "pageInfo": {
          "totalCount": 45,
          "hasNextPage": true
        }
      }
    }
  }
}
```

## Redeem Reward

```graphql
mutation RedeemReward($customerId: ID!, $rewardId: ID!, $quantity: Int) {
  loyalty {
    redeemReward(input: {
      customerId: $customerId
      rewardId: $rewardId
      quantity: $quantity
    }) {
      redemption {
        id
        customerId
        rewardId
        pointsRedeemed
        status
        voucherCode
        redeemedAt
        expiresAt
      }
      errors {
        code
        message
      }
    }
  }
}
```

**Expected Response (Success):**
```json
{
  "data": {
    "loyalty": {
      "redeemReward": {
        "redemption": {
          "id": "REDEMPTION001",
          "customerId": "CUST123",
          "rewardId": "REWARD001",
          "pointsRedeemed": 1000,
          "status": "confirmed",
          "voucherCode": "VOUCHER-ABC-123",
          "redeemedAt": "2024-01-15T10:30:00Z",
          "expiresAt": "2024-02-15T23:59:59Z"
        },
        "errors": null
      }
    }
  }
}
```

**Expected Response (Error):**
```json
{
  "data": {
    "loyalty": {
      "redeemReward": {
        "redemption": null,
        "errors": [
          {
            "code": "INSUFFICIENT_POINTS",
            "message": "Customer does not have enough points. Required: 1000, Available: 500"
          }
        ]
      }
    }
  }
}
```

## Common Error Responses

### Customer Not Found
```json
{
  "data": {
    "loyalty": {
      "customer": null
    }
  }
}
```

### Invalid Reward
```json
{
  "data": {
    "loyalty": {
      "redeemReward": {
        "redemption": null,
        "errors": [
          {
            "code": "REWARD_NOT_FOUND",
            "message": "Reward with ID REWARD999 does not exist"
          }
        ]
      }
    }
  }
}
```

### Reward Unavailable
```json
{
  "data": {
    "loyalty": {
      "redeemReward": {
        "redemption": null,
        "errors": [
          {
            "code": "REWARD_UNAVAILABLE",
            "message": "This reward is currently out of stock"
          }
        ]
      }
    }
  }
}
```

## Testing with curl

### Test GetPointsBalance

```bash
curl -X POST https://your-loyalty-api.com/graphql \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{
    "query": "query GetPointsBalance($customerId: ID!) { loyalty { customer(id: $customerId) { id points { balance pending currency } } } }",
    "variables": {
      "customerId": "CUST123"
    }
  }'
```

### Test ListRewards

```bash
curl -X POST https://your-loyalty-api.com/graphql \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{
    "query": "query ListRewards($limit: Int) { loyalty { rewards(limit: $limit) { items { id name pointsCost } pageInfo { totalCount } } } }",
    "variables": {
      "limit": 5
    }
  }'
```

## Schema Customization Tips

If your GraphQL schema is different:

1. **Different root query name:**
   - Change `loyalty.customer` to `loyaltyCustomer`
   - Update all tool files accordingly

2. **Different field names:**
   - Map `points.balance` to your `availablePoints` field
   - Update response type interfaces in tool files

3. **Different structure:**
   - If you have nested objects, adjust the destructuring
   - Update the return statement in the `execute` function

4. **Additional fields:**
   - Add them to the query
   - Add to the response type interface
   - Include in the return object with spread operator

**Example customization:**

```typescript
// Original
const result = await ctx.gql<GqlResponse>(QUERY, { customerId });
return {
  balance: result.data.loyalty.customer.points.balance
};

// Customized for different schema
const result = await ctx.gql<GqlResponse>(QUERY, { customerId });
return {
  balance: result.data.getCustomer.loyaltyPoints.available
};
```
