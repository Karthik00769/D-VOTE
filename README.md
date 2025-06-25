# D-VOTE: Decentralized Web3 Voting Platform

D-VOTE is a professional, accessible, and production-ready decentralized voting application built with a modern Web3 stack. It enables secure, transparent, and tamper-proof elections using blockchain technology, with a seamless user experience and automated deployment workflows.

## Features
- **Decentralized Voting:** All votes and elections are recorded on the Ethereum Sepolia testnet for transparency and security.
- **Modern UI/UX:** Built with Next.js and Tailwind CSS for a clean, accessible, and responsive interface.
- **Smart Contract Automation:** Hardhat is used for contract development, testing, and automated deployment.
- **CI/CD Integration:** GitHub Actions automate contract deployment and sync the contract address to the frontend for Vercel redeployment.
- **Seamless Blockchain Integration:** Uses ethers.js and viem for frontend blockchain interactions.

## Tech Stack
- **Frontend:**
  - Next.js (React framework)
  - Tailwind CSS (utility-first CSS)
  - ethers.js & viem (blockchain interaction)
- **Backend/Smart Contracts:**
  - Solidity (Ethereum smart contracts)
  - Hardhat (development, testing, deployment)
- **DevOps & Automation:**
  - GitHub Actions (CI/CD for contract deployment and frontend sync)
  - Vercel (frontend hosting)
- **Other:**
  - TypeScript (type safety)
  - Alchemy (Ethereum node provider)

## Repository Structure
- `frontend/` — Next.js app, UI, blockchain integration
- `backend/` — Hardhat project, smart contracts, deployment scripts
