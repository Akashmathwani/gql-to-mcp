// GraphQL query for fetching loyalty reward vouchers

export const GET_VOUCHERS_QUERY = /* GraphQL */ `
  query GetRewardVouchers(
    $schemes: [loyaltySchemeInputType]
    $loyaltyContexts: [LoyaltyContextType]
  ) {
    loyalty(schemes: $schemes, loyaltyContexts: $loyaltyContexts) {
      schemes {
        vouchers {
          id
          alphaNumericId
          value
          description
          expiry
          validFrom
          maxRedemptionsAllowed
          redemptionsLeft
          promotionId
          redemptionDetails {
            redeemedOn
            locationId
            locationUuid
            reference
            description
          }
          promotionDetails {
            type
            subType
          }
        }
      }
      errors {
        name
        message
        status
        code
      }
    }
  }
`;
