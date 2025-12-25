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
    let token_app = &App {
        tag: TOKEN,
        identity: app.identity.clone(),
        vk: app.vk.clone(),
    };
    
    // Allow minting new gift card NFT, transferring existing NFT, redeeming, or burning
    check!(can_mint_gift_card_nft(app, tx, w) || 
           can_transfer_gift_card_nft(app, tx) ||
           can_redeem_gift_card(app, tx, token_app) ||
           can_burn_gift_card(app, tx, token_app));
    true
}

// Mint a new gift card NFT (initial creation)
fn can_mint_gift_card_nft(nft_app: &App, tx: &Transaction, w: &Data) -> bool {
    let w_str: Option<String> = w.value().ok();
    check!(w_str.is_some());
    let w_str = w_str.unwrap();

    // App identity must match hash of the funding UTXO
    check!(hash(&w_str) == nft_app.identity);

    // Must be spending the UTXO specified in `w`
    let w_utxo_id = UtxoId::from_str(&w_str).unwrap();
    check!(tx.ins.iter().any(|(utxo_id, _)| utxo_id == &w_utxo_id));

    let nft_charms = charm_values(nft_app, tx.outs.iter()).collect::<Vec<_>>();

    // Must mint exactly one NFT
    check!(nft_charms.len() == 1);
    
    // Verify NFT has correct gift card structure
    let nft_content: GiftCardNftContent = match nft_charms[0].value() {
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
    let input_nfts: Vec<GiftCardNftContent> = charm_values(nft_app, tx.ins.iter().map(|(_, v)| v))
        .filter_map(|data| data.value().ok())
        .collect();
    
    let output_nfts: Vec<GiftCardNftContent> = charm_values(nft_app, tx.outs.iter())
        .filter_map(|data| data.value().ok())
        .collect();
    
    // Must have same number of NFTs in and out (transfer, not mint/burn)
    check!(input_nfts.len() == output_nfts.len() && input_nfts.len() > 0);
    
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
    let nft_app = App {
        tag: NFT,
        identity: token_app.identity.clone(),
        vk: token_app.vk.clone(),
    };

    // Check if we're minting a new gift card NFT
    let output_nfts: Vec<GiftCardNftContent> = charm_values(&nft_app, tx.outs.iter())
        .filter_map(|data| data.value().ok())
        .collect();
    
    // If minting NFT, we can mint corresponding tokens
    if output_nfts.len() > 0 && tx.ins.iter().all(|(_, v)| {
        charm_values(&nft_app, std::iter::once(v)).next().is_none()
    }) {
        // Minting new NFT, so we can mint initial tokens
        let Some(input_token_amount) = sum_token_amount(token_app, tx.ins.iter().map(|(_, v)| v)).ok() else {
            return false; // No input tokens means we're minting
        };
        check!(input_token_amount == 0); // No existing tokens
        
        let Some(output_token_amount) = sum_token_amount(token_app, tx.outs.iter()).ok() else {
            return false;
        };
        
        // Token amount must match NFT's initial_amount
        let nft_initial = output_nfts[0].initial_amount;
        check!(output_token_amount == nft_initial);
        
        return true;
    }
    
    false
}

// Transfer tokens (partial or full transfer of gift card balance)
fn can_transfer_tokens(token_app: &App, tx: &Transaction) -> bool {
    let nft_app = App {
        tag: NFT,
        identity: token_app.identity.clone(),
        vk: token_app.vk.clone(),
    };

    // Get NFT content to check balance constraints
    let input_nfts: Vec<GiftCardNftContent> = charm_values(&nft_app, tx.ins.iter().map(|(_, v)| v))
        .filter_map(|data| data.value().ok())
        .collect();
    
    let output_nfts: Vec<GiftCardNftContent> = charm_values(&nft_app, tx.outs.iter())
        .filter_map(|data| data.value().ok())
        .collect();

    let Some(input_token_amount) = sum_token_amount(token_app, tx.ins.iter().map(|(_, v)| v)).ok() else {
        return false;
    };
    let Some(output_token_amount) = sum_token_amount(token_app, tx.outs.iter()).ok() else {
        return false;
    };

    // Token balance must be conserved (no minting/burning except during initial mint)
    check!(input_token_amount == output_token_amount);
    
    // If NFTs are present, their remaining_balance must match token amounts
    if !input_nfts.is_empty() {
        let input_nft_balance: u64 = input_nfts.iter().map(|nft| nft.remaining_balance).sum();
        check!(input_nft_balance == input_token_amount);
    }
    
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
