import { expect } from 'chai';
import hre, { ethers } from 'hardhat';
const { utils: { parseEther } } = ethers;
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { Crowdfundr } from "../typechain";
import { BigNumber } from 'ethers';

describe('Crowdfundr', () => {
  let crowdfundr: Crowdfundr;
  let deployer: SignerWithAddress;
  let creator: SignerWithAddress;
  let larry: SignerWithAddress;
  let jenny: SignerWithAddress;
  let addrs: SignerWithAddress[];

  beforeEach(async () => {
    [deployer, creator, larry, jenny, ...addrs] = await ethers.getSigners();
    const crowdfundrFactory = await ethers.getContractFactory('Crowdfundr');
    crowdfundr = await crowdfundrFactory.deploy(creator.address, parseEther("5"));
    await crowdfundr.deployed();
  });

  // Creator functionality
  it('allows the creator to withdraw funds when the goal is met', async () => {
    await crowdfundr.connect(larry).contribute({value: parseEther("2")});
    await crowdfundr.connect(jenny).contribute({value: parseEther("4")});

    const balanceBeforeWithdrawal: BigNumber = await creator.getBalance();
    await crowdfundr.connect(creator).withdrawFunds(parseEther("4"));
    const balanceAfterWithdrawal: BigNumber = await creator.getBalance();

    const difference = balanceAfterWithdrawal.sub(balanceBeforeWithdrawal);
    expect(difference.gt(parseEther("3.8"))).to.be.true;
    expect(difference.lt(parseEther("4.0"))).to.be.true;
    expect(await crowdfundr.contributed()).to.equal(parseEther("2"));
  });

  it('prevents the creator from withdrawing funds until the goal is met', async () => {
    await crowdfundr.connect(jenny).contribute({value: parseEther("4")});
    await expect(crowdfundr.connect(creator).withdrawFunds(parseEther("2"))).to.be.revertedWith("Goal has not been met")
  });

  it('only the creator can withdraw funds', async () => {
    await expect(crowdfundr.connect(larry).withdrawFunds(parseEther("1"))).to.be.revertedWith("Must be campaign creator")
  });

  it('allows the creator to cancel the campaign', async () => {
    await expect(crowdfundr.connect(larry).endCampaign()).to.be.revertedWith("Must be campaign creator")
    // Address that is not the creator cannot end the campaign
    expect(await crowdfundr.ended()).to.equal(false);

    await crowdfundr.connect(creator).endCampaign();
    expect(await crowdfundr.ended()).to.equal(true);
  });

  // Contributor functionality
  it('allows contributors to contribute', async () => {
    expect(await crowdfundr.contributed()).to.equal(parseEther("0"));
    await crowdfundr.connect(jenny).contribute({value: parseEther("1")});
    await crowdfundr.connect(jenny).contribute({value: parseEther("1")});
    expect(await crowdfundr.contributed()).to.equal(parseEther("2"));

    // will only return contribution.total, not contribution.badges
    // ok to rely on that for testing?
    // const result = await crowdfundr.contributions(jenny.address);
    // console.log('result', result)
  });

  it('requires a minimum donation of 0.01 ETH', async () => {
    await expect(crowdfundr.connect(larry).contribute({value: parseEther("0.009")})).to.be.revertedWith("Must meet minimum donation")
  })

  it('allows contributors to withdraw funds after cancellation', async () => {
    await crowdfundr.connect(larry).contribute({value: parseEther("2")});
    await expect(crowdfundr.connect(larry).withdrawContribution()).to.be.revertedWith("The campaign is still active");
    await crowdfundr.connect(creator).endCampaign();

    const balanceBeforeWithdrawal: BigNumber = await larry.getBalance();
    await crowdfundr.connect(larry).withdrawContribution();
    const balanceAfterWithdrawal: BigNumber = await larry.getBalance();

    const difference = balanceAfterWithdrawal.sub(balanceBeforeWithdrawal);
    expect(difference.gt(parseEther("1.8"))).to.be.true;
    expect(difference.lt(parseEther("2.0"))).to.be.true;
  });
  
  it('allows contributors to withdraw funds after 30 days if goal is not met', async () => {
    await crowdfundr.connect(jenny).contribute({value: parseEther("2")});
    await expect(crowdfundr.connect(larry).withdrawContribution()).to.be.revertedWith("The campaign is still active");
    
    // advance time 15 days
    await increaseTime(60*60*24*15);
    await expect(crowdfundr.connect(larry).withdrawContribution()).to.be.revertedWith("The campaign is still active");
    
    // advance time another 15 days (30 days after deployment)
    await increaseTime(60*60*24*15);
    const balanceBeforeWithdrawal: BigNumber = await jenny.getBalance();
    await crowdfundr.connect(jenny).withdrawContribution();
    const balanceAfterWithdrawal: BigNumber = await jenny.getBalance();

    const difference = balanceAfterWithdrawal.sub(balanceBeforeWithdrawal);
    expect(difference.gt(parseEther("1.8"))).to.be.true;
    expect(difference.lt(parseEther("2.0"))).to.be.true;
  });

  const increaseTime = async (seconds: number): Promise<void> => {
    await hre.network.provider.send("evm_increaseTime", [seconds]);
    await hre.network.provider.send("evm_mine");
  }

  it('does not allow withdrawal unless conditions are met', async () => {
    await crowdfundr.connect(larry).contribute({value: parseEther("2")});
    await expect(crowdfundr.connect(larry).withdrawContribution()).to.be.revertedWith("The campaign is still active");
  });

  // NFT awarding
  it('awards a NFT for a contribution of 1ETH', async () => {
    expect(await crowdfundr.connect(jenny).balanceOf(jenny.address)).to.equal(0);
    await crowdfundr.connect(jenny).contribute({value: parseEther("1")});
    expect(await crowdfundr.connect(jenny).balanceOf(jenny.address)).to.equal(1);
  });

  it('awards an NFT when combined contributions equal 1ETH', async () => {
    expect(await crowdfundr.connect(jenny).balanceOf(jenny.address)).to.equal(0);
    await crowdfundr.connect(jenny).contribute({value: parseEther("0.4")});
    await crowdfundr.connect(jenny).contribute({value: parseEther("0.7")});
    expect(await crowdfundr.connect(jenny).balanceOf(jenny.address)).to.equal(1);

  });

  it('awards another NFT for each 1ETH donated', async () => {
    expect(await crowdfundr.connect(jenny).balanceOf(jenny.address)).to.equal(0);
    await crowdfundr.connect(jenny).contribute({value: parseEther("1")});
    await crowdfundr.connect(jenny).contribute({value: parseEther("1")});
    expect(await crowdfundr.connect(jenny).balanceOf(jenny.address)).to.equal(2);
  });

  // it('creates transferrable NFTs', async () => {
  //   // is this testing ERC271 code?
  //   // create nft
  //   // call transfer? `crowdfundr.transfer()`?
  //   // see if new address has 
  // });
});
