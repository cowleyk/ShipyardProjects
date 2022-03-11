# Collector DAO

## Voting System
### Proposals
- 25% quorum required on proposals
- Can be submitted by whitelisted users or users who have voted 5 on 5 other proposals
- Max transactions per proposal is set in contract constructor
- Proposal state is evaluated after every batch of signed votes
    - All votes in a batch will be counted
    - Voting will be closed after a batch breaks the 25% quorum
    - Following batches will not be counted after the quorum-breaking batch
- Members can have only one active (up for vote) proposal at a time
- Proposing members and the govenor can cancel a proposal before it executes
    - Proposing members are assumed to be subject matter experts on their proposal

### Voter
- 1 ETH to become a member
    - can contribute as much as they like
- Each voter owns and earns "voteWeight"
    - 1 voteWeight == 1 ETH
    - Contributions directly grant voteWeight
    - Each vote on a proposal grants the voter 0.05 voteWeight

### Benefits
- Encourages contributions by proportionally rewarding the contributions
- Encourages participation with a hefty reward for voting on proposals
- A 25% quorum requires significant participation
    - Obstaining from submitting votes given low-weight members more leverage over big contributors

### Negatives
- "Play to win" goes against community ideals
- Timing of when the batch votes are ran is significant to a proposal's quorum

## Design Exercise
### Non-transitive vote delegation
- Would have to track delegation inside contract
- A simple mapping of a member's address to the delegatee's address
- A member would be responsible for updating it's delegatee if they would like to use the feature

### Transitive vote delegation
- Member A delegates to trusted Member B
- Member A does not trust Member C, but Member B can delegate Member A's vote to Member C
- Votes start becoming more of a commodity rather than a mechanism for governance