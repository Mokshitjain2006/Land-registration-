import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ethers } from "ethers";
import { toast } from "sonner";
import {
  fetchAppConfig,
  fetchBlockchainEvents,
  fetchHardhatRpcAccounts,
  fetchProperties,
  recordActivity,
  type ConfigResponse,
} from "../services/api";
import {
  deriveUserRole,
  type BlockchainEventItem,
  type PropertyRecord,
  type UserRole,
} from "../utils/registry";

declare global {
  interface Window {
    ethereum?: {
      isMetaMask?: boolean;
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on?: (event: string, listener: (...args: unknown[]) => void) => void;
      removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
    };
  }
}

export type WalletConnectionMode = "metamask" | "hardhat-node" | null;

export interface RegisterLandPayload {
  propertyId: number;
  ownerAddress: string;
  location: string;
  village: string;
  district: string;
  state: string;
  surveyNumber: string;
  area: number;
  documentHash: string;
}

interface WalletContextValue {
  account: string | null;
  connectionMode: WalletConnectionMode;
  chainId: number | null;
  role: UserRole;
  isAdmin: boolean;
  hasMetaMask: boolean;
  isWrongNetwork: boolean;
  config: ConfigResponse | null;
  properties: PropertyRecord[];
  events: BlockchainEventItem[];
  hardhatAccounts: string[];
  loadingData: boolean;
  txPending: boolean;
  walletModalOpen: boolean;
  setWalletModalOpen: (open: boolean) => void;
  connectMetaMask: () => Promise<void>;
  connectHardhatAccount: (address: string) => Promise<void>;
  switchToLocalNetwork: () => Promise<void>;
  disconnectWallet: () => void;
  refreshRegistry: () => Promise<void>;
  registerLandOnChain: (payload: RegisterLandPayload) => Promise<string>;
  requestTransferOnChain: (propertyId: number, proposedOwner: string) => Promise<string>;
  acceptTransferOnChain: (propertyId: number) => Promise<string>;
  approveTransferOnChain: (propertyId: number) => Promise<string>;
  rejectTransferOnChain: (propertyId: number) => Promise<string>;
  cancelTransferOnChain: (propertyId: number) => Promise<string>;
  verifyDocumentOnChain: (
    propertyId: number,
    documentHash: string
  ) => Promise<{
    exists: boolean;
    documentMatches: boolean;
    currentOwner: string;
    registeredAt: number;
  }>;
}

const WalletContext = createContext<WalletContextValue | null>(null);

