# @x402-solana/client Architecture

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    User Application                         │
│                                                              │
│  const client = new X402Client({ ... });                    │
│  const response = await client.fetch(url);                  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                     X402Client                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ fetch(url, options)                                   │  │
│  │  ├─ Try request                                       │  │
│  │  ├─ If 402: create payment                           │  │
│  │  ├─ Retry with X-PAYMENT header                      │  │
│  │  └─ Return response                                   │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  Helper Methods:                                            │
│  - getUSDCBalance()                                         │
│  - getSOLBalance()                                          │
│  - getPublicKey()                                           │
│  - getUSDCMint()                                            │
└──────────────────────┬──────────────────────────────────────┘
                       │
         ┌─────────────┴─────────────┐
         │                           │
         ▼                           ▼
┌──────────────────┐        ┌──────────────────┐
│  PaymentSender   │        │  WalletManager   │
│                  │        │                  │
│ - sendUSDC()     │        │ - generateWallet │
│ - estimateCost() │        │ - airdropSOL     │
│ - checkBalance() │        │ - validateKeys   │
└────────┬─────────┘        └──────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│               Solana Blockchain (via RPC)                    │
│                                                              │
│  ┌───────────────┐  ┌───────────────┐  ┌─────────────────┐ │
│  │ SPL Token     │  │ Token Account │  │ USDC Mint       │ │
│  │ Program       │  │               │  │                 │ │
│  └───────────────┘  └───────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Payment Flow Sequence

```
User App          X402Client         PaymentSender      Solana RPC        API Server
   │                  │                    │                 │                │
   │ fetch(url)       │                    │                 │                │
   ├─────────────────>│                    │                 │                │
   │                  │                    │                 │                │
   │                  │ GET /api/data      │                 │                │
   │                  ├────────────────────────────────────────────────────>│
   │                  │                    │                 │                │
   │                  │ 402 Payment Required                 │                │
   │                  │<────────────────────────────────────────────────────┤
   │                  │ {accepts: [...]}   │                 │                │
   │                  │                    │                 │                │
   │                  │ Validate payment   │                 │                │
   │                  │ requirements       │                 │                │
   │                  │                    │                 │                │
   │                  │ getTokenBalance()  │                 │                │
   │                  ├──────────────────────────────────────>│                │
   │                  │<──────────────────────────────────────┤                │
   │                  │ balance: 5 USDC    │                 │                │
   │                  │                    │                 │                │
   │                  │ createPayment()    │                 │                │
   │                  ├───────────────────>│                 │                │
   │                  │                    │                 │                │
   │                  │                    │ createTransfer  │                │
   │                  │                    │ instruction     │                │
   │                  │                    │                 │                │
   │                  │                    │ sendTransaction │                │
   │                  │                    ├────────────────>│                │
   │                  │                    │<────────────────┤                │
   │                  │                    │ signature       │                │
   │                  │                    │                 │                │
   │                  │                    │ confirmTx()     │                │
   │                  │                    ├────────────────>│                │
   │                  │                    │<────────────────┤                │
   │                  │                    │ confirmed       │                │
   │                  │                    │                 │                │
   │                  │<───────────────────┤                 │                │
   │                  │ signature          │                 │                │
   │                  │                    │                 │                │
   │                  │ Encode payment     │                 │                │
   │                  │ proof (base64)     │                 │                │
   │                  │                    │                 │                │
   │                  │ GET /api/data      │                 │                │
   │                  │ X-PAYMENT: proof   │                 │                │
   │                  ├────────────────────────────────────────────────────>│
   │                  │                    │                 │                │
   │                  │ 200 OK {data}      │                 │                │
   │                  │<────────────────────────────────────────────────────┤
   │                  │                    │                 │                │
   │<─────────────────┤                    │                 │                │
   │ response         │                    │                 │                │
```

## Component Interactions

