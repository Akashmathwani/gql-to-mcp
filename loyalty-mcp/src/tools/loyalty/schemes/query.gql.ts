// GraphQL query for fetching loyalty schemes

export const GET_SCHEMES_QUERY = /* GraphQL */ `
  query GetLoyaltySchemes(
    $business: String
    $region: String
    $language: String
    $application: String
    $channel: ChannelType
    $schemes: [loyaltySchemeInputType]
    $includeCoupons: Boolean = false
    $includeVouchers: Boolean = false
  ) {
    loyalty(
      business: $business
      region: $region
      language: $language
      application: $application
      channel: $channel
      schemes: $schemes
    ) {
      schemes {
        schemeId
        isDebitable
        accountStatus
        points {
          conversionPreference
          total {
            count
            value
            rewardedWith
          }
          debitableTotal {
            count
            value
          }
          nextMileStone {
            pointToBeCollected
            rewardedWith
          }
          minRewardsThreshold {
            minPointsCollected
            rewardedWith
          }
          minRewardDenomination {
            pointsCollected
            rewardedWith
          }
          maxThresholdPerCollectionPeriod {
            maxThresholdReached
            maxPointsCollectable
            rewardedWith
          }
        }
        coupons @include(if: $includeCoupons) {
          id
          uuid
          alphaNumericId
          description
          expiry
          canBeActivated
          validFrom
          maxRedemptionsAllowed
          redemptionsLeft
          promotionId
          value
          classification
          state
          promotionDetails {
            type
            subType
          }
        }
        vouchers @include(if: $includeVouchers) {
          id
          uuid
          alphaNumericId
          description
          expiry
          canBeActivated
          validFrom
          maxRedemptionsAllowed
          redemptionsLeft
          promotionId
          value
          classification
          state
          promotionDetails {
            type
            subType
          }
        }
      }
      currency {
        iso
        symbol
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