const LOCAL_CHAIN_ID = 31337;
const LOCAL_CHAIN_HEX = "0x7a69";
const HARDHAT_SESSION_KEY = "landchain_hardhat_account";

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<string | null>(null);
  const [connectionMode, setConnectionMode] = useState<WalletConnectionMode>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [config, setConfig] = useState<ConfigResponse | null>(null);
  const [properties, setProperties] = useState<PropertyRecord[]>([]);
  const [events, setEvents] = useState<BlockchainEventItem[]>([]);
  const [hardhatAccounts, setHardhatAccounts] = useState<string[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [txPending, setTxPending] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);

  const hasRestoredSessionRef = useRef(false);

  const hasMetaMask = typeof window !== "undefined" && Boolean(window.ethereum);

  const refreshRegistry = useCallback(async () => {
    setLoadingData(true);
    try {
      const [cfg, props, evs, hhAccounts] = await Promise.all([
        fetchAppConfig(),
        fetchProperties(),
        fetchBlockchainEvents(),
        fetchHardhatRpcAccounts(),
      ]);
      setConfig(cfg);
      setProperties(props);
      setEvents(evs);
      setHardhatAccounts(hhAccounts);

      if (typeof window !== "undefined" && !hasRestoredSessionRef.current) {
        hasRestoredSessionRef.current = true;
        const saved = window.sessionStorage.getItem(HARDHAT_SESSION_KEY);
        if (saved) {
          const matched = hhAccounts.find(
            (addr) => addr.toLowerCase() === saved.toLowerCase()
          );
          if (matched) {
            setAccount(ethers.getAddress(matched));
            setChainId(LOCAL_CHAIN_ID);
            setConnectionMode("hardhat-node");
          } else {
            window.sessionStorage.removeItem(HARDHAT_SESSION_KEY);
          }
        }
      }
    } catch (err) {
      console.error("Registry refresh error:", err);
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    refreshRegistry();
  }, [refreshRegistry]);

  // Listen to MetaMask account & network changes
  useEffect(() => {
    const eth = window.ethereum;
    if (!eth?.on) return;

    const handleAccountsChanged = (accounts: unknown) => {
      if (connectionMode !== "metamask") return;
      const list = Array.isArray(accounts) ? (accounts as string[]) : [];
      if (list.length === 0) {
        setAccount(null);
        setConnectionMode(null);
      } else {
        setAccount(ethers.getAddress(list[0]));
      }
    };

    const handleChainChanged = (hexChainId: unknown) => {
      if (connectionMode !== "metamask") return;
      if (typeof hexChainId === "string") {
        setChainId(parseInt(hexChainId, 16));
      }
    };

    eth.on("accountsChanged", handleAccountsChanged);
    eth.on("chainChanged", handleChainChanged);
    return () => {
      eth.removeListener?.("accountsChanged", handleAccountsChanged);
      eth.removeListener?.("chainChanged", handleChainChanged);
    };
  }, [connectionMode]);

  const switchToLocalNetwork = useCallback(async () => {
    if (!window.ethereum) {
      toast.error("MetaMask extension was not detected in this browser.");
      return;
    }
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: LOCAL_CHAIN_HEX }],
      });
      setChainId(LOCAL_CHAIN_ID);
      toast.success("Switched to Hardhat Local Network (Chain ID 31337)");
    } catch (switchErr: unknown) {
      const errCode = (switchErr as { code?: number })?.code;
      if (errCode === 4902) {
        const rpcEndpoint =
          window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
            ? "http://127.0.0.1:8545"
            : `${window.location.origin}/api/rpc`;
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: LOCAL_CHAIN_HEX,
              chainName: "LandChain Hardhat (31337)",
              rpcUrls: [rpcEndpoint],
              nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
            },
          ],
        });
        setChainId(LOCAL_CHAIN_ID);
        toast.success("Added and switched to Hardhat Local Network (31337)");
      } else {
        toast.error("Could not switch MetaMask network automatically.");
      }
    }
  }, []);

  const connectMetaMask = useCallback(async () => {
    if (!window.ethereum) {
      toast.error("MetaMask extension not detected. Select a Local Hardhat account below or install MetaMask.");
      return;
    }
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = (await provider.send("eth_requestAccounts", [])) as string[];
      if (!accounts.length) {
        toast.error("No wallet accounts selected in MetaMask.");
        return;
      }
      const network = await provider.getNetwork();
      const addr = ethers.getAddress(accounts[0]);
      setAccount(addr);
      setChainId(Number(network.chainId));
      setConnectionMode("metamask");
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(HARDHAT_SESSION_KEY);
      }
      setWalletModalOpen(false);
      await recordActivity(addr, "WALLET_CONNECTED", "Connected via MetaMask");
      toast.success(`Wallet connected: ${addr.slice(0, 6)}...${addr.slice(-4)}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "MetaMask connection cancelled");
    }
  }, []);

  const connectHardhatAccount = useCallback(async (address: string) => {
    try {
      const checksummed = ethers.getAddress(address);
      setAccount(checksummed);
      setChainId(LOCAL_CHAIN_ID);
      setConnectionMode("hardhat-node");
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(HARDHAT_SESSION_KEY, checksummed);
      }
      setWalletModalOpen(false);
      await recordActivity(checksummed, "WALLET_CONNECTED", "Connected via Local Hardhat Node RPC");
      toast.success(`Connected local node account ${checksummed.slice(0, 6)}...${checksummed.slice(-4)}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to connect Hardhat node account");
    }
  }, []);

  const disconnectWallet = useCallback(() => {
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(HARDHAT_SESSION_KEY);
    }
    setAccount(null);
    setConnectionMode(null);
    setChainId(null);
    toast.info("Wallet disconnected");
  }, []);

  const getWriteContract = useCallback(async () => {
    if (!account || !connectionMode) {
      throw new Error("Please connect your wallet before submitting a transaction.");
    }
    if (!config?.contractAddress || !config?.abi?.length) {
      throw new Error("LandRegistry smart contract is not deployed yet.");
    }

    if (connectionMode === "metamask") {
      if (!window.ethereum) throw new Error("MetaMask provider unavailable.");
      const provider = new ethers.BrowserProvider(window.ethereum);
      const network = await provider.getNetwork();
      if (Number(network.chainId) !== LOCAL_CHAIN_ID) {
        throw new Error(`Wrong network (${Number(network.chainId)}). Switch MetaMask to Hardhat Local (31337).`);
      }
      const signer = await provider.getSigner();
      return new ethers.Contract(
        config.contractAddress,
        config.abi as ethers.InterfaceAbi,
        signer
      );
    }

    const rpcUrl = `${window.location.origin}/api/rpc`;
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const signer = await provider.getSigner(account);
    return new ethers.Contract(
      config.contractAddress,
      config.abi as ethers.InterfaceAbi,
      signer
    );
  }, [account, connectionMode, config]);

  const getReadContract = useCallback(() => {
    if (!config?.contractAddress || !config?.abi?.length) {
      throw new Error("Smart contract not deployed.");
    }
    const rpcUrl = `${window.location.origin}/api/rpc`;
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    return new ethers.Contract(
      config.contractAddress,
      config.abi as ethers.InterfaceAbi,
      provider
    );
  }, [config]);

  const parseContractError = (err: unknown): string => {
    const raw = err instanceof Error ? err.message : String(err);
    const reasonMatch = raw.match(/reason="([^"]+)"/) || raw.match(/reverted with reason string '([^']+)'/);
    if (reasonMatch) return reasonMatch[1];
    if (raw.includes("user rejected")) return "Transaction rejected in wallet.";
    if (raw.includes("Only registry admin")) return "Only the registry admin wallet can perform this action.";
    return raw.length > 180 ? `${raw.slice(0, 180)}...` : raw;
  };

  const executeTx = useCallback(
    async (
      actionName: string,
      fn: (contract: ethers.Contract) => Promise<ethers.TransactionResponse>,
      details?: string
    ): Promise<string> => {
      setTxPending(true);
      try {
        const contract = await getWriteContract();
        const tx = await fn(contract);
        const receipt = await tx.wait();
        const txHash = receipt?.hash || tx.hash;
        if (account) {
          await recordActivity(account, actionName, details || txHash);
        }
        await refreshRegistry();
        return txHash;
      } catch (err) {
        throw new Error(parseContractError(err));
      } finally {
        setTxPending(false);
      }
    },
    [getWriteContract, account, refreshRegistry]
  );

  const registerLandOnChain = useCallback(
    async (payload: RegisterLandPayload) => {
      return executeTx(
        "LAND_REGISTERED",
        (contract) =>
          contract.registerLand(
            payload.propertyId,
            payload.ownerAddress,
            payload.location,
            payload.village,
            payload.district,
            payload.state,
            payload.surveyNumber,
            payload.area,
            payload.documentHash
          ),
        `Property #${payload.propertyId}`
      );
    },
    [executeTx]
  );

  const requestTransferOnChain = useCallback(
    async (propertyId: number, proposedOwner: string) => {
      return executeTx(
        "TRANSFER_REQUESTED",
        (contract) => contract.requestTransfer(propertyId, proposedOwner),
        `Property #${propertyId} -> ${proposedOwner}`
      );
    },
    [executeTx]
  );

  const acceptTransferOnChain = useCallback(
    async (propertyId: number) => {
      return executeTx(
        "TRANSFER_ACCEPTED",
        (contract) => contract.acceptTransfer(propertyId),
        `Property #${propertyId}`
      );
    },
    [executeTx]
  );

  const approveTransferOnChain = useCallback(
    async (propertyId: number) => {
      return executeTx(
        "TRANSFER_APPROVED",
        (contract) => contract.approveTransfer(propertyId),
        `Property #${propertyId}`
      );
    },
    [executeTx]
  );

  const rejectTransferOnChain = useCallback(
    async (propertyId: number) => {
      return executeTx(
        "TRANSFER_REJECTED",
        (contract) => contract.rejectTransfer(propertyId),
        `Property #${propertyId}`
      );
    },
    [executeTx]
  );

  const cancelTransferOnChain = useCallback(
    async (propertyId: number) => {
      return executeTx(
        "TRANSFER_CANCELLED",
        (contract) => contract.cancelTransfer(propertyId),
        `Property #${propertyId}`
      );
    },
    [executeTx]
  );

  const verifyDocumentOnChain = useCallback(
    async (propertyId: number, documentHash: string) => {
      const contract = getReadContract();
      const [exists, documentMatches, currentOwner, registeredAt] =
        await contract.verifyLand(propertyId, documentHash);
      return {
        exists: Boolean(exists),
        documentMatches: Boolean(documentMatches),
        currentOwner: String(currentOwner),
        registeredAt: Number(registeredAt),
      };
    },
    [getReadContract]
  );

  const role = useMemo(
    () => deriveUserRole(account, config?.adminAddress || null, properties),
    [account, config?.adminAddress, properties]
  );

  const isAdmin = role === "ADMIN";
  const isWrongNetwork =
    connectionMode === "metamask" && chainId !== null && chainId !== LOCAL_CHAIN_ID;

  const value: WalletContextValue = {
    account,
    connectionMode,
    chainId,
    role,
    isAdmin,
    hasMetaMask,
    isWrongNetwork,
    config,
    properties,
    events,
    hardhatAccounts,
    loadingData,
    txPending,
    walletModalOpen,
    setWalletModalOpen,
    connectMetaMask,
    connectHardhatAccount,
    switchToLocalNetwork,
    disconnectWallet,
    refreshRegistry,
    registerLandOnChain,
    requestTransferOnChain,
    acceptTransferOnChain,
    approveTransferOnChain,
    rejectTransferOnChain,
    cancelTransferOnChain,
    verifyDocumentOnChain,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside WalletProvider");
  return ctx;
}
