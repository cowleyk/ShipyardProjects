import React from 'react';
import { ethers } from "ethers"
import IcoJSON from './contracts/ICO.sol/ICO.json';
import './App.css';

const { utils: { parseEther, formatEther } } = ethers;
const provider = new ethers.providers.Web3Provider(window.ethereum);
const signer = provider.getSigner();

const icoAddr = '<TODO UPDATE THIS WITH RINKEBY>';
const icoContract = new ethers.Contract(icoAddr, IcoJSON.abi, provider);

function App() {
    const [amount, setAmount] = React.useState(0);
    const [owner, setOwner] = React.useState(0);
    const [totalAmountRaised, setTotalAmountRaised] = React.useState(0);
    const [currentPhaseAmountRaised, setCurrentPhaseAmountRaised] = React.useState(0);
    const [userTokens, setUserTokens] = React.useState(0);
    const [currentAddress, setCurrentAddress] = React.useState(0);
    const [buyResponse, setBuyResponse] = React.useState('')

    React.useEffect(() => {
        console.log('STARTING');
        connectToMetamask();
    }, [])

    const connectToMetamask = async () => {
        try {
            let signerAddress = await signer.getAddress()
            setCurrentAddress(signerAddress)
            console.log("Signed in as", signerAddress)
            setOwner(await icoContract.treasury());
            setTotalAmountRaised(await icoContract.totalAmountRaised());
            setCurrentPhaseAmountRaised(await icoContract.currentPhaseAmountRaised());
            setUserTokens(await icoContract.userTokens(signerAddress));
        } catch(err) {
            console.log('err', err)
            alert("Please sign into MetaMask")
            await provider.send("eth_requestAccounts", [])
        }
    }

    const getTokensRemaining = () => {
        if(!currentPhaseAmountRaised) return null;
        const phaseTokensSold = currentPhaseAmountRaised.mul(5)
        const phaseTokensReamaining = parseEther("15000").sub(phaseTokensSold);
        return formatEther(phaseTokensReamaining);
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
                <li>Tokens owned: {formatEther(userTokens)} SPC</li>
            </ul>
            <p>Buy (rate: 1ETH : 5SPC)</p>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} />
            <button onClick={handleContribute}>Buy</button>
            <p>{buyResponse}</p>
        </div>
    );
    }

export default App;
