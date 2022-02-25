# Week 1 Crowdfundr Project

## My Spec
### Creators:
- Set up a smart contract to gather funds for a project
- Set a target contribution goal
- Withdraw funds once target is met
- Option to cancel the campaign
- If the target is not reached within 30 days the campaign is cancelled

### Contributors:
- Contribute at least 0.01ETH with no maximum
- Earn a transferable contribution badge (NFT) for every 1ETH contributed
- Withdraw contributions if the campaign is cancelled or the target funding is not reached

## Official Spec
- The smart contract is reusable; multiple projects can be registered and accept ETH concurrently.
  - Specifically, you should use the factory contract pattern.
- The goal is a preset amount of ETH.
  - This cannot be changed after a project gets created.
- Regarding contributing:
  - The contribute amount must be at least 0.01 ETH.
  - There is no upper limit.
  - Anyone can contribute to the project, including the creator.
  - One address can contribute as many times as they like.
  - No one can withdraw their funds until the project either fails or gets cancelled.
- Regarding contributer badges:
  - An address receives a badge if their **total contribution** is at least 1 ETH.
  - One address can receive multiple badges, but should only receive 1 badge per 1 ETH.
- If the project is not fully funded within 30 days:
  - The project goal is considered to have failed.
  - No one can contribute anymore.
  - Supporters get their money back.
  - Contributor badges are left alone. They should still be tradable.
- Once a project becomes fully funded:
  - No one else can contribute (however, the last contribution can go over the goal).
  - The creator can withdraw any amount of contributed funds.
- The creator can choose to cancel their project before the 30 days are over, which has the same effect as a project failing.

## Design Exercise
```
Smart contracts have a hard limit of 24kb. Crowdfundr hands out an NFT to everyone who contributes. However, consider how Kickstarter has multiple contribution tiers. How would you design your contract to support this, without creating three separate NFT contracts?
```

### Token Array
* Approach ERC271 similar to cryptozombies *
In our prework, cryptozombies implemented a ERC271 standard for the `Zombie` created in the game.
This was done by storing an array `Zombie[] public zombies;`, where the zombie ID was the index of the array.
If the only additional feature of the token is it's teir, this approach can be simplified by using an array `uint256[] public tokens;`, where the token ID is the array's index, and the tier is the value stored in the array.
eg: `[1, 2, 1, 3, 2, 3]`
Instead of using a counter variable to generate a token ID, the return value from  `uint256 tokenId = tokens.push(tier)` would be stored in a `mapping(uint256 => address) public tokenToOwner`
