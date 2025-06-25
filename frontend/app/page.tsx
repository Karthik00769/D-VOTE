"use client"

import { useState, useEffect } from "react"
import { Wallet, Vote, Shield, Eye, Settings, Plus, Users, Calendar, Twitter, Linkedin, Github } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { getBlockByNumber, getERCAssetTransfers, getTokenBalances } from "@/lib/alchemy"
import { getDVoteContract } from "@/lib/contract"
import { ethers } from "ethers"

declare global {
  interface Window {
    ethereum?: any
  }
}

interface Election {
  id: string
  title: string
  description: string
  startDate: string
  endDate: string
}

interface Voter {
  id: string
  name: string
  address: string
}

export default function DVotePage() {
  const [walletAddress, setWalletAddress] = useState<string>("")
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string>("")
  const [elections, setElections] = useState<Election[]>([])
  const [voters, setVoters] = useState<Voter[]>([])

  // Election form state
  const [electionTitle, setElectionTitle] = useState("")
  const [electionDescription, setElectionDescription] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [candidateNames, setCandidateNames] = useState<string[]>([""])
  const [isCreatingElection, setIsCreatingElection] = useState(false)

  // Voter form state
  const [voterName, setVoterName] = useState("")
  const [voterAddress, setVoterAddress] = useState("")

  useEffect(() => {
    checkWalletConnection()
  }, [])

  const checkWalletConnection = async () => {
    if (typeof window !== "undefined" && window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: "eth_accounts" })
        if (accounts.length > 0) {
          setWalletAddress(accounts[0])
        }
      } catch (error) {
        console.error("Error checking wallet connection:", error)
      }
    }
  }

  const connectWallet = async () => {
    if (typeof window === "undefined" || !window.ethereum) {
      setError("Please install MetaMask to connect your wallet")
      return
    }

    setIsConnecting(true)
    setError("")

    try {
      // Request account access
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      })

      // Check if we're on Sepolia testnet
      const chainId = await window.ethereum.request({ method: "eth_chainId" })
      if (chainId !== "0xaa36a7") {
        // Sepolia testnet chain ID
        try {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: "0xaa36a7" }],
          })
        } catch (switchError: any) {
          if (switchError.code === 4902) {
            setError("Please add Sepolia testnet to your MetaMask")
          } else {
            setError("Please switch to Sepolia testnet")
          }
          setIsConnecting(false)
          return
        }
      }

      setWalletAddress(accounts[0])
    } catch (error: any) {
      setError("Failed to connect wallet: " + error.message)
    } finally {
      setIsConnecting(false)
    }
  }

  const disconnectWallet = () => {
    setWalletAddress("")
  }

  // Add candidate input fields
  const handleCandidateChange = (index: number, value: string) => {
    const updated = [...candidateNames]
    updated[index] = value
    setCandidateNames(updated)
  }
  const addCandidateField = () => setCandidateNames([...candidateNames, ""])
  const removeCandidateField = (index: number) => {
    if (candidateNames.length > 1) {
      setCandidateNames(candidateNames.filter((_, i) => i !== index))
    }
  }

  // Blockchain-integrated createElection
  const createElection = async () => {
    if (!walletAddress) {
      setError("Please connect your wallet first")
      return
    }
    if (!electionTitle || !electionDescription || !startDate || !endDate || candidateNames.some((c) => !c)) {
      setError("Please fill in all election fields and candidate names")
      return
    }
    setIsCreatingElection(true)
    setError("")
    try {
      if (!window.ethereum) throw new Error("MetaMask not found")
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const contract = getDVoteContract(signer)
      // Convert dates to unix timestamps
      const start = Math.floor(new Date(startDate).getTime() / 1000)
      const end = Math.floor(new Date(endDate).getTime() / 1000)
      const tx = await contract.createElection(
        electionTitle,
        electionDescription,
        start,
        end,
        candidateNames.filter((c) => c)
      )
      await tx.wait()
      setElections([
        ...elections,
        {
          id: Date.now().toString(),
          title: electionTitle,
          description: electionDescription,
          startDate,
          endDate,
        },
      ])
      setElectionTitle("")
      setElectionDescription("")
      setStartDate("")
      setEndDate("")
      setCandidateNames([""])
    } catch (err: any) {
      setError(err.message || "Failed to create election")
    } finally {
      setIsCreatingElection(false)
    }
  }

  const addVoter = () => {
    if (!walletAddress) {
      setError("Please connect your wallet first")
      return
    }

    if (!voterName || !voterAddress) {
      setError("Please fill in all voter fields")
      return
    }

    if (!voterAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      setError("Please enter a valid Ethereum address")
      return
    }

    const newVoter: Voter = {
      id: Date.now().toString(),
      name: voterName,
      address: voterAddress,
    }

    setVoters([...voters, newVoter])
    setVoterName("")
    setVoterAddress("")
    setError("")
  }

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-slate-900/80 via-purple-900/80 to-slate-900/80 backdrop-blur-md border-b border-purple-500/20">
        <div className="container mx-auto px-8 py-8 flex items-center justify-between gap-12">
          <div className="text-4xl font-extrabold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent tracking-tight">
            D-VOTE
          </div>

          <nav className="hidden md:flex space-x-16">
            <a
              href="#home"
              className="text-gray-300 hover:text-white transition-colors duration-300 hover:scale-105 transform text-2xl font-semibold"
            >
              Home
            </a>
            <a
              href="#create-election"
              className="text-gray-300 hover:text-white transition-colors duration-300 hover:scale-105 transform text-2xl font-semibold"
            >
              Create Election
            </a>
            <a
              href="#add-voter"
              className="text-gray-300 hover:text-white transition-colors duration-300 hover:scale-105 transform text-2xl font-semibold"
            >
              Add Voter
            </a>
          </nav>

          <Button
            onClick={walletAddress ? disconnectWallet : connectWallet}
            disabled={isConnecting}
            className="flex items-center justify-center gap-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border-0 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-purple-500/25 px-16 py-6 text-3xl font-extrabold rounded-2xl min-w-[340px]"
          >
            <Wallet className="w-8 h-8" />
            <span className="flex-1 text-center">
              {isConnecting ? "Connecting..." : walletAddress ? formatAddress(walletAddress) : "Connect Wallet"}
            </span>
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-20">
        {/* Hero Section */}
        <section id="home" className="relative py-20 px-4 text-center overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-purple-600/10 animate-pulse"></div>
          <div className="container mx-auto relative z-10">
            <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-blue-400 via-purple-400 to-blue-400 bg-clip-text text-transparent animate-fade-in">
              D-VOTE: Decentralized Voting for the Future
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 mb-8 max-w-3xl mx-auto">
              Secure, transparent, and blockchain-powered voting for corporate governance
            </p>
            <div className="flex justify-center w-full mt-10">
              <Button
                size="lg"
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border-0 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-purple-500/25 text-3xl px-16 py-6 font-extrabold rounded-2xl mx-auto"
              >
                Get Started
              </Button>
            </div>
          </div>
        </section>

        {/* Error Alert */}
        {error && (
          <div className="container mx-auto px-4 mb-8">
            <Alert className="bg-red-900/50 border-red-500/50 text-red-200">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        )}

        {/* Features Section */}
        <section className="py-20 px-4">
          <div className="container mx-auto">
            <h2 className="text-5xl font-extrabold text-center mb-20 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Why Choose D-VOTE?
            </h2>
            <div className="grid md:grid-cols-3 gap-12">
              <Card className="bg-slate-800/70 border-purple-500/30 hover:border-purple-500/50 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/20 rounded-2xl p-8 min-h-[320px] flex flex-col items-center justify-center">
                <CardHeader className="flex flex-col items-center justify-center mb-4">
                  <Shield className="w-20 h-20 text-blue-400 mb-6" />
                  <CardTitle className="text-white text-3xl font-bold text-center">Secure Blockchain Voting</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-gray-300 text-xl text-center">
                    Immutable and tamper-proof voting records secured by blockchain technology
                  </CardDescription>
                </CardContent>
              </Card>
              <Card className="bg-slate-800/70 border-purple-500/30 hover:border-purple-500/50 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/20 rounded-2xl p-8 min-h-[320px] flex flex-col items-center justify-center">
                <CardHeader className="flex flex-col items-center justify-center mb-4">
                  <Eye className="w-20 h-20 text-purple-400 mb-6" />
                  <CardTitle className="text-white text-3xl font-bold text-center">Transparent Results</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-gray-300 text-xl text-center">
                    Real-time, verifiable results that all stakeholders can audit independently
                  </CardDescription>
                </CardContent>
              </Card>
              <Card className="bg-slate-800/70 border-purple-500/30 hover:border-purple-500/50 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/20 rounded-2xl p-8 min-h-[320px] flex flex-col items-center justify-center">
                <CardHeader className="flex flex-col items-center justify-center mb-4">
                  <Settings className="w-20 h-20 text-blue-400 mb-6" />
                  <CardTitle className="text-white text-3xl font-bold text-center">Easy Election Management</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-gray-300 text-xl text-center">
                    Intuitive interface for creating and managing corporate elections and governance
                  </CardDescription>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Create Election Section */}
        <section id="create-election" className="py-20 px-4 bg-slate-800/30">
          <div className="container mx-auto max-w-2xl">
            <h2 className="text-5xl font-extrabold text-center mb-20 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Create Election
            </h2>
            <div className="flex flex-col items-center justify-center">
              <div className="flex flex-col items-center justify-center bg-gradient-to-br from-purple-700/60 to-blue-700/60 rounded-2xl shadow-2xl p-12 w-full max-w-2xl mb-12">
                <div className="flex flex-col items-center justify-center w-full h-32 rounded-xl bg-slate-900/80 shadow-lg mb-8">
                  <Vote className="w-14 h-14 text-purple-300 mb-2" />
                  <span className="text-2xl font-bold text-white text-center">New Election</span>
                </div>
                <div className="w-full space-y-8">
                  <Input
                    value={electionTitle}
                    onChange={(e) => setElectionTitle(e.target.value)}
                    placeholder="Election Title"
                    className="w-full bg-slate-700/70 border-0 text-white placeholder-purple-300 focus:ring-4 focus:ring-purple-400/40 rounded-xl px-6 py-5 text-2xl shadow-md text-center"
                    maxLength={64}
                  />
                  <Textarea
                    value={electionDescription}
                    onChange={(e) => setElectionDescription(e.target.value)}
                    placeholder="Purpose/Description"
                    className="w-full bg-slate-700/70 border-0 text-white placeholder-purple-300 focus:ring-4 focus:ring-purple-400/40 rounded-xl px-6 py-5 text-2xl shadow-md text-center"
                    rows={4}
                    maxLength={256}
                  />
                  <div className="flex gap-6">
                    <Input
                      type="datetime-local"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="flex-1 bg-slate-700/70 border-0 text-white focus:ring-4 focus:ring-purple-400/40 rounded-xl px-4 py-4 text-xl shadow-md text-center"
                    />
                    <Input
                      type="datetime-local"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="flex-1 bg-slate-700/70 border-0 text-white focus:ring-4 focus:ring-purple-400/40 rounded-xl px-4 py-4 text-xl shadow-md text-center"
                    />
                  </div>
                  <div className="space-y-3">
                    {candidateNames.map((name, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                        <Input
                          value={name}
                          onChange={(e) => handleCandidateChange(idx, e.target.value)}
                          placeholder={`Candidate ${idx + 1}`}
                          className="flex-1 bg-slate-700/70 border-0 text-white placeholder-purple-300 focus:ring-4 focus:ring-purple-400/40 rounded-xl px-4 py-4 text-xl shadow-md text-center"
                          maxLength={48}
                        />
                        {candidateNames.length > 1 && (
                          <Button type="button" variant="destructive" size="icon" onClick={() => removeCandidateField(idx)} className="rounded-xl w-10 h-10 flex items-center justify-center">
                            <span className="text-lg">✕</span>
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button type="button" variant="secondary" size="lg" onClick={addCandidateField} className="mt-2 rounded-xl px-8 py-3 w-full text-xl">
                      Add Candidate
                    </Button>
                  </div>
                </div>
              </div>
              <Button
                onClick={createElection}
                disabled={!walletAddress || isCreatingElection}
                className="w-80 h-16 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-600 text-white border-0 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-purple-500/25 rounded-xl text-2xl font-bold flex items-center justify-center"
                title={!walletAddress ? "Please connect your wallet first" : ""}
              >
                <Plus className="w-8 h-8 mr-3" />
                {isCreatingElection ? "Creating..." : "Create Election"}
              </Button>
            </div>

            {/* Elections List */}
            {elections.length > 0 && (
              <div className="mt-8">
                <h3 className="text-2xl font-bold text-white mb-4">Created Elections</h3>
                <div className="space-y-4">
                  {elections.map((election, index) => (
                    <Card
                      key={election.id}
                      className="bg-slate-800/50 border-purple-500/20 animate-fade-in"
                      style={{ animationDelay: `${index * 0.1}s` }}
                    >
                      <CardHeader>
                        <CardTitle className="text-white">{election.title}</CardTitle>
                        <CardDescription className="text-gray-300">{election.description}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center text-sm text-gray-400">
                          <Calendar className="w-4 h-4 mr-1" />
                          {new Date(election.startDate).toLocaleDateString()} -{" "}
                          {new Date(election.endDate).toLocaleDateString()}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Add Voter Section */}
        <section id="add-voter" className="py-20 px-4">
          <div className="container mx-auto max-w-2xl">
            <h2 className="text-5xl font-extrabold text-center mb-20 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Add Voter
            </h2>
            <div className="flex flex-col items-center justify-center">
              <div className="flex flex-col items-center justify-center bg-gradient-to-br from-purple-700/60 to-blue-700/60 rounded-2xl shadow-2xl p-12 w-full max-w-2xl mb-12">
                <div className="flex flex-col items-center justify-center w-full h-32 rounded-xl bg-slate-900/80 shadow-lg mb-8">
                  <Users className="w-14 h-14 text-purple-300 mb-2" />
                  <span className="text-2xl font-bold text-white text-center">Voter</span>
                </div>
                <div className="w-full space-y-8">
                  <Input
                    value={voterName}
                    onChange={(e) => setVoterName(e.target.value)}
                    placeholder="Voter Name"
                    className="w-full bg-slate-700/70 border-0 text-white placeholder-purple-300 focus:ring-4 focus:ring-purple-400/40 rounded-xl px-6 py-5 text-2xl shadow-md text-center"
                    maxLength={64}
                  />
                  <Input
                    value={voterAddress}
                    onChange={(e) => setVoterAddress(e.target.value)}
                    placeholder="0x..."
                    className="w-full bg-slate-700/70 border-0 text-white placeholder-purple-300 focus:ring-4 focus:ring-purple-400/40 rounded-xl px-6 py-5 text-2xl shadow-md text-center"
                    maxLength={42}
                  />
                </div>
              </div>
              <Button
                onClick={addVoter}
                disabled={!walletAddress}
                className="w-80 h-16 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-600 text-white border-0 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-purple-500/25 rounded-xl text-2xl font-bold flex items-center justify-center"
                title={!walletAddress ? "Please connect your wallet first" : ""}
              >
                <Plus className="w-8 h-8 mr-3" />
                Add Voter
              </Button>
            </div>

            {/* Voters List */}
            {voters.length > 0 && (
              <div className="mt-8">
                <h3 className="text-2xl font-bold text-white mb-4">Registered Voters</h3>
                <div className="space-y-4">
                  {voters.map((voter, index) => (
                    <Card
                      key={voter.id}
                      className="bg-slate-800/50 border-purple-500/20 animate-fade-in"
                      style={{ animationDelay: `${index * 0.1}s` }}
                    >
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-white font-medium">{voter.name}</h4>
                            <p className="text-gray-400 text-sm font-mono">{voter.address}</p>
                          </div>
                          <Users className="w-5 h-5 text-purple-400" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-gradient-to-r from-slate-900 via-purple-900/50 to-slate-900 border-t border-purple-500/20 py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-4 md:mb-0">
              D-VOTE
            </div>

            <nav className="flex space-x-8 mb-4 md:mb-0">
              <a href="#" className="text-gray-300 hover:text-white transition-colors duration-300">
                About
              </a>
              <a href="#" className="text-gray-300 hover:text-white transition-colors duration-300">
                Privacy Policy
              </a>
              <a href="#" className="text-gray-300 hover:text-white transition-colors duration-300">
                Contact Us
              </a>
            </nav>

            <div className="flex space-x-4">
              <a href="#" className="text-gray-400 hover:text-white transition-all duration-300 hover:scale-110" title="Twitter">
                <Twitter className="w-5 h-5" />
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition-all duration-300 hover:scale-110" title="LinkedIn">
                <Linkedin className="w-5 h-5" />
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition-all duration-300 hover:scale-110" title="GitHub">
                <Github className="w-5 h-5" />
              </a>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-purple-500/20 text-center text-gray-400">
            <p>&copy; 2024 D-VOTE. All rights reserved. Powered by blockchain technology.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
