https://github.com/ShipyardDAO/student.cowleyk/tree/3abec6e80688339aa7aacbabbcd2d1fa34fb2106/crowdfund

The following is a micro audit of git commit 3abec6e80688339aa7aacbabbcd2d1fa34fb2106 by Diana


# General Comments

Overall great job and great tests! Well done! 


# Design Exercise

Good idea, but storing a uint256 array takes up a lot of storage, especially if there are many contributors. This could likely go past the storage limit of 24kb in a smart contract.


# Issues

**[Extra Feature]** `getBadgesByOwner` function

The feature of returning an array of IDs that belong to a specific address was not in the spec and is considered an extra feature.
 

**[M-1]** Reentrancy Attack to steal tokens

Great job by using _safeMint on line 147. This prevents sending tokens to a contract that does not implement the equivalent of IERC721Receiver interface. However, because you are using `_safeMint`, you MUST mark `contribute` as nonReentrant or else you'll be susceptible to a reentrancy attack.


**[M-2]** Contributor can mint themselves arbitrary number of badges by only contributing 1 ether

In line 141 of Crowdfundr.sol, you have: 

`uint256 amountToReward = contributions[msg.sender] - (balanceOf(msg.sender) * 1 ether);`

which calculates the amount of NFTs to mint to the user by subtracting the amount of badges they already have from their total individual contribution. However, `balanceOf` is controlled by the user, because they can reduce this value to 0 by transferring their NFT's to a different address. If the user donated N ETH in total, receives N NFT's, and then transfers those NFT's to a different address, they can call `contribute` with the minimum contribution (0.01 ETH) and receive N NFTs again.

One way to prevent this is to you an additional mapping storage variable to keep track of how many NFT's have been disbursed to each user. This mapping will not be changeable by anyone, and so it does not fall prey to this attack.


**[Q-1]** Needless setting of storage variables to 0

This is not needed (and wastes gas) because every variable type has a default value it gets set to upon declaration. For example:

```solidity
address a;  // will be initialized to the 0 address (address(0))
uint256 b;  // will be initialized to 0
bool c;     // will be initialized to false
```


**[Q-2]** Do not need to check for 0 address

Line 63 Crowdfundr.sol is unnessescary, solidity does the address(0) check under the hood


# Score

| Reason | Score |
|-|-|
| Late                       | - |
| Unfinished features        | - |
| Extra features             | 1 |
| Vulnerability              | 4 |
| Unanswered design exercise | - |
| Insufficient tests         | - |
| Technical mistake          | - |

Total: 5

Good job!
