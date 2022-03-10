https://github.com/ShipyardDAO/student.cowleyk/tree/44dcf76b856454f71b6d073dfdb1e4ea17958e4f

The following is a micro audit of git commit by 44dcf76b856454f71b6d073dfdb1e4ea17958e4f brianwatroba

## General comments

Good work! The comments made your contracts easy to follow and understand.

## Design Exercise

This is a good approach! You give good rationale for continuing to favor a pull design pattern even with the additional spec of awarding tokens over time. Good callout to also track how many tokens a user has collected to ensure they don't overcollect at each new vesting point.

_To think about:_

- In addition to storing a "start time", you would also need to store an investing amount allowed or some way to calculate it.
- How would you measure and compare time? For further reading, check out the [discepancy and uses of block.timestamp vs. block.number](https://medium.com/@phillipgoldberg/smart-contract-best-practices-revisited-block-number-vs-timestamp-648905104323#:~:text=timestamp%20%3F,minimally%20gamed%20by%20a%20miner.)

# Issues

## issue-1

**[Low]** Dangerous phase transitions

If the phase transition function is called twice, a phase can accidentally be skipped. There are many easy causes of this:

- Being unsure if a transaction went through, and having a delayed transaction, are very possible occurrences on the Ethereum blockchain today
- Front-end client code malfunction calling the function twice.
- Human error double-clicking a button on the interface on accident.

Consider including an `expectedCurrentPhase` parameter to the `advancePhase()` function to guard against accidental skips.

## issue-2

**[Extra feature]** Inlcusion of `receive()` function

The `buy()` function is payable and can receive ether. ICO.sol does not need to receive ether outside of a specific function call.

Consider removing `receive()` to gate the receiving of ether to only your `buy()` function.

## issue-3

**[Extra feature]** Inlcusion of `_advancePhase()` private function

`_advancePhase()`'s logic can be included in `advancePhase()`. `_advancePhase()` is only ever called from within `advancePhase()`, and the private function type isn't necessary because this contract isn't designed to be inherited.

Consider including `_advancePhase()`'s logic in `advancePhase()`.

## issue-4

**[Technical mistake]** Inheriting from contracts not in spec (OZ's Reentrancy Guard)

In ICO.sol you inherit from Open Zeppelin's Reentrancy Guard contract.

Consider refraining from inheriting other OZ contracts in your code unless specified explicitly in the spec. It's also good practice to write your own reentrancy guard! You got it!

## issue-5

**[Code quality]** Whitelisted addresses must be added one by one via `whitelistAddress()`

`whitelistAddress()` adds a single address to the whitelist per transaction.

Consider modifying the ICO.sol `constructor()` to include an array of addresses to whitelist at contract deployment. Alternatively, you could explore [multicall()](https://docs.openzeppelin.com/contracts/4.x/api/utils#Multicall). A merkle tree whitelist would be even more gas efficient. It falls outside the scope of this project, but I reccommend looking into it when you get a chance! It's cool stuff.

## issue-6

**[Code quality]** An address cannot be removed from the whitelist

- `whitelistAddress()` function accepts whitelisted addresses to add to the whitelist. However, if the ICO owner accidentally adds an address to the whitelist, there is no way to remove it.
- Consider modifying the `whitelistAddress()` function to toggle the list by sending an additional bool value (true or false) to add or remove an address from the list.

## issue-7

**[Code quality]** Modifiers should be used if reference in more than one function

Modifiers are useful because they reduce code redundancy. You
should use modifiers if you are checking for the same condition in multiple functions

Consider not using the `onlyTreasurer()` modifier in SpaceCoin.sol and instead including the logic in-line.

# Nitpicks

- Reading contribution limits from storage mapping vs. function in-line: keeping these values in a storage mapping is definitely more elegant in the function code, but requires additional SLOAD operations which are quite costly. Where possible, consider keeping these values in-line within the function unless used elsewhere.

# Score

| Reason                     | Score |
| -------------------------- | ----- |
| Late                       | -     |
| Unfinished features        | -     |
| Extra features             | 2     |
| Vulnerability              | 1     |
| Unanswered design exercise | -     |
| Insufficient tests         | -     |
| Technical mistake          | 1     |

Total: 4

Good job!
