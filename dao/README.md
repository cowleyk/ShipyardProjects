# Collector DAO

A governance contract for a DAO who's purpose is buying NFTs, however proposal can contain any action.

## Contracts

Split into 3 contracts;
- ContributorFactory: Management of members
- ProposalFactory: Management of proposals
- CollectorDAO: Voting and execution functionality

Requirements:
`npm`, `hardhat`

### Run Tests
```
~ yarn install
~ npx hardhat compile
~ npx hardhat test
```

## Voting System
### Proposals
- 25% quorum required on proposals
- Can be submitted by whitelisted users or users who have voted 5 on 5 other proposals
- The govenor can cancel a proposal any time before it executes
- A proposer can cancel a proposal if it has not reached a quorum
- Proposals must "soak" for 7 days to allow participants to vote

### Voter
- 1 ETH to become a member
    - can contribute as much as they like
- Each voter owns and earns "voteWeight"
    - 1 voteWeight == 1 ETH
    - Contributions directly grant voteWeight
    - Each vote on a proposal grants the voter 0.05 voteWeight
- No limit to how many proposals can be created or active

### Benefits
- Encourages contributions by proportionally rewarding the contributions
- Encourages participation with a hefty reward for voting on proposals
- A 25% quorum requires significant participation
    - Obstaining from submitting votes given low-weight members more leverage over big contributors
- Encourages members to make proposals by not limiting proposals

### Negatives
- "Pay to win" goes against community ideals
- 7 days to execute a proposal is slow and could cause missed opportunities
- Potential for spam/griefing proposals

## License
[MIT](https://choosealicense.com/licenses/mit/)
