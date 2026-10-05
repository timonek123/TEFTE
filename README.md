# TEFTE

**AI-powered marketplace built for Solana Mobile.**

TEFTE helps people discover products, create listings from a photo, connect a Solana wallet, and move through a marketplace purchase flow with buyer protection and rewards.

## What TEFTE does

- **AI Search** — describe what you need in natural language and TEFTE recommends matching products.
- **AI Listing from Photo** — add a product photo and TEFTE suggests a title, category, condition, description and price.
- **Solana Mobile Wallet** — connect and disconnect a compatible wallet directly in the app.
- **Marketplace** — browse listings, message sellers, manage your own listings and purchases.
- **SOL Checkout** — devnet test payment flow through a Solana wallet.
- **SKR Rewards Demo** — preview SKR purchases that unlock TEFTE XP and Listing Boosts.
- **TEFTE Protection** — order flow from payment to seller confirmation, shipping, carrier-confirmed delivery and a 48-hour buyer protection window.
- **Seller Tools** — edit, mark as sold, delete and boost listings.
- **Wallet-based Profile** — avatar, purchases, listings, sales and rewards follow the connected wallet.

## Built for Solana Mobile

TEFTE is designed and tested on **Solana Seeker**.

Recommended test setup:

- Android / Solana Seeker
- Internet connection
- Compatible Solana wallet

The Android release build runs independently and does **not** require Metro or a development computer.

## Hackathon MVP flow

1. Connect a Solana wallet.
2. Search for a product with TEFTE AI.
3. Open a listing and start checkout.
4. Pay with SOL in the devnet test flow, or use the SKR reward demo preview.
5. Seller confirms the order and ships it.
6. Carrier confirmation marks the order as delivered.
7. Buyer gets a 48-hour protection window to confirm or dispute.
8. When the order completes, the seller is paid and eligible SKR purchases unlock TEFTE rewards.

## TEFTE Rewards

The current MVP keeps two reward ideas separate:

- **SKR purchase rewards** — completed SKR demo purchases can award TEFTE XP and Listing Boosts.
- **Stake / Lock SKR** — planned long-term loyalty perks such as lower fees, cheaper boosts, status and cosmetics.

Current reward demo includes:

- First completed SKR purchase: **+100 TEFTE XP +1 Listing Boost**
- Later SKR purchases: XP rewards based on the purchase rules implemented in the MVP
- Listing Boost: highlights an active listing for 24 hours

## Tech stack

### Mobile app

- React Native
- Expo
- Expo Router
- Solana Mobile wallet integration

### Backend

- Node.js
- Railway
- Persistent Railway volume for marketplace data and uploads
- AI requests through the TEFTE backend

## Current MVP status

Implemented and tested:

- AI product search
- AI listing generation from a photo
- Product browsing and search
- Wallet connect / disconnect
- Wallet-scoped seller listings
- Profile avatar
- SOL devnet checkout flow
- SKR reward demo
- Seller confirmation
- Shipping and tracking reference
- Carrier-confirmed delivery demo endpoint
- 48-hour buyer protection flow
- Completed orders
- TEFTE XP
- Listing Boosts
- Owner listing management

## Hackathon scope / roadmap

The current build is a working hackathon MVP. The following are roadmap items rather than production-complete integrations:

- Production carrier APIs
- Production SKR settlement
- On-chain escrow
- Expanded dispute resolution
- Stake / Lock SKR loyalty tiers
- Marketplace scaling and moderation

## Install the Android build

The hackathon build is distributed as an Android APK.

After downloading the APK:

1. Open the APK on the Android device.
2. If Android asks for permission, allow **Install unknown apps** for the browser or file manager used to open it.
3. Install TEFTE.
4. Open the app and connect a compatible Solana wallet.

**Recommended device: Solana Seeker.**

> TEFTE never asks for a seed phrase. Wallet authorization and signing happen through the connected wallet experience.

## Repository

This repository contains the TEFTE Expo application and backend used for the hackathon MVP.
