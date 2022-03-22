import React from 'react';
import { ethers } from "ethers"
import IcoJSON from './contracts/ICO.sol/ICO.json';
import './App.css';

const { utils: { parseEther, formatEther } } = ethers;
const provider = new ethers.providers.Web3Provider(window.ethereum);
const signer = provider.getSigner();

// ICO Address on Rinkeby
const icoAddr = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
// deployer = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;
const icoContract = new ethers.Contract(icoAddr, IcoJSON.abi, provider);

function App() {
    const [amount, setAmount] = React.useState(0);
    const [owner, setOwner] = React.useState(0);
    const [totalAmountRaised, setTotalAmountRaised] = React.useState(0);
    const [userContributions, setUserContributions] = React.useState(0);
    const [currentAddress, setCurrentAddress] = React.useState(0);
    const [buyResponse, setBuyResponse] = React.useState('')

    // Refresh data on new blocks
    // Should be filtered in future
    provider.on("block", (n) => {
        console.log("New block", n);
        if(currentAddress) loadData(currentAddress);
    });

    React.useEffect(() => {
        console.log('STARTING');
        connectToMetamask();
    }, [])

    const connectToMetamask = async () => {
        try {
            let signerAddress = await signer.getAddress();
            setCurrentAddress(signerAddress);
            console.log("Signed in as", signerAddress);
            loadData(signerAddress);
        } catch(err) {
            console.log('error signing in', err);
            alert("Please sign into MetaMask");
            await provider.send("eth_requestAccounts", []);
        }
    }

    const loadData = async (signerAddress) => {
        try {
            setOwner(await icoContract.treasury());
            setTotalAmountRaised(await icoContract.totalAmountRaised());
            setUserContributions(await icoContract.userContributions(signerAddress));
        } catch(err) {
            console.log('error fetching data', err);
        }
    }

    const getTokensRemaining = () => {
        if(!totalAmountRaised) return null;
        const phaseTokensSold = totalAmountRaised.mul(5);
        const phaseTokensReamaining = parseEther("30000").sub(phaseTokensSold);
        return formatEther(phaseTokensReamaining);
    }

    const getTokensOwned = () => {
        if(!userContributions) return null;
        const userTokens = userContributions.mul(5);
        return formatEther(userTokens);
    };

    const handleCompleteIco = async () => {
        try {
            await icoContract.connect(signer).advancePhase(0);
            await icoContract.connect(signer).advancePhase(1);
            await icoContract.connect(signer).buy({ value: parseEther("30000") });
        } catch(e) {
            console.log("ERROR")
            console.log('message: ', e?.data?.message || e?.message)
        }
    }

    const getCurrentPhase = async () => {
        console.log('phase: ', await icoContract.connect(signer).currentPhase());
        console.log('token addr; ', await icoContract.token());
    }

    const handleContribute = async () => {
        try {
            await icoContract.connect(signer).buy({ value: parseEther(amount) });
            setBuyResponse(`Purchase of ${amount} SPC successful`);
        } catch(err) {
            setBuyResponse(err.data.message);
        }

    };

    return (
        <div className="App-header" >
            <hr style={{ width: '100%' }}/>
            <h1>DEV ONLY</h1>
            <button onClick={handleCompleteIco}>COMPLETE</button>
            <button onClick={getCurrentPhase}>CURRENT</button>
            <hr style={{ width: '100%' }}/>
            <h1>
                <code>SpaceCoin</code> Initial Coin Offering
            </h1>
            <ul>
                <p>Token Info:</p>
                <li>Owner Address: {owner?.toString()}</li>
                <li>Total Raised: {formatEther(totalAmountRaised)} ETH</li>
                <li>Total tokens currently available: {getTokensRemaining()} SPC</li>
                <li>Tokens owned: {getTokensOwned()} SPC</li>
            </ul>
            <p>Buy (rate: 1ETH : 5SPC)</p>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} />
            <button onClick={handleContribute}>Buy</button>
            <p>{buyResponse}</p>
        </div>
    );
    }

export default App;
