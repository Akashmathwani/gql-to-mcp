/**
 * Custom tool: Enriched product search with external API integration
 */

import type { CustomTool } from 'gql-to-mcp';

interface Product {
  id: string;
  title: string;
  description: string;
  defaultImageUrl: string;
  price: {
    actual: number;
    unitOfMeasure: string;
    unitPrice: number;
  };
}

interface SearchResponse {
  search: {
    products: Product[];
  };
}

export const enrichedProductSearch: CustomTool = {
  name: 'enrichedProductSearch',
  description: 'Search products and enrich with data from external pricing API',

  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Product search query',
      },
    },
    required: ['query'],
  },

  async execute(args, ctx) {
    const { query } = args as { query: string };

    console.log(`[enrichedProductSearch] Searching for: ${query}`);

    // 1. Call GraphQL endpoint
    const gqlResult = await ctx.gql<SearchResponse>(
      `
      query SearchProducts($query: String!) {
        search(query: $query) {
          products {
            id
            title
            description
            defaultImageUrl
            price {
              actual
              unitOfMeasure
              unitPrice
            }
          }
        }
      }
    `,
      { query }
    );

    const products = gqlResult.data?.search?.products || [];

    // 2. Example: Call external REST API for additional data
    // Uncomment when you have a real endpoint:
    /*
    const productIds = products.map(p => p.id);
    const externalResponse = await fetch('https://external-api.example.com/enrich', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': ctx.headers.authorization || '',
      },
      body: JSON.stringify({ productIds })
    });
    const enrichmentData = await externalResponse.json();
    */

    // For now, just return the GraphQL data
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(products, null, 2),
        },
      ],
    };
  },
};
