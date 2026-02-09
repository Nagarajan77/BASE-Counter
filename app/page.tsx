"use client";

import { useState, useEffect } from "react";
import { ethers } from "ethers";

// --- TYPESCRIPT FIX ---
declare global {
  interface Window {
    ethereum: any;
  }
}

// --- CONFIGURATION ---
const CONTRACT_ADDRESS = "0x85D259151eCC83ef98B4b124FAaa960f67Ed5e09"; // <--- PASTE REMIX ADDRESS HERE
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
  const [status, setStatus] = useState<string>(""); // For showing status messages

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    if (window.ethereum) {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.listAccounts();
        if (accounts.length > 0) {
          setAccount(accounts[0].address);
          fetchCount(provider);
        }
      } catch (err) {
        console.error("Error checking connection:", err);
      }
    }
  };

  const connectWallet = async () => {
    if (!window.ethereum) return alert("Please install MetaMask!");
    setIsLoading(true);
    try {
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
    setStatus("Please confirm transaction in MetaMask...");

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);

      // Send Transaction
      const tx = action === "increment" ? await contract.increment() : await contract.decrement();
      
      setStatus("Mining transaction... (Please wait)");
      await tx.wait(); // Wait for block confirmation
      
      setStatus("Transaction Successful! Updating UI...");
      await fetchCount(provider); // Refresh number
      
      // Clear success message after 3 seconds
      setTimeout(() => setStatus(""), 3000);

    } catch (error: any) {
      console.error(error);
      // Handle "User rejected" specifically
      if (error.code === "ACTION_REJECTED") {
        setStatus("Transaction rejected by user.");
      } else if (error.reason) {
         // Try to capture revert reason (e.g. "Count cannot be negative")
        setStatus(`Error: ${error.reason}`);
      } else {
        setStatus("Transaction failed.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Helper to shorten address (e.g., 0x123...abcd)
  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-black text-white flex flex-col items-center justify-center p-4">
      
      {/* --- NAVBAR / HEADER --- */}
      <div className="absolute top-0 w-full p-6 flex justify-between items-center max-w-4xl">
        <div className="text-xl font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">
          BASE COUNTER
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
            className="bg-cyan-600 hover:bg-cyan-500 text-white px-5 py-2 rounded-full font-semibold transition-all shadow-[0_0_15px_rgba(8,145,178,0.5)]"
          >
            {isLoading ? "Connecting..." : "Connect Wallet"}
          </button>
        )}
      </div>

      {/* --- MAIN CARD --- */}
      <div className="relative group">
        {/* Glow Effect behind card */}
        <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
        
        <div className="relative bg-gray-900/80 backdrop-blur-xl border border-white/10 p-12 rounded-2xl w-full max-w-md flex flex-col items-center gap-8 shadow-2xl">
          
          <h1 className="text-2xl font-light text-gray-300">Current Count</h1>
          
          {/* THE NUMBER DISPLAY */}
          <div className="text-8xl font-bold font-mono bg-clip-text text-transparent bg-gradient-to-b from-white to-gray-500 drop-shadow-sm">
            {count !== null ? count : "-"}
          </div>

          {/* CONTROLS */}
          <div className="flex gap-6 w-full justify-center">
            <button
              onClick={() => updateCounter("decrement")}
              disabled={isLoading || !account}
              className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/50 py-4 rounded-xl text-2xl font-bold transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed hover:shadow-[0_0_20px_rgba(239,68,68,0.3)]"
            >
              -
            </button>
            <button
              onClick={() => updateCounter("increment")}
              disabled={isLoading || !account}
              className="flex-1 bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/50 py-4 rounded-xl text-2xl font-bold transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed hover:shadow-[0_0_20px_rgba(34,197,94,0.3)]"
            >
              +
            </button>
          </div>

          {/* STATUS MESSAGES */}
          <div className="h-6 text-center">
            {isLoading && (
               <div className="flex items-center justify-center gap-2 text-yellow-400 text-sm animate-pulse">
                 <svg className="animate-spin h-4 w-4 text-yellow-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                   <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                   <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                 </svg>
                 {status}
               </div>
            )}
            {!isLoading && status && (
              <p className={`text-sm ${status.includes("Error") || status.includes("rejected") ? "text-red-400" : "text-green-400"}`}>
                {status}
              </p>
            )}
          </div>

        </div>
      </div>

      <div className="mt-12 text-gray-500 text-sm">
        Contract on Sepolia Testnet
      </div>
    </main>
  );
}