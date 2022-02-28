# Audit Overview

We were tasked with auditing the Crowdfundr codebase.

Over the course of the audit, we identified certain potential security vulnerability that can arise in the Crowdfundr contract.

## Audit 
High: 1
Medium: 0
Low: 0
Code Quality: 3

## **[H-1]** Users cannot contribute to the project

On line 141, Crowdfundr.sol has the following code:
```
        uint256 amountToReward = contributions[msg.sender] -
            (balanceOf(msg.sender) * 1 ether);

```

This subtraction can cause an error. users can call withdrawContribution() to withdraw their contribution. it decreases the contribution amount. so, in some situations, the amountToReward can be negative and EVM throw an error. it can revert the transaction thus user cannot contribute.

Consider: adding a if statement to check if `contributions[msg.sender]` is greater than or equal to `balanceOf(msg.sender) * 1 ether`.



## **[Q-1]** Unnecessary variable `_campaigns`

On line 29, Crowdfundr.sol has the following code:
```
    function getCampaigns()
        external
        view
        returns (Crowdfundr[] memory _campaigns)
    {
        _campaigns = new Crowdfundr[](campaigns.length);
        return campaigns;
    }

```

The _campaigns variable uselessly stores the array of campaigns.

Consider: We advise to delete the _campaigns variable and simply return the array of campaigns. This will make the code more readable and easier to understand..

## **[Q-2]** Suboptimal Variable Mutability

On line 45, 46 and 51, Crowdfundr.sol has the following code:
```
    address payable public creator;
    uint256 public goal;
    uint256 public deadline;
```
These variables are assigned to only once during its declaration

Consider: We advise them to be set as `immutable` thereby optimizing the contract's deployment cost.

## **[Q-3]** Unnecessary `nonReentrant` modifier

On line 115, Crowdfundr.sol has the following code:
```
    function withdrawContribution()
        external
        canWithdrawContribution
        nonReentrant
    {
        require(contributions[msg.sender] > 0, "No contribution to withdraw");

        uint256 withdrawal = contributions[msg.sender];
        /// @dev setting contributions to 0 prevents contributors from withdrawing multiple times
        delete contributions[msg.sender];
        (bool success, ) = msg.sender.call{value: withdrawal}("");
        require(success, "Failed to withdraw");
    }

```

Since `contributions[msg.sender]` is deleted before low-level `call()`, an attacker cannot withdraw multiple times.

Consider: We advise to delete the `nonReentrant` modifier. then the `ReentrancyGuard.sol` can be omitted. optimizing the codebase.
