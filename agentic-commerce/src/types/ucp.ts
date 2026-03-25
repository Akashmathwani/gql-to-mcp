// Shared UCP output types — used across all catalog tools
// https://ucp.dev/draft/specification/catalog/mcp/

export type UcpMoney = {
  amount: number; // minor units (pence)
  currency: string; // ISO 4217
};

export type UcpAvailability = {
  available: boolean;
  note?: string; // e.g. 'limited' for LOW_STOCK
};

export type UcpSelectedOption = {
  name: string;
  label: string;
};

export type UcpVariant = {
  id: string;
  price: UcpMoney;
  list_price?: UcpMoney;
  availability: UcpAvailability;
  selected_options?: UcpSelectedOption[];
  inputs?: Array<{ id: string; match: 'exact' | 'featured' }>; // lookup_catalog only
  seller?: {
    name: string;
    links?: Array<{ type: string; url: string }>;
  };
};

export type UcpProduct = {
  id: string;
  title: string;
  description?: { plain: string };
  media?: Array<{ url: string; type: 'image' | 'video' }>;
  variants: UcpVariant[];
  price_range?: {
    min: UcpMoney;
    max: UcpMoney;
  };
  rating?: {
    value: number;
    scale_max: number;
    count: number;
  };
};

export type UcpMessage = {
  type: 'info' | 'warning' | 'error';
  code: string;
  content: string;
};

// ── Response envelopes ────────────────────────────────────────────────────────

export type UcpMeta = {
  version: 'draft';
  capabilities: Record<string, Array<{ version: string }>>;
};

export type UcpPagination = {
  cursor?: string;
  has_next_page: boolean;
  total_count: number;
};

export type UcpSearchResponse = {
  ucp: UcpMeta;
  products: UcpProduct[];
  pagination: UcpPagination;
  messages?: UcpMessage[];
};

export type UcpLookupResponse = {
  ucp: UcpMeta;
  products: UcpProduct[];
  messages?: UcpMessage[];
};