```
┌──────────────────────────────────────────────────────────────┐
│                        X402Client                            │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              Private Methods                           │ │
│  │                                                        │ │
│  │  createPayment(paymentReq)                            │ │
│  │  ├─ Parse payment requirements                        │ │
│  │  ├─ Get sender token account                          │ │
│  │  ├─ Check balance                                     │ │
│  │  ├─ Create transfer instruction                       │ │
│  │  ├─ Build transaction                                 │ │
│  │  ├─ Sign transaction                                  │ │
│  │  ├─ Send transaction                                  │ │
│  │  └─ Wait for confirmation                             │ │
│  │                                                        │ │
│  │  validatePaymentRequirements(paymentReq)              │ │
│  │  ├─ Check accepts array                               │ │
│  │  ├─ Validate scheme (solana-usdc)                     │ │
│  │  ├─ Check network match                               │ │
│  │  └─ Validate USDC mint                                │ │
│  │                                                        │ │
│  │  encodePayment(signature, paymentReq)                 │ │
│  │  ├─ Build payment proof object                        │ │
│  │  ├─ JSON stringify                                    │ │
│  │  └─ Base64 encode                                     │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              State Management                          │ │
│  │                                                        │ │
│  │  - connection: Connection                             │ │
│  │  - wallet: Keypair                                    │ │
│  │  - network: 'devnet' | 'mainnet-beta'                 │ │
│  │  - autoRetry: boolean                                 │ │
│  │  - maxRetries: number                                 │ │
│  │  - commitment: CommitmentLevel                        │ │
│  │  - debug: boolean                                     │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                   Payment Requirements                       │
│                   (from 402 response)                        │
│                                                              │
│  {                                                           │
│    x402Version: 1,                                           │
│    error: "Payment required",                                │
│    accepts: [{                                               │
│      scheme: "solana-usdc",                                  │
│      network: "devnet",                                      │
│      maxAmountRequired: "500000",  // micro-USDC            │
│      resource: "/api/data",                                  │
│      description: "API access",                              │
│      payTo: {                                                │
│        address: "recipient-token-account",                   │
│        asset: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"│
│      },                                                      │
│      timeout: 300                                            │
│    }]                                                        │
│  }                                                           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                   Payment Processing                         │
│                                                              │
│  1. Validate requirements                                    │
│     └─ Check scheme, network, mint                          │
│                                                              │
│  2. Check balance                                            │
│     └─ Ensure sufficient USDC + SOL for fees                │
│                                                              │
│  3. Create transaction                                       │
│     └─ SPL token transfer instruction                       │
│                                                              │
│  4. Submit to blockchain                                     │
│     └─ Wait for confirmation                                │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                   Payment Proof                              │
│                   (for X-PAYMENT header)                     │
│                                                              │
│  Base64-encoded JSON:                                        │
│  {                                                           │
│    x402Version: 1,                                           │
│    scheme: "solana-usdc",                                    │
│    network: "devnet",                                        │
│    payload: {                                                │
│      signature: "5k2j3h4g5h6j7k8..."  // Solana tx sig     │
│    }                                                         │
│  }                                                           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                   Request Retry                              │
│                                                              │
│  GET /api/data                                               │
│  Headers:                                                    │
│    X-PAYMENT: eyJ4NDAyVmVyc2lvbiI6MSwic2NoZW1lIjoi...      │
│    Content-Type: application/json                            │
│    ...                                                       │
└─────────────────────────────────────────────────────────────┘
```

## Error Handling Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Error Categories                          │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Payment Errors (PaymentError)                      │    │
│  │                                                      │    │
│  │  INSUFFICIENT_BALANCE                                │    │
│  │  ├─ Check USDC balance                               │    │
│  │  ├─ Check SOL balance                                │    │
│  │  └─ Provide balance details                          │    │
│  │                                                      │    │
│  │  TRANSACTION_FAILED                                  │    │
│  │  ├─ Transaction simulation failed                    │    │
│  │  ├─ Transaction rejected on-chain                    │    │
│  │  └─ Provide transaction error                        │    │
│  │                                                      │    │
│  │  INVALID_PAYMENT_REQUIREMENTS                        │    │
│  │  ├─ Malformed 402 response                           │    │
│  │  ├─ Invalid payment scheme                           │    │
│  │  └─ Network mismatch                                 │    │
│  │                                                      │    │
│  │  NETWORK_ERROR                                       │    │
│  │  ├─ RPC connection failed                            │    │
│  │  ├─ Request timeout                                  │    │
│  │  └─ Max retries exceeded                             │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  Recovery Strategies:                                        │
│  - Retry with exponential backoff                           │
│  - Clear error messages with actionable details             │
│  - Preserve original error context                          │
└─────────────────────────────────────────────────────────────┘
```

## Transaction Creation Process

```
┌─────────────────────────────────────────────────────────────┐
│              SPL Token Transfer Transaction                  │
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Step 1: Get Token Accounts                        │     │
│  │                                                     │     │
│  │  senderTokenAccount = getAssociatedTokenAddress(   │     │
│  │    usdcMint,                                        │     │
│  │    walletPublicKey                                  │     │
│  │  )                                                  │     │
│  │                                                     │     │
│  │  recipientTokenAccount = payTo.address              │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Step 2: Create Transfer Instruction               │     │
│  │                                                     │     │
│  │  transferIx = createTransferInstruction(            │     │
│  │    senderTokenAccount,    // from                   │     │
│  │    recipientTokenAccount, // to                     │     │
│  │    walletPublicKey,       // authority              │     │
│  │    amountMicroUSDC        // amount                 │     │
│  │  )                                                  │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Step 3: Build Transaction                         │     │
│  │                                                     │     │
│  │  transaction = new Transaction()                    │     │
│  │    .add(transferIx)                                 │     │
│  │                                                     │     │
│  │  transaction.recentBlockhash = blockhash            │     │
│  │  transaction.feePayer = walletPublicKey             │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Step 4: Sign & Send                               │     │
│  │                                                     │     │
│  │  transaction.sign(wallet)                           │     │
│  │                                                     │     │
│  │  signature = await connection.sendRawTransaction(   │     │
│  │    transaction.serialize()                          │     │
│  │  )                                                  │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Step 5: Confirm                                   │     │
│  │                                                     │     │
│  │  await connection.confirmTransaction({              │     │
│  │    signature,                                       │     │
│  │    blockhash,                                       │     │
│  │    lastValidBlockHeight                             │     │
│  │  })                                                 │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

