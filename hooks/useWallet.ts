"use client";

import { useMemo } from "react";
import {
  ProviderNotFoundError,
  useConnect,
  useConnection,
  useConnectors,
  useDisconnect,
  useSwitchChain,
  useWalletClient,
} from "wagmi";
import { getWalletClient } from "@/lib/arkiv/client";
import { KAOLIN_CHAIN_ID } from "@/lib/arkiv/constants";
import type { WalletArkivClient } from "@arkiv-network/sdk";
import type { Account, Chain, Transport } from "viem";

const METAMASK_DOWNLOAD_URL = "https://metamask.io/download/";

function openMetaMaskDownload(): void {
  if (typeof window === "undefined") return;
  window.open(METAMASK_DOWNLOAD_URL, "_blank", "noopener,noreferrer");
}

function isProviderNotFoundError(error: unknown): boolean {
  if (error instanceof ProviderNotFoundError) return true;
  if (
    error instanceof Error &&
    error.message.toLowerCase().includes("provider not found")
  ) {
    return true;
  }
  if (typeof error === "object" && error !== null && "cause" in error) {
    return isProviderNotFoundError((error as { cause?: unknown }).cause);
  }
  return false;
}

export interface UseWalletReturn {

  address: `0x${string}` | undefined;

  isConnected: boolean;

  isConnecting: boolean;

  walletClient: WalletArkivClient<Transport, Chain, Account> | null;

  connect: () => void;

  disconnect: () => void;

  isCorrectChain: boolean;

  switchToKaolin: () => void;
}

export function useWallet(): UseWalletReturn {

  const { address, isConnected, chainId } = useConnection();

  const { data: wagmiWalletClient } = useWalletClient();

  const connectors = useConnectors();

  const { mutate: connectMutate, isPending: isConnecting } = useConnect();

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

  const connect = () => {
    const connector = connectors.find((item) => item.id === "metaMask") ?? connectors[0];
    if (!connector) {
      openMetaMaskDownload();
      return;
    }

    connectMutate(
      { connector },
      {
        onError: (error) => {
          if (isProviderNotFoundError(error)) {
            openMetaMaskDownload();
          }
        },
      },
    );
  };

  const disconnect = () => disconnectMutate({});

  const switchToKaolin = () => switchChain({ chainId: KAOLIN_CHAIN_ID });

  return {
    address,
    isConnected,
    isConnecting,
    walletClient,
    connect,
    disconnect,
    isCorrectChain,
    switchToKaolin,
  };
}
