/**
 * Charms Protocol TypeScript Types
 * Based on Spell JSON Reference: https://docs.charms.dev/references/spell-json/
 */

export interface SpellApp {
  app_id: string;
  app_vk: string;
}

export interface SpellInput {
  utxo_id: string;
  charms: Record<string, any>;
}

export interface SpellOutput {
  address: string;
  charms: Record<string, any>;
}

export interface Spell {
  version: number;
  apps: Record<string, string>; // Format: "$00": "n/<app_id>/<app_vk>" or "t/<app_id>/<app_vk>"
  public_inputs?: Record<string, any>; // Optional public inputs for app contract execution
  private_inputs?: Record<string, string>; // Optional private inputs (e.g., funding UTXO for minting)
  ins: SpellInput[];
  outs: SpellOutput[];
}

export interface GiftCardNftMetadata {
  brand: string;
  image: string;
  initial_amount: number;
  expiration_date: number; // Unix timestamp
  created_at: number; // Unix timestamp
  remaining_balance: number;
}

export interface GiftCardMintParams {
  inUtxo: string;
  recipientAddress: string;
  brand: string;
  image: string;
  initialAmount: number;
  expirationDate?: number; // Unix timestamp, defaults to 1 year from now
}

export interface GiftCardTransferParams {
  inUtxo: string;
  senderAddress: string;
  recipientAddress: string;
  transferAmount: number;
  currentBalance: number;
  nftMetadata: GiftCardNftMetadata;
}

export interface GiftCardRedeemParams {
  inUtxo: string;
  userAddress: string;
  redeemAmount: number;
  currentBalance: number;
  nftMetadata: GiftCardNftMetadata;
}

export interface CharmsAsset {
  type: 'nft' | 'token';
  app_id: string;
  app_vk: string;
  data?: GiftCardNftMetadata;
  amount?: number; // For tokens
  utxoId?: string; // UTXO ID in format "txid:vout"
}

export interface WalletCharms {
  address: string;
  nfts: CharmsAsset[];
  tokens: CharmsAsset[];
}

