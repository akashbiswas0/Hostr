"use client";

import { useMemo } from "react";
import {
  useConnection,
  useDisconnect,
  useSwitchChain,
  useWalletClient,
} from "wagmi";
import { useModal } from "connectkit";
import { getWalletClient } from "@/lib/arkiv/client";
import { KAOLIN_CHAIN_ID } from "@/lib/arkiv/constants";
import type { WalletArkivClient } from "@arkiv-network/sdk";
import type { Account, Chain, Transport } from "viem";

export interface UseWalletReturn {
  
  address: `0x${string}` | undefined;
  
  isConnected: boolean;
  

  walletClient: WalletArkivClient<Transport, Chain, Account> | null;
  
  connect: () => void;
  
  disconnect: () => void;
  
  isCorrectChain: boolean;
  
  switchToKaolin: () => void;
}

export function useWallet(): UseWalletReturn {
  
  const { address, isConnected, chainId } = useConnection();

  
  
  const { data: wagmiWalletClient } = useWalletClient();

  
  const { setOpen } = useModal();

  
  const { mutate: switchChain } = useSwitchChain();

  
  const { mutate: disconnectMutate } = useDisconnect();

  
  
  
  
  
  
  const walletClient = useMemo<WalletArkivClient<
    Transport,
    Chain,
    Account
  > | null>(() => {
    if (!wagmiWalletClient?.account) return null;
    return getWalletClient(
      wagmiWalletClient.account as Account,
      wagmiWalletClient,
    ) as WalletArkivClient<Transport, Chain, Account>;
  }, [wagmiWalletClient]);

  
  const isCorrectChain = isConnected && chainId === KAOLIN_CHAIN_ID;

  
  const connect = () => setOpen(true);

  const disconnect = () => disconnectMutate({});

  const switchToKaolin = () =>
    switchChain({ chainId: KAOLIN_CHAIN_ID as unknown as never });

  return {
    address,
    isConnected,
    walletClient,
    connect,
    disconnect,
    isCorrectChain,
    switchToKaolin,
  };
}
