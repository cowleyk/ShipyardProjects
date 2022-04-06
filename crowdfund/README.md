# Crowdfundr Project

A kickstarter-like contract to collect funds for projects.
Incentivizes contributions by rewarding NFT badges for 1 ETH donations.

## Contracts

### CampaignFactory
- Create a new Crowdfundr campaign
- Get list of all Crowdfundr campaigns

### Crowdfundr
- Contribute Funds
- Withdraw contributions (if campaign fails or was cancelled)
- Withdraw funds (campaign creator only)

### Run Tests
Requirements:
`npm`, `hardhat`

```
~ yarn install
~ npx hardhat compile
~ npx hardhat test
```

## License
[MIT](https://choosealicense.com/licenses/mit/)
