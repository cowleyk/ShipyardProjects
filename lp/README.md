# KevvySwaps Liquidity Pool

## UI
To run;
```
~ cd ./LiquidityPoolApp
~ yarn
~ yarn start

# available at http://localhost:1234
```

## Pool and Router
`scripts/deployRouterAndPool.ts`
Will deploy; 
- Space Coin ERC20 contract
- Liquidity Pool contract
- Router contract

After deploying to local hardhat network;
- automatically adds 150_000 SPC and 30_000 ETH worth of liquidity
  - KVY tokens are minted to address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

## Design Question
- Extend your LP contract to award additional rewards to further incentivize liquidity providers to deposit into your pool
- For example; a separate ERC-20 token

### ERC-271
- My initial thought: similar to the crowdfundr project, reward an NFT for people who add liquidity

### ERC-20
Reward ETH "refund" for providing liquidity
- Could be tiered; refund increases with more liquidity provided
- Would have to be conditional on leaving liquidity in pool for a set amount of time
    - The refund could also be scaled linearly with time; the longer you leave it the more ETH you receive
- Would need an external account to pull the ETH from, otherwise it would throw off the pool's calculation

Reward third ECR20 token
- Same as ETH "refund" concept; except a separate token would be minted
- Initially amount minted = contant * LPToken minted
- The longer a liquidity provided leaves their assets in the pool, the more of this separate token they earn
  - This would require timestamping the LP tokens minted, and using using that mint time to calculate how long it was left in the pool when the LP token is burned
