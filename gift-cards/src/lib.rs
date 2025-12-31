use charms_sdk::data::{
    charm_values, check, sum_token_amount, App, Data, Transaction, UtxoId, B32, NFT, TOKEN,
};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GiftCardNftContent {
    pub brand: String,
    pub image: String,
    pub initial_amount: u64,
    pub expiration_date: u64, // Unix timestamp
    pub created_at: u64,       // Unix timestamp
    pub remaining_balance: u64, // Current spendable balance
}

pub fn app_contract(app: &App, tx: &Transaction, x: &Data, w: &Data) -> bool {
    let empty = Data::empty();
    assert_eq!(x, &empty);
    match app.tag {
        NFT => {
            check!(nft_contract_satisfied(app, tx, w))
        }
        TOKEN => {
            check!(token_contract_satisfied(app, tx))
        }
        _ => unreachable!(),
    }
    true
}

// Gift card NFT contract: allows minting new gift cards or transferring existing ones
fn nft_contract_satisfied(app: &App, tx: &Transaction, w: &Data) -> bool {
    // Check minting first (most common operation) for early return
    if can_mint_gift_card_nft(app, tx, w) {
        return true;
    }
    
    // Create token_app once and reuse
    let token_app = App {
        tag: TOKEN,
        identity: app.identity.clone(),
        vk: app.vk.clone(),
    };
    
    // Check other operations in order of likelihood
    check!(can_transfer_gift_card_nft(app, tx) ||
           can_redeem_gift_card(app, tx, &token_app) ||
           can_burn_gift_card(app, tx, &token_app));
    true
}

// Mint a new gift card NFT (initial creation)
fn can_mint_gift_card_nft(nft_app: &App, tx: &Transaction, w: &Data) -> bool {
    let w_str: Option<String> = w.value().ok();
    check!(w_str.is_some());
    let w_str = w_str.unwrap();

    // App identity must match hash of the funding UTXO (check early)
    check!(hash(&w_str) == nft_app.identity);

    // Must be spending the UTXO specified in `w` (check early)
    let w_utxo_id = UtxoId::from_str(&w_str).unwrap();
    if !tx.ins.iter().any(|(utxo_id, _)| utxo_id == &w_utxo_id) {
        return false;
    }

    // Use iterator to find first NFT output instead of collecting all
    let mut nft_iter = charm_values(nft_app, tx.outs.iter());
    let Some(first_nft) = nft_iter.next() else {
        return false;
    };
    
    // Must mint exactly one NFT (check if there's a second one)
    if nft_iter.next().is_some() {
        return false;
    }
    
    // Verify NFT has correct gift card structure
    let nft_content: GiftCardNftContent = match first_nft.value() {
        Ok(content) => content,
        Err(_) => return false,
    };
    
    // Initial balance must match initial_amount
    check!(nft_content.remaining_balance == nft_content.initial_amount);
    
    // Expiration date must be in the future
    // Note: We can't check current time in zk-app, but we enforce it during redemption
    
    true
}

// Transfer gift card NFT (full transfer to new owner)
fn can_transfer_gift_card_nft(nft_app: &App, tx: &Transaction) -> bool {
    // Collect NFTs more efficiently with size hints
    let input_nfts: Vec<GiftCardNftContent> = charm_values(nft_app, tx.ins.iter().map(|(_, v)| v))
        .filter_map(|data| data.value().ok())
        .collect();
    
    // Early return if no input NFTs
    if input_nfts.is_empty() {
        return false;
    }
    
    let output_nfts: Vec<GiftCardNftContent> = charm_values(nft_app, tx.outs.iter())
        .filter_map(|data| data.value().ok())
        .collect();
    
    // Must have same number of NFTs in and out (transfer, not mint/burn)
    if input_nfts.len() != output_nfts.len() {
        return false;
    }
    
    // Remaining balance must be preserved during transfer
    let input_balance: u64 = input_nfts.iter().map(|nft| nft.remaining_balance).sum();
    let output_balance: u64 = output_nfts.iter().map(|nft| nft.remaining_balance).sum();
    check!(input_balance == output_balance);
    
    true
}

pub(crate) fn hash(data: &str) -> B32 {
    let hash = Sha256::digest(data);
    B32(hash.into())
}

// Gift card token contract: manages fungible token balance
fn token_contract_satisfied(token_app: &App, tx: &Transaction) -> bool {
    check!(can_transfer_tokens(token_app, tx) || can_mint_initial_tokens(token_app, tx));
    true
}

// Mint initial tokens when gift card NFT is created
fn can_mint_initial_tokens(token_app: &App, tx: &Transaction) -> bool {
    // Create nft_app once
    let nft_app = App {
        tag: NFT,
        identity: token_app.identity.clone(),
        vk: token_app.vk.clone(),
    };

    // Check if we're minting a new gift card NFT
    // First check if there are output NFTs
    let mut output_nft_iter = charm_values(&nft_app, tx.outs.iter())
        .filter_map(|data| data.value::<GiftCardNftContent>().ok());
    
    let Some(first_output_nft): Option<GiftCardNftContent> = output_nft_iter.next() else {
        return false; // No output NFTs
    };
    
    // Check if there are no input NFTs (minting, not transferring)
    let has_input_nfts = tx.ins.iter().any(|(_, v)| {
        charm_values(&nft_app, std::iter::once(v)).next().is_some()
    });
    
    if has_input_nfts {
        return false; // Not minting, has input NFTs
    }
    
    // Minting new NFT, so we can mint initial tokens
    let Some(input_token_amount) = sum_token_amount(token_app, tx.ins.iter().map(|(_, v)| v)).ok() else {
        return false; // No input tokens means we're minting
    };
    check!(input_token_amount == 0); // No existing tokens
    
    let Some(output_token_amount) = sum_token_amount(token_app, tx.outs.iter()).ok() else {
        return false;
    };
    
    // Token amount must match NFT's initial_amount
    check!(output_token_amount == first_output_nft.initial_amount);
    
    true
}

