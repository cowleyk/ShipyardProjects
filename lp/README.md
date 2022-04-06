# Liquidity Pool

A liquidity pool for swapping Space Coin (SPC) for Ether

## Live Contracts
Rinkeby links

## Usage
Add liquidity
Withdraw liquidity
Swap ETH -> SPC
Swap SPC -> ETH

## UI
To run;
```
~ cd ./LiquidityPoolApp
~ yarn
~ yarn start

# available at http://localhost:1234
```

## Contracts
Requirements:
`npm`, `hardhat`

### Run Tests
```
~ yarn install
~ npx hardhat compile
~ npx hardhat test
```

### Deployment
```
# if npm packages are not already installed
~ yarn install
~ npx hardhat compile
~ npx hardhat run scripts/deployRouterAndPool.ts --network <localhost || rinkeby || desired network>
```

Will deploy; 
- Space Coin ERC20 contract
- Liquidity Pool contract
- Router contract

If deploying to local network;
- Will attempt to transfer 150_000 SPC and 30_000 ETH worth of liquidity into liquidity pool contract

## License
[MIT](https://choosealicense.com/licenses/mit/)
