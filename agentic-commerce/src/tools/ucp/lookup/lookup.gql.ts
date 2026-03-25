// src/tools/ucp/catalog/lookup.gql.ts

export const LOOKUP_PRODUCT_QUERY = /* GraphQL */ `
  query LookupProduct($tpnc: String) {
    product(tpnc: $tpnc) {
      __typename
      id
      title
      description
      defaultImageUrl
      isForSale
      status
      price {
        price: actual
        unitPrice
        unitOfMeasure
      }
      promotions {
        promotionId: id
        offerText: description
      }
      variations {
        products {
          id
          defaultImageUrl
          variationAttributes {
            attributeGroup
            attributeGroupData {
              name
              value
            }
          }
        }
        ... on FNFProduct {
          priceRange {
            minPrice
            maxPrice
          }
        }
      }
      seller {
        id
        partnerName
      }
    }
  }
`;