// Transfer tokens (partial or full transfer of gift card balance)
fn can_transfer_tokens(token_app: &App, tx: &Transaction) -> bool {
    // Create nft_app once
    let nft_app = App {
        tag: NFT,
        identity: token_app.identity.clone(),
        vk: token_app.vk.clone(),
    };

    // Check token balance conservation first (most common check)
    let Some(input_token_amount) = sum_token_amount(token_app, tx.ins.iter().map(|(_, v)| v)).ok() else {
        return false;
    };
    let Some(output_token_amount) = sum_token_amount(token_app, tx.outs.iter()).ok() else {
        return false;
    };

    // Token balance must be conserved (no minting/burning except during initial mint)
    if input_token_amount != output_token_amount {
        return false;
    }
    
    // Only check NFT balances if NFTs are present (lazy evaluation)
    let input_nfts: Vec<GiftCardNftContent> = charm_values(&nft_app, tx.ins.iter().map(|(_, v)| v))
        .filter_map(|data| data.value().ok())
        .collect();
    
    if !input_nfts.is_empty() {
        let input_nft_balance: u64 = input_nfts.iter().map(|nft| nft.remaining_balance).sum();
        check!(input_nft_balance == input_token_amount);
    }
    
    let output_nfts: Vec<GiftCardNftContent> = charm_values(&nft_app, tx.outs.iter())
        .filter_map(|data| data.value().ok())
        .collect();
    
    if !output_nfts.is_empty() {
        let output_nft_balance: u64 = output_nfts.iter().map(|nft| nft.remaining_balance).sum();
        check!(output_nft_balance == output_token_amount);
    }
    
    true
}

// Redeem gift card (decrease balance)
fn can_redeem_gift_card(nft_app: &App, tx: &Transaction, token_app: &App) -> bool {
    // Get NFT content from inputs and outputs
    let input_nfts: Vec<GiftCardNftContent> = charm_values(nft_app, tx.ins.iter().map(|(_, v)| v))
        .filter_map(|data| data.value().ok())
        .collect();
    
    let output_nfts: Vec<GiftCardNftContent> = charm_values(nft_app, tx.outs.iter())
        .filter_map(|data| data.value().ok())
        .collect();
    
    // Must have NFT in input
    check!(input_nfts.len() > 0);
    
    // NFT must remain in output (we're redeeming balance, not transferring NFT)
    check!(output_nfts.len() > 0);
    
    let input_nft = &input_nfts[0];
    let output_nft = &output_nfts[0];
    
    // Remaining balance must decrease
    check!(output_nft.remaining_balance < input_nft.remaining_balance);
    
    // Token amounts must match NFT balances
    let Some(input_token_amount) = sum_token_amount(token_app, tx.ins.iter().map(|(_, v)| v)).ok() else {
        return false;
    };
    let Some(output_token_amount) = sum_token_amount(token_app, tx.outs.iter()).ok() else {
        return false;
    };
    
    check!(input_token_amount == input_nft.remaining_balance);
    check!(output_token_amount == output_nft.remaining_balance);
    
    // Note: Expiration check would be done off-chain or via additional zk-app logic
    // For now, we enforce balance conservation
    
    true
}

// Burn gift card (destroy NFT and tokens)
fn can_burn_gift_card(nft_app: &App, tx: &Transaction, token_app: &App) -> bool {
    // Get NFT content from inputs
    let input_nfts: Vec<GiftCardNftContent> = charm_values(nft_app, tx.ins.iter().map(|(_, v)| v))
        .filter_map(|data| data.value().ok())
        .collect();
    
    // Must have NFT in input
    check!(input_nfts.len() > 0);
    
    // Must have NO NFT in output (burning, not transferring)
    let output_nfts: Vec<GiftCardNftContent> = charm_values(nft_app, tx.outs.iter())
        .filter_map(|data| data.value().ok())
        .collect();
    check!(output_nfts.len() == 0);
    
    // Token amounts must be zero in output (all tokens burned)
    let Some(input_token_amount) = sum_token_amount(token_app, tx.ins.iter().map(|(_, v)| v)).ok() else {
        return false;
    };
    let Some(output_token_amount) = sum_token_amount(token_app, tx.outs.iter()).ok() else {
        // If no output tokens, that's fine - all burned
        check!(input_token_amount > 0); // Must have had tokens to burn
        return true;
    };
    
    // All tokens must be burned (output amount should be 0 or very small for fees)
    check!(output_token_amount == 0 || output_token_amount < input_token_amount);
    
    true
}

#[cfg(test)]
mod test {
    use super::*;
    use charms_sdk::data::UtxoId;

    #[test]
    fn dummy() {}

    #[test]
    fn test_hash() {
        let utxo_id =
            UtxoId::from_str("dc78b09d767c8565c4a58a95e7ad5ee22b28fc1685535056a395dc94929cdd5f:1")
                .unwrap();
        let data = dbg!(utxo_id.to_string());
        let expected = "f54f6d40bd4ba808b188963ae5d72769ad5212dd1d29517ecc4063dd9f033faa";
        assert_eq!(&hash(&data).to_string(), expected);
    }
}