## Module Dependencies

```
┌─────────────────────────────────────────────────────────────┐
│                     External Dependencies                    │
│                                                              │
│  @solana/web3.js                                            │
│  ├─ Connection        (RPC communication)                   │
│  ├─ Keypair           (Wallet management)                   │
│  ├─ PublicKey         (Address handling)                    │
│  ├─ Transaction       (Transaction building)                │
│  └─ ConfirmOptions    (Transaction confirmation)            │
│                                                              │
│  @solana/spl-token                                          │
│  ├─ getAssociatedTokenAddressSync  (Token accounts)         │
│  ├─ createTransferInstruction      (SPL transfers)          │
│  ├─ createAssociatedTokenAccountInstruction (Account init)  │
│  └─ getAccount        (Account info)                        │
│                                                              │
│  bs58                                                        │
│  ├─ encode            (Private key encoding)                │
│  └─ decode            (Private key decoding)                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                     Internal Dependencies                    │
│                                                              │
│  types.ts                                                    │
│  ├─ PaymentRequirements                                     │
│  ├─ PaymentAccept                                           │
│  ├─ PaymentProof                                            │
│  ├─ PaymentError                                            │
│  └─ PaymentErrorCode                                        │
│                                                              │
│  x402-client.ts                                             │
│  └─ X402Client  (uses types)                                │
│                                                              │
│  wallet-manager.ts                                          │
│  └─ WalletManager  (uses @solana/web3.js, bs58)            │
│                                                              │
│  payment-sender.ts                                          │
│  └─ PaymentSender  (uses types, @solana/web3.js, spl-token)│
│                                                              │
│  index.ts                                                    │
│  └─ Exports all public APIs                                 │
└─────────────────────────────────────────────────────────────┘
```

## Configuration Flow

```
User Config ──> X402ClientConfig ──> X402Client Instance

{
  solanaRpcUrl: string
  walletPrivateKey: string | Uint8Array
  network?: 'devnet' | 'mainnet-beta'
  autoRetry?: boolean
  maxRetries?: number
  commitment?: CommitmentLevel
  debug?: boolean
}
          │
          ├──> Initialize Connection(solanaRpcUrl)
          │
          ├──> Parse wallet private key
          │    ├─ If string: bs58.decode()
          │    └─ If Uint8Array: use directly
          │
          ├──> Create Keypair from secret key
          │
          ├──> Set network (default: mainnet-beta)
          │    └─ Determines USDC mint address
          │
          ├──> Set autoRetry (default: true)
          │
          ├──> Set maxRetries (default: 3)
          │
          ├──> Set commitment (default: confirmed)
          │
          └──> Set debug (default: false)
```

## Testing Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Test Infrastructure                     │
│                                                              │
│  setup.ts                                                    │
│  ├─ Mock global fetch                                       │
│  └─ Reset mocks before each test                            │
│                                                              │
│  Jest Configuration                                          │
│  ├─ ts-jest preset                                          │
│  ├─ Node environment                                        │
│  └─ Coverage reporting                                      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                      Mock Strategy                           │
│                                                              │
│  @solana/web3.js Mocks                                      │
│  ├─ Connection                                              │
│  │   ├─ getLatestBlockhash() → mock blockhash              │
│  │   ├─ sendRawTransaction() → mock signature              │
│  │   ├─ confirmTransaction() → success                     │
│  │   ├─ getTokenAccountBalance() → mock balance            │
│  │   └─ getBalance() → mock SOL balance                    │
│  │                                                          │
│  ├─ Keypair                                                 │
│  │   └─ Real implementation (for key generation)           │
│  │                                                          │
│  └─ PublicKey                                               │
│      └─ Real implementation (for address validation)        │
│                                                              │
│  @solana/spl-token Mocks                                    │
│  ├─ getAssociatedTokenAddressSync() → mock address         │
│  ├─ createTransferInstruction() → mock instruction         │
│  └─ getAccount() → mock account info                       │
│                                                              │
│  fetch Mock                                                  │
│  └─ jest.fn() with custom responses per test               │
└─────────────────────────────────────────────────────────────┘
```

This architecture provides a clean separation of concerns, comprehensive error handling, and production-ready transaction processing for x402 payments on Solana.
