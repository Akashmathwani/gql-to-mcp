import type { CustomTool } from 'gql-to-mcp';

// Coupons
import { getCoupons } from './loyalty/coupons/tool';

// Vouchers
import { getVouchers } from './loyalty/vouchers/tool';

// Schemes
import { getSchemes } from './loyalty/schemes/tool';

/**
 * All loyalty MCP tools
 * 
 * Tools are organized by capability:
 * - Coupons: Browse and filter customer coupons
 * - Vouchers: List vouchers with summary and details
 * - Schemes: Loyalty schemes with points and status
 */
export const allTools: CustomTool[] = [
  // Coupons — jwt required
  getCoupons,

  // Vouchers — jwt required
  getVouchers,

  // Schemes — jwt required
  getSchemes,
];
