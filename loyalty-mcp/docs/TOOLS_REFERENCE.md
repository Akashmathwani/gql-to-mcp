# Loyalty MCP Tools Reference

## Overview

Three loyalty tools implemented following the agentic-commerce structure pattern:

1. **get_coupons** - Fetch customer coupons with filtering
2. **get_vouchers** - Fetch customer vouchers with summary
3. **get_schemes** - Fetch loyalty schemes with points information

## Structure

Each tool follows this organization:

```
loyalty/
├── coupons/
│   ├── types.ts          # TypeScript types for GraphQL responses
│   ├── query.gql.ts      # GraphQL query definition
│   └── tool.ts           # Tool implementation with mappers
├── vouchers/
│   ├── types.ts
│   ├── query.gql.ts
│   └── tool.ts
└── schemes/
    ├── types.ts
    ├── query.gql.ts
    └── tool.ts
```

## Tool 1: get_coupons

### Description
Fetch customer loyalty coupons with optional filtering by IDs, period, types, and states. Includes summary counts for available coupons.

### Authentication
`jwt` - Requires customer authentication

### Input Schema

```typescript
{
  business?: string;              // default: "grocery"
  region?: string;                // e.g., "UK", "IE"
  language?: string;              // e.g., "en-GB"
  application?: string;           // application identifier
  channel?: ChannelType;          // default: "ONLINE"
  couponIdList?: string[];        // specific coupon IDs to retrieve
  filters?: {
    period?: "CURRENT" | "ALL" | "UNTIL_NOW";
    fields?: {
      couponTypes?: string[];     // filter by coupon types
      couponState?: string[];     // ISSUED, ACTIVATED, REDEEMED, etc.
    };
    dateRange?: {
      fieldName: string;          // date field to filter on
      from: string;               // start date (ISO format)
      to: string;                 // end date (ISO format)
    };
  };
}
```

### Response

```typescript
{
  coupons: Array<{
    id: string | null;
    uuid: string | null;
    alphaNumericId: string | null;
    description: string | null;
    expiry: string | null;
    canBeActivated: boolean;
    validFrom: string | null;
    maxRedemptionsAllowed: number;
    redemptionsLeft: number;
    redemptionDetails: Array<{
      redeemedOn: string | null;
      locationUuid: string | null;
      storeId: string | null;
      reference: string | null;
      description: string | null;
    }>;
    promotionId: string | null;
    value: number;
    classification: string | null;
    state: string | null;
    promotionDetails: {
      type: string | null;
      subType: string | null;
    } | null;
  }>;
  summary: {
    uniqueCount: number;
    redeemableCount: number;
  };
  errors: Array<{
    name: string | null;
    message: string | null;
    status: number | null;
    code: string | null;
  }>;
}
```

### Example Usage

```typescript
// Get all current coupons
const result = await getCoupons({
  region: "UK",
  filters: {
    period: "CURRENT"
  }
});

// Get specific coupons by state
const result = await getCoupons({
  region: "UK",
  filters: {
    period: "CURRENT",
    fields: {
      couponState: ["ISSUED", "ACTIVATED"]
    }
  }
});
```

---

## Tool 2: get_vouchers

### Description
Fetch customer's vouchers with summary (available, issued, spent) and detailed list. Supports filtering by voucher types, states, and time periods.

### Authentication
`jwt` - Requires customer authentication

### Input Schema

```typescript
{
  business?: string;              // default: "grocery"
  region?: string;
  language?: string;
  application?: string;
  channel?: ChannelType;          // default: "ONLINE"
  filters?: {
    subType?: Array<
      "CLUBCARD" | 
      "CHRISTMAS_BONUS" | 
      "CHRISTMAS_SAVER_TOP_UP" | 
      "FASTER_DIGITAL_VOUCHER"
    >;
  };
  detailsFilters?: {
    period: "ALL" | "CURRENT" | "UNTILNOW";
    state: Array<
      "AVAILABLE" | 
      "REDEEMED" | 
      "CANCELLED" | 
      "ACTIVATED" | 
      "EXPIRED"
    >;
    voucherType?: Array<
      "CLUBCARD" | 
      "CHRISTMAS_BONUS" | 
      "CHRISTMAS_SAVER_TOP_UP" | 
      "FASTER_DIGITAL_VOUCHER"
    >;
  };
}
```

### Response

```typescript
{
  vouchers: Array<{
    id: string | null;
    description: string | null;
    validFrom: string | null;
    expiryDate: string | null;
    state: string | null;
    scannableCode: string | null;
    redemptionsLeft: number;
    maxRedemptionsLimit: number;
    type: string | null;
    value: string | null;
    keyInCode: string | null;
    redemptionDetails: Array<{
      id: string | null;
      redeemedOn: string | null;
      type: string | null;
      location: string | null;
      locationId: string | null;
      locationUuid: string | null;
    }>;
  }>;
  summary: {
    available: number;
    issued: number;
    spent: number;
  };
  totalValue: number;
  currency: {
    iso: string | null;
    symbol: string | null;
  };
  errors: Array<{
    name: string | null;
    message: string | null;
    status: number | null;
    code: string | null;
  }>;
}
```

### Example Usage

```typescript
// Get available clubcard vouchers
const result = await getVouchers({
  region: "UK",
  filters: {
    subType: ["CLUBCARD"]
  },
  detailsFilters: {
    period: "CURRENT",
    state: ["AVAILABLE"]
  }
});

// Get all vouchers including redeemed
const result = await getVouchers({
  region: "UK",
  detailsFilters: {
    period: "ALL",
    state: ["AVAILABLE", "REDEEMED", "EXPIRED"],
    voucherType: ["CLUBCARD", "CHRISTMAS_BONUS"]
  }
});
```

