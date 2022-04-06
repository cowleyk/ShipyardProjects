# SpaceCoin ICO

An ICO for selling ERC-20 Spacec Coin token.  Will sell a total of 150,000 SPC at 5 SPC/ETH.

## UI
Requirements:
`npm` or `yarn`

To run;
```
~ cd ./app
~ yarn
~ yarn start
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
# Update .env file with proper RINKEBY_URL and PRIVATE_KEY
# Install npm packages if not already installed
~ yarn install

~ npx hardhat compile
~ npx hardhat run scripts/deployRouterAndPool.ts --network <localhost || rinkeby || desired network>
```

## Rinkeby Etherscan
- Currently deployed at:
https://rinkeby.etherscan.io/address/0x5d494871cA81b911E39dE24A911B77f8af28B4Ff

## License
[MIT](https://choosealicense.com/licenses/mit/)
