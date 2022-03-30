# Vulnerabilities
## SudokuExchange
### **[M-1]** Reentrancy inside `createReward()`
`reqardChallenges` is updated after calling `.transferFrom()` on the external token contract

### **[M-1]** Reentrancy inside `claimReward()`
`challengeReward.solved` is updated after calling `.transfer()` on the external token contract
Could lead to bad actor continuously submitting correct solutions and reaping multiple rewards

### **[H-1]** Challenge will not be set as solved
```
# SudokuExchange.sol line 57-59
ChallengeReward memory challengeReward = rewardChallenges[address(challenge)];
challengeReward.token.transfer(address(this), challengeReward.reward);
challengeReward.solved = true;
```
`challengeReward` is set in memory, so setting `challengeReward.solved = true;` will not actually alter the struct in storage

## SudokuChallenge

# Gas Optimizations
## SudokuExchange
- No reason to store `challenge` inside the `ChallengeReward` struct
  - the challenge address is required for look up on `rewardChallenges`
  - the address should be passed in separately to `createReward()`

- It is unnecessary to create a new contract for each challenge
  - the `ChallenbgeReward` struct could store the uint8[81] solution
  - `validate()` could live inside `SudokuExchange.sol`
  - `rewardChallenges` would be a mapping of challenge IDs to structs

- Add checks that `reward > 0` and `address(token) != address(0)` inside `createReward()` to prevent pointless challenges from being created

## SudokuChallenge

# Code Quality Issues
## SudokuExchange
- Empty constructor function

## SudokuChallenge