---

## Tool 3: get_schemes

### Description
Fetch customer's loyalty schemes with points information, account status, and optionally associated coupons and vouchers. Returns all schemes customer is enrolled in unless specific schemes are requested.

### Authentication
`jwt` - Requires customer authentication

### Input Schema

```typescript
{
  business?: string;              // default: "grocery"
  region?: string;
  language?: string;
  application?: string;
  channel?: ChannelType;          // default: "ONLINE"
  schemes?: Array<{
    schemeName: 
      "UK_CLUBCARD" | 
      "UK_CLUBCARD_PLUS" | 
      "UK_COLLEAGUE_DISCOUNT" | 
      "IE_CLUBCARD" | 
      "IE_COLLEAGUE_DISCOUNT" | 
      "UK_CLUBCARD_SAVERS" | 
      "IE_CLUBCARD_SAVERS" | 
      "CZ_CLUBCARD" | 
      "CZ_COLLEAGUE_DISCOUNT" | 
      "HU_CLUBCARD" | 
      "HU_COLLEAGUE_DISCOUNT" | 
      "SK_CLUBCARD" | 
      "SK_COLLEAGUE_DISCOUNT";
    coupons?: {
      period: "CURRENT" | "ALL" | "UNTIL_NOW";
      filters?: Array<{
        classification: Array<
          "ONLINE" | 
          "INSTORE" | 
          "ONLINE_INSTORE" | 
          "ALL"
        >;
      }>;
    };
  }>;
  includeCoupons?: boolean;       // default: false
  includeVouchers?: boolean;      // default: false
}
```

### Response

```typescript
{
  schemes: Array<{
    schemeId: string | null;
    isDebitable: boolean;
    accountStatus: string | null;
    points: {
      conversionPreference: string | null;
      total: {
        count: number;
        value: number;
        rewardedWith: number;
      };
      debitableTotal: {
        count: number;
        value: number;
      };
      nextMileStone: {
        pointToBeCollected: number;
        rewardedWith: number;
      };
      minRewardsThreshold: {
        minPointsCollected: number;
        rewardedWith: number;
      } | null;
      minRewardDenomination: {
        pointsCollected: number;
        rewardedWith: number;
      } | null;
      maxThresholdPerCollectionPeriod: {
        maxThresholdReached: boolean;
        maxPointsCollectable: number;
        rewardedWith: number;
      } | null;
    } | null;
    coupons: Array<{...}>;        // if includeCoupons: true
    vouchers: Array<{...}>;       // if includeVouchers: true
  }>;
  summary: {
    total: number;
    active: number;
    inactive: number;
  };
  currency: {
    iso: string | null;
    symbol: string | null;
  };
  errors: Array<{
    name: string | null;
    message: string | null;
    status: number | null;
    code: string | null;
  }>;
}
```

### Example Usage

```typescript
// Get all customer schemes
const result = await getSchemes({
  region: "UK"
});

// Get specific scheme with coupons
const result = await getSchemes({
  region: "UK",
  schemes: [{
    schemeName: "UK_CLUBCARD",
    coupons: {
      period: "CURRENT"
    }
  }],
  includeCoupons: true
});

// Get schemes with full details
const result = await getSchemes({
  region: "UK",
  includeCoupons: true,
  includeVouchers: true
});
```

---

## Common Features

### Error Handling

All tools return errors in a consistent format:

```typescript
errors: Array<{
  name: string | null;
  message: string | null;
  status: number | null;
  code: string | null;
}>;
```

### Null Safety

All mapper functions handle nullable GraphQL fields gracefully:
- Use `??` operator for defaults
- Filter out null items from arrays
- Return structured objects with explicit null values where appropriate

### Type Safety

Each tool has:
- Dedicated TypeScript types in `types.ts`
- Zod schema validation for inputs
- Typed GraphQL response handling

---

## Testing

### Local Testing

```bash
# Start the server
cd loyalty-mcp
npm run dev

# Server runs on http://localhost:6275
```

### MCP Inspector

1. Open `http://localhost:6275` in browser
2. Test each tool with sample inputs
3. Verify responses match expected structure

### Example Test Inputs

**get_coupons:**
```json
{
  "region": "UK",
  "filters": {
    "period": "CURRENT"
  }
}
```

**get_vouchers:**
```json
{
  "region": "UK",
  "detailsFilters": {
    "period": "CURRENT",
    "state": ["AVAILABLE"]
  }
}
```

**get_schemes:**
```json
{
  "region": "UK",
  "includeCoupons": true
}
```

---

## Architecture Notes

### Pattern Benefits

Following the agentic-commerce structure provides:

1. **Separation of Concerns**
   - `types.ts` - GraphQL response types only
   - `query.gql.ts` - Query definitions
   - `tool.ts` - Business logic and transformations

2. **Type Safety**
   - Explicit types for GraphQL responses
   - Type-safe mappers
   - Compile-time error detection

3. **Maintainability**
   - Easy to update queries independently
   - Clear mapping logic
   - Testable mapper functions

4. **Consistency**
   - Same structure across all tools
   - Predictable file organization
   - Standard error handling

### GraphQL Best Practices

- Use typed GraphQL responses
- Handle nullable fields explicitly
- Filter null items from arrays
- Provide sensible defaults

---

## Next Steps

To add more tools:

1. Create new directory under `src/tools/loyalty/`
2. Add `types.ts`, `query.gql.ts`, and `tool.ts`
3. Import and export from `src/tools/index.ts`
4. Follow the established patterns

---

*Last updated: December 2024*
