import { expect } from 'chai';
import { ethers } from 'hardhat';

describe('Crowdfundr', () => {
  let crowdfundr;
  let deployer;
  let creator;
  let larry;
  let jenny;
  let addrs;

  beforeEach(async () => {
    [deployer, creator, larry, jenny, ...addrs] = await ethers.getSigners();
    const crowdfundrFactory = await ethers.getContractFactory('Crowdfundr');
    crowdfundr = await crowdfundrFactory.deploy(creator.address, ethers.utils.parseEther("5"));
    await crowdfundr.deployed();
  });

  // Contributor functionality
  it('allows contributors to contribute', async () => {
    // call .contribute w/ value
    // check mapping value
  });

  it('allows contributors to withdraw funds after cancellation', () => {
    // toggle cancel by creator
    // withdraw funds
  });
  
  it('allows contributors to withdraw funds after 30 days if goal is not met', () => {
    // TOUGH time simulation
  });

  it('does not allow withdrawal unless conditions are met', () => {
    // this should prolly be 2 assertions
  });

  // NFT awarding
  it('awards a NFT for a contribution of 1ETH', async () => {
    // call contribute
    // check erc271 function; address -> nft lookup
  });

  it('awards an NFT when combined contributions equal 1ETH', async () => {
    // is this necessary?
  });

  it('awards another NFT for each 1ETH donated', async () => {
    // call contribute w/ 1ETH
    // call contribute again w/ 1ETH, assert two NFTs exist for the 
  });

  it('creates transferrable NFTs', () => {
    // is this testing ERC271 code?
    // create nft
    // call transfer? `crowdfundr.transfer()`?
    // see if new address has 
  });

  // Creator functionality
  it('allows the creator to withdraw funds when the goal is met', () => {
    // contribute to goal
    // call withdraw with creator
  });

  it('prevents the creator from withdrawing funds until the goal is met', () => {
    // contribute almost to goal
    // call withdraw with creator
  });

  it('only the creator can withdraw funds', () => {
    // contribute to goal
    // call withdraw with non-creator
  });

  it('allows the creator to cancel the campaign', () => {
    // call cancel
    // check that public var is toggled
  });
});
