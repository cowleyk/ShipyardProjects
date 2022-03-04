# SpaceCoin ICO

## UI
- Built using create-react-app
- Must be inside `app/` directory to start UI

## Contracts
- ICO contract is deployed at Rinkeby address below
- SpaceCoin is not currently deployed
    - Handled of by the ICO contract once Phase Open is reached

## Rinkeby Etherscan
https://rinkeby.etherscan.io/address/0x5d494871cA81b911E39dE24A911B77f8af28B4Ff

## Design Exercise
```
The base requirements give contributors their SPC tokens immediately.
How would you design your contract to vest the awarded tokens instead, i.e. award tokens to users over time, linearly?
```

### Owner pull approach
- There needs to be a trigger to the SPC contract to transfer tokens.
- I would continue to place the responsibility of collecting tokens even when awarded over time.
- Contributors would be responsible for collecting their earned tokens ever specified time interval.
- The added complexity would be storing a "start time" per user,
    - When the user requests their tokens, use that start time to calculate how many they're owed vs how many they have collected then transfer that amount
