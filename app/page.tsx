"use client";

import { useState, useEffect } from "react";
import { ethers } from "ethers";

// --- TYPESCRIPT FIX ---
declare global {
  interface Window {
    ethereum: any;
  }
}

// --- CONFIGURATION FOR BASE MAINNET ---
const CONTRACT_ADDRESS = "0x85D259151eCC83ef98B4b124FAaa960f67Ed5e09"; 
const BASE_CHAIN_ID = "0x2105"; // Hex for 8453
const BASE_RPC_URL = "https://mainnet.base.org";
const BUILDER_CODE = "bc_5ptyb1wj"; // <--- ADDED BUILDER CODE

const ABI = [
  { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "uint256", "name": "newCount", "type": "uint256" }], "name": "CountChanged", "type": "event" },
  { "inputs": [], "name": "decrement", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [], "name": "getCount", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "increment", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [], "name": "count", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }
];

export default function Home() {
  const [count, setCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [account, setAccount] = useState<string | null>(null);
  const [status, setStatus] = useState<string>(""); 

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    if (window.ethereum) {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.listAccounts();
        if (accounts.length > 0) {
          const network = await provider.getNetwork();
          if (network.chainId !== BigInt(8453)) {
             setStatus("Wrong Network. Please switch to Base.");
             return;
          }
          setAccount(accounts[0].address);
          fetchCount(provider);
        }
      } catch (err) {
        console.error("Error checking connection:", err);
      }
    }
  };

  const switchToBase = async () => {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: BASE_CHAIN_ID }],
      });
      return true;
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: BASE_CHAIN_ID,
                chainName: "Base Mainnet",
                rpcUrls: [BASE_RPC_URL],
                nativeCurrency: {
                  name: "ETH",
                  symbol: "ETH",
                  decimals: 18,
                },
                blockExplorerUrls: ["https://basescan.org"],
              },
            ],
          });
          return true;
        } catch (addError) {
          console.error("Failed to add Base:", addError);
          setStatus("Could not add Base network.");
          return false;
        }
      }
      console.error("Failed to switch:", switchError);
      setStatus("Failed to switch network.");
      return false;
    }
  };

  const connectWallet = async () => {
    if (!window.ethereum) return alert("Please install MetaMask!");
    setIsLoading(true);
    setStatus("Connecting...");
    try {
      const switched = await switchToBase();
      if (!switched) return;

      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      
      setAccount(await signer.getAddress());
      fetchCount(provider);
      setStatus("");
    } catch (error) {
      console.error(error);
      setStatus("Connection failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCount = async (provider: any) => {
    try {
      const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
      const currentCount = await contract.getCount();
      setCount(Number(currentCount));
    } catch (error) {
      console.error("Error fetching count:", error);
    }
  };

  const updateCounter = async (action: "increment" | "decrement") => {
    if (!account) return alert("Please connect your wallet first.");
    
    setIsLoading(true);
    setStatus("Please confirm transaction...");

    try {
      const switched = await switchToBase();
      if (!switched) throw new Error("Wrong network");

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);

      // --- MODIFIED CODE START ---
      
     // 1. Populate the basic transaction without sending it yet
      const txReq = await contract[action].populateTransaction();

      // 2. Format the ERC-8021 Builder Code Suffix
      const codeBytes = ethers.toUtf8Bytes(BUILDER_CODE);
      const codeHex = ethers.hexlify(codeBytes).replace("0x", "");
      
      // Calculate string length in hex (length 11 becomes "0b")
      const codeLengthHex = codeBytes.length.toString(16).padStart(2, "0"); 
      
      const schemaId = "00";
      const ercMarker = "80218021802180218021802180218021"; // 32 characters (16 bytes)

      // Combine them in the exact order ERC-8021 expects
      const dataSuffix = codeHex + codeLengthHex + schemaId + ercMarker;

      // 3. Append the formatted suffix to the transaction calldata
      txReq.data = txReq.data + dataSuffix;

      // 4. Send the properly tagged transaction
      const tx = await signer.sendTransaction(txReq);
      
      // --- MODIFIED CODE END ---
      
      setStatus("Mining transaction... (Please wait)");
      await tx.wait(); 
      
      setStatus("Transaction Successful!");
      await fetchCount(provider); 
      setTimeout(() => setStatus(""), 3000);

    } catch (error: any) {
      console.error(error);
      if (error.code === "ACTION_REJECTED") {
        setStatus("Transaction rejected.");
      } else {
        setStatus("Transaction failed.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-black text-white flex flex-col items-center justify-center p-4">
      
      {/* --- NAVBAR --- */}
      <div className="absolute top-0 w-full p-6 flex justify-between items-center max-w-4xl">
        <div className="text-xl font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-white">
          BASE TAP 🔵
        </div>
        
        {account ? (
          <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full border border-white/20 backdrop-blur-sm">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="font-mono text-sm">{formatAddress(account)}</span>
          </div>
        ) : (
          <button 
            onClick={connectWallet}
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-full font-semibold transition-all shadow-[0_0_15px_rgba(37,99,235,0.5)]"
          >
            {isLoading ? "Connecting..." : "Connect Wallet"}
          </button>
        )}
      </div>

      {/* --- MAIN CARD --- */}
      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
        
        <div className="relative bg-gray-900/80 backdrop-blur-xl border border-white/10 p-12 rounded-2xl w-full max-w-md flex flex-col items-center gap-8 shadow-2xl">
          
          <h1 className="text-2xl font-light text-gray-300">Base Mainnet Count</h1>
          
          <div className="text-8xl font-bold font-mono bg-clip-text text-transparent bg-gradient-to-b from-white to-gray-400 drop-shadow-sm">
            {count !== null ? count : "-"}
          </div>

          <div className="flex gap-6 w-full justify-center">
            <button
              onClick={() => updateCounter("decrement")}
              disabled={isLoading || !account}
              className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/50 py-4 rounded-xl text-2xl font-bold transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              -
            </button>
            <button
              onClick={() => updateCounter("increment")}
              disabled={isLoading || !account}
              className="flex-1 bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/50 py-4 rounded-xl text-2xl font-bold transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              +
            </button>
          </div>

          {/* STATUS MESSAGES */}
          <div className="h-6 text-center">
            {status && (
              <p className={`text-sm ${status.includes("Failed") || status.includes("rejected") ? "text-red-400" : "text-blue-300"}`}>
                {status}
              </p>
            )}
          </div>

        </div>
      </div>
    </main>
  );
}