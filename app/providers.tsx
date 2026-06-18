"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import { AGENTMINT_ADDRESS, OG_CHAIN_ID, OG_RPC_URL } from "@/lib/contract";

type WalletState = {
  hasProvider: boolean;
  address: string | null;
  chainId: number | null;
  isConnecting: boolean;
  error: string | null;
};

type WalletContextValue = WalletState & {
  connect: () => Promise<void>;
  disconnect: () => void;
  getProvider: () => Promise<ethers.BrowserProvider | null>;
  getSigner: () => Promise<ethers.Signer | null>;
  ensureCorrectChain: () => Promise<boolean>;
  shortAddress: string;
};

const WalletContext = createContext<WalletContextValue | null>(null);

declare global {
  interface Window {
    ethereum?: any;
  }
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<WalletState>({
    hasProvider: typeof window !== "undefined" && !!window.ethereum,
    address: null,
    chainId: null,
    isConnecting: false,
    error: null,
  });

  const updateFromEthereum = useCallback(async () => {
    if (typeof window === "undefined" || !window.ethereum) return;
    try {
      const accounts: string[] = await window.ethereum.request({ method: "eth_accounts" });
      const chainHex: string = await window.ethereum.request({ method: "eth_chainId" });
      const chainId = chainHex ? parseInt(chainHex, 16) : null;
      setState((s) => ({
        ...s,
        hasProvider: true,
        address: accounts && accounts[0] ? accounts[0] : null,
        chainId,
      }));
    } catch (e: any) {
      setState((s) => ({ ...s, error: e.message }));
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    updateFromEthereum();
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      setState((s) => ({
        ...s,
        address: accounts && accounts[0] ? accounts[0] : null,
      }));
    };
    const handleChainChanged = (chainHex: string) => {
      setState((s) => ({ ...s, chainId: parseInt(chainHex, 16) }));
    };
    window.ethereum.on?.("accountsChanged", handleAccountsChanged);
    window.ethereum.on?.("chainChanged", handleChainChanged);
    return () => {
      window.ethereum.removeListener?.("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener?.("chainChanged", handleChainChanged);
    };
  }, [updateFromEthereum]);

  const connect = useCallback(async () => {
    if (typeof window === "undefined" || !window.ethereum) {
      setState((s) => ({ ...s, error: "No injected wallet detected. Install MetaMask." }));
      return;
    }
    setState((s) => ({ ...s, isConnecting: true, error: null }));
    try {
      const accounts: string[] = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      const chainHex: string = await window.ethereum.request({ method: "eth_chainId" });
      setState((s) => ({
        ...s,
        address: accounts?.[0] ?? null,
        chainId: chainHex ? parseInt(chainHex, 16) : null,
        isConnecting: false,
        error: null,
      }));
    } catch (e: any) {
      setState((s) => ({ ...s, isConnecting: false, error: e?.message || "Wallet connect failed" }));
    }
  }, []);

  const disconnect = useCallback(() => {
    setState((s) => ({ ...s, address: null }));
  }, []);

  const getProvider = useCallback(async () => {
    if (typeof window === "undefined" || !window.ethereum) return null;
    return new ethers.BrowserProvider(window.ethereum, "any");
  }, []);

  const getSigner = useCallback(async () => {
    const provider = await getProvider();
    if (!provider) return null;
    return provider.getSigner();
  }, [getProvider]);

  const ensureCorrectChain = useCallback(async () => {
    if (typeof window === "undefined" || !window.ethereum) return false;
    const currentHex: string = await window.ethereum.request({ method: "eth_chainId" });
    const currentId = parseInt(currentHex, 16);
    if (currentId === OG_CHAIN_ID) return true;
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${OG_CHAIN_ID.toString(16)}` }],
      });
      return true;
    } catch (e: any) {
      // 4902 = chain not added; try to add
      if (e?.code === 4902 || /Unrecognized chain/i.test(e?.message || "")) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: `0x${OG_CHAIN_ID.toString(16)}`,
                chainName: "0G-Galileo-Testnet",
                nativeCurrency: { name: "0G", symbol: "0G", decimals: 18 },
                rpcUrls: [OG_RPC_URL],
                blockExplorerUrls: ["https://chainscan-galileo.0g.ai"],
              },
            ],
          });
          return true;
        } catch (addErr: any) {
          setState((s) => ({ ...s, error: `Add chain failed: ${addErr.message}` }));
          return false;
        }
      }
      setState((s) => ({ ...s, error: `Switch chain failed: ${e.message}` }));
      return false;
    }
  }, []);

  const shortAddress = useMemo(() => {
    if (!state.address) return "";
    return `${state.address.slice(0, 6)}…${state.address.slice(-4)}`;
  }, [state.address]);

  const value: WalletContextValue = {
    ...state,
    connect,
    disconnect,
    getProvider,
    getSigner,
    ensureCorrectChain,
    shortAddress,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}

export const AGENTMINT_ADDRESS_EXPORT = AGENTMINT_ADDRESS;
