# SpaceCoin ICO

## Rinkeby Etherscan
https://rinkeby.etherscan.io/address/0x5d494871cA81b911E39dE24A911B77f8af28B4Ff

## Design Exercise
```
The base requirements give contributors their SPC tokens immediately.
How would you design your contract to vest the awarded tokens instead, i.e. award tokens to users over time, linearly?
```

### Owner pull approach
There needs to be a trigger to the SPC contract to transfer tokens.
I like the approach of relying on users to withdraw their tokens.
I would continue to place the responsibility of collecting tokens even when awarded over time.
That would mean contributors would be responsible for collecting their earned tokens ever specified time interval.
The added complexity would be storing a "start time" per user, and when the user requests their tokens,
use that start time to calculate how many they've accrued vs how many they have collected.
