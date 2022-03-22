https://github.com/ShipyardDAO/student.cowleyk/tree/f88574e9c3eab40565563101bf95ca6920eace7c/dao

The following is a micro audit of git commit f88574e9c3eab40565563101bf95ca6920eace7c by Diana


# General Comments

Very unique voting system - thanks for documenting it! Also, great job letting invalid votes/signatures silently fail in `voteBySignatures`! This prevents the entire transaction from failing if there is a signature that is invalid.


# Design Exercise

Awesome thinking! Another problem with transitive vote delegation is if someone wants to undo their delegation. A delegation chain could become really large, and the only way to return votes, would require O(n) storage writes, where n is the length of the chain.


# Issues

**[M-1]** Proposer can arbitrarily cancel a proposal

A proposer can cancel their own proposal at any point up to the deadline. This unnecessarily gives veto power to the proposer even if the proposal gains enough votes to pass.

Consider restricting cancellation to the first X minutes, or before the first Y votes.


**[M-2]** Non EOA accounts cannot vote

The only way to vote is by signature. However, only EOAs can create signatures, and the contract does not prevent non-EOA accounts (such as multisigs) from becoming members. This situation increases quorum with members that cannot vote.


**[M-3]** Same proposal can be proposed more than once

Consider adding a check to make sure the proposal does not already exist. Else, the votes will be spread out among different proposals and will be more difficult to succeed.


**[M-4]** No voting period

There should be a specific time period for voting. Else, a proposal can be executed very quickly without giving members enough time to vote. Example: 4 people vote yes, 3 people vote no in 5 minutes => Proposal can be executed. However, within the next 3 days, 1000 other people want to say no. But this proposal has already been executed.


**[L-1]** `voteBySignatures` can be called with 0 votes and 0 signatures

This will still emit `BatchVotesSubmitted` and cause a discrepancy for off-chain applications 


**[Q-2]** Unnecessary action limit

`propose` does not need to limit the number of actions it accepts. If the caller can't pay for the gas, the transaction will revert naturally.


**[UF-1]** NFT buying from the `NftMarketplace`

The requirement to use the support for arbitrary function calls to implement NFT buying from the `NftMarketplace` interface has not been covered.


# Score

| Reason | Score |
|-|-|
| Late                       | - |
| Unfinished features        | - |
| Extra features             | 4 |
| Vulnerability              | 9 |
| Unanswered design exercise | - |
| Insufficient tests         | - |
| Technical mistake          | - |

Total: 13

Good effort!
