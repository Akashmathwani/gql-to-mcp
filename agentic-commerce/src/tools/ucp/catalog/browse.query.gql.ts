// src/tools/ucp/catalog/browse.gql.ts

export const BROWSE_CATEGORY_QUERY = /* GraphQL */ `
  query BrowseCategoryProducts(
    $page: Int
    $count: Int
    $offset: Int
    $brand: String
    $superDepartment: String
    $department: String
    $offers: Boolean
  ) {
    category(
      page: $page
      count: $count
      offset: $offset
      brand: $brand
      superDepartment: $superDepartment
      department: $department
      offers: $offers
    ) {
      pageInformation: info {
        totalCount: total
        pageNo: page
        count
        pageSize
        offset
      }
      productItems: products {
        id
        title
        shortDescription
        defaultImageUrl
        brandName
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
        reviews {
          stats {
            noOfReviews
            overallRating
            overallRatingRange
          }
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
          name
        }
      }
    }
  }
`;
