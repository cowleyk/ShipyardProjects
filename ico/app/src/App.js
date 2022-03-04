import React from 'react';
import { ethers } from "ethers"
import IcoJSON from './contracts/ICO.sol/ICO.json';
import './App.css';

const { utils: { parseEther, formatEther } } = ethers;
const provider = new ethers.providers.Web3Provider(window.ethereum);
const signer = provider.getSigner();

// ICO Address on Rinkeby
const icoAddr = '0x5d494871cA81b911E39dE24A911B77f8af28B4Ff';
const icoContract = new ethers.Contract(icoAddr, IcoJSON.abi, provider);

function App() {
    const [amount, setAmount] = React.useState(0);
    const [owner, setOwner] = React.useState(0);
    const [totalAmountRaised, setTotalAmountRaised] = React.useState(0);
    const [currentPhaseAmountRaised, setCurrentPhaseAmountRaised] = React.useState(0);
    const [userContributions, setUserContributions] = React.useState(0);
    const [currentAddress, setCurrentAddress] = React.useState(0);
    const [buyResponse, setBuyResponse] = React.useState('')

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
            setCurrentPhaseAmountRaised(await icoContract.currentPhaseAmountRaised());
            setUserContributions(await icoContract.userContributions(signerAddress));
        } catch(err) {
            console.log('error fetching data', err);
        }
    }

    const getTokensRemaining = () => {
        if(!currentPhaseAmountRaised) return null;
        const phaseTokensSold = currentPhaseAmountRaised.mul(5);
        const phaseTokensReamaining = parseEther("15000").sub(phaseTokensSold);
        return formatEther(phaseTokensReamaining);
    }

    const getTokensOwned = () => {
        if(!userContributions) return null;
        const userTokens = userContributions.mul(5);
        return formatEther(userTokens);
    }

    const handleContribute = async () => {
        console.log('handleContribute', amount)
        console.log(typeof amount)
        try {
            await icoContract.connect(signer).buy({ value: parseEther(amount) });
            setBuyResponse(`Purchase of ${amount} SPC successful`);
        } catch(err) {
            setBuyResponse(err.data.message);
        }

    };

    return (
        <div className="App-header" >
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
