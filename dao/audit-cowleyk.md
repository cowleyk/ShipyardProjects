L11: totalMembers is a uint256.
Consider making it an uint256, in order to not be limited to 255 members.
Same for "votes" in the Proposal structure.

L14: totalContributions is never used anywhere, only incrementedn consider removing it.

L32/L292: domain typehash does not have a string version, so it is not fully ERC712 compliant, consider adding it.

L37: consider adding a comment on the meaning of ProposalStatus values
ProposalStatus.INITIATED does not seem to be used

L63: Consider using an array instead of a mapping from index to Proposal

L67: Consider making totalProposals an uint256 instead of uint8, or the DAO won't be able to execute more than 255 proposals.

L222: Consider making proposalId an uint256 instead of uint8

L297: The ballot typehash only contains structure id, and not "support". So, when a user signs a message, they only sign "I vote on proposal X", and note "I vote and support or vote and refuse proposal X". The person submitting votes in batch chooses if the votes they have signatures for will support or vote against a proposal, and that is very dangerous.
Consider: adding a support field to the Ballot structure type.

L430: consider using block.chainid instead of a custom function.

General comments:
- Consider separating the membership management & the voting in 2 different contracts for readability (you can still inherit the membership management in the dao contract)
- Consider emitting 1 event per VoteSuccess, like you are doing for VoteFailed, and not only one BatchVotesSubmitted (that can also contain errors)
- Error handling in voteBySignatures is a bit weird, usually you'd want to revert if a signature is invalid or if a user already voted, because you don't want to submit on-chain a payload that you know could fail (it costs money for nothing). Also returning an array of errors forces the caller to iterate over an array to know if an error occurred, and that is not very gas efficient.
- Error handling in execute(proposalId) is a bit weird, it allows for partial execution of a proposal (e.g. first 3 of 7 steps execute properly, step 4 fails, then there is no revert and calls 4 5 6 7 are never executed), which can be dangerous if you're considering the proposal as a pack of transactions that should run in order.
- I like the idea of separating signature & data to re-build calldata, it costs more gas but it's more elegant than the Compound/OZ implementations 🙂