import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "D-VOTE - Decentralized Voting System",
  description: "Secure, transparent, and blockchain-powered voting for corporate governance",
  keywords: "blockchain, voting, decentralized, corporate governance, ethereum, web3",
  authors: [{ name: "D-VOTE Team" }],
  viewport: "width=device-width, initial-scale=1",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <script src="https://cdn.ethers.io/lib/ethers-5.7.2.umd.min.js" async></script>
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  )
}
