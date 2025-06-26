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

interface Candidate {
  id: string;
  name: string;
  votes: number;
}

interface Election {
  id: string
  title: string
  description: string
  startDate: string
  endDate: string
  candidates: Candidate[]
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
  const [selectedElectionId, setSelectedElectionId] = useState("")
  const [selectedCandidateId, setSelectedCandidateId] = useState("")
  const [hasVoted, setHasVoted] = useState<{ [electionId: string]: boolean }>({})

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
  const [voters, setVoters] = useState<Voter[]>([])

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
          candidates: candidateNames.filter((c) => c).map((name, idx) => ({ id: `${Date.now()}-${idx}`, name, votes: 0 })),
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

  const voteForCandidate = () => {
    if (!selectedElectionId || !selectedCandidateId) {
      setError("Please select an election and a candidate to vote for.")
      return
    }
    if (hasVoted[selectedElectionId]) {
      setError("You have already voted in this election.")
      return
    }
    setElections((prev) =>
      prev.map((election) => {
        if (election.id !== selectedElectionId) return election
        return {
          ...election,
          candidates: election.candidates.map((c) =>
            c.id === selectedCandidateId ? { ...c, votes: c.votes + 1 } : c
          ),
        }
      })
    )
    setHasVoted((prev) => ({ ...prev, [selectedElectionId]: true }))
    setError("")
  }

  const getWinner = (election: Election) => {
    if (!election.candidates.length) return null
    const maxVotes = Math.max(...election.candidates.map((c) => c.votes))
    const winners = election.candidates.filter((c) => c.votes === maxVotes)
    return winners.length === 1 ? winners[0] : null // null if tie
  }

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-slate-900/80 via-purple-900/80 to-slate-900/80 backdrop-blur-md border-b border-purple-500/20">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-6">
          <div className="text-lg font-extrabold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent tracking-tight">
            D-VOTE
          </div>

          <nav className="hidden md:flex space-x-6">
            <a href="#home" className="text-sm font-semibold text-gray-300 hover:text-white hover:bg-purple-500/10 px-2 py-1 rounded transition-all duration-200">
              Home
            </a>
            <a href="#create-election" className="text-sm font-semibold text-gray-300 hover:text-white hover:bg-purple-500/10 px-2 py-1 rounded transition-all duration-200">
              Create Election
            </a>
            <a href="#add-voter" className="text-sm font-semibold text-gray-300 hover:text-white hover:bg-purple-500/10 px-2 py-1 rounded transition-all duration-200">
              Add Voter
            </a>
          </nav>

          <Button
            onClick={walletAddress ? disconnectWallet : connectWallet}
            disabled={isConnecting}
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border-0 transition-all duration-200 hover:scale-105 hover:shadow-md hover:shadow-purple-500/25 px-6 py-2 text-base font-bold rounded-xl min-w-[160px]"
          >
            <Wallet className="w-5 h-5" />
            <span className="flex-1 text-center">
              {isConnecting ? "Connecting..." : walletAddress ? formatAddress(walletAddress) : "Connect Wallet"}
            </span>
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-16">
        {/* Hero Section */}
        <section id="home" className="relative py-10 px-2 text-center overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-purple-600/10 animate-pulse"></div>
          <div className="container mx-auto relative z-10">
            <h1 className="text-2xl md:text-4xl font-bold mb-3 bg-gradient-to-r from-blue-400 via-purple-400 to-blue-400 bg-clip-text text-transparent animate-fade-in">
              D-VOTE: Decentralized Voting for the Future
            </h1>
            <p className="text-base md:text-lg text-gray-300 mb-5 max-w-xl mx-auto">
              Secure, transparent, and blockchain-powered voting for corporate governance
            </p>
            <div className="flex justify-center w-full mt-4">
              <Button
                size="lg"
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border-0 transition-all duration-200 hover:scale-105 hover:shadow-md hover:shadow-purple-500/25 text-base px-8 py-3 font-bold rounded-xl mx-auto"
              >
                Get Started
              </Button>
            </div>
          </div>
        </section>

        {/* Error Alert */}
        {error && (
          <div className="container mx-auto px-2 mb-4">
            <Alert className="bg-red-900/50 border-red-500/50 text-red-200">
              <AlertDescription className="text-sm">{error}</AlertDescription>
            </Alert>
          </div>
        )}

        {/* Features Section */}
        <section className="py-8 px-2">
          <div className="container mx-auto">
            <h2 className="text-2xl font-bold text-center mb-8 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Why Choose D-VOTE?
            </h2>
            <div className="grid md:grid-cols-3 gap-4">
              <Card className="bg-slate-800/70 border-purple-500/30 hover:border-purple-500/50 transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-purple-500/20 rounded-xl p-4 min-h-[160px] flex flex-col items-center justify-center">
                <CardHeader className="flex flex-col items-center justify-center mb-2">
                  <Shield className="w-8 h-8 text-blue-400 mb-2" />
                  <CardTitle className="text-white text-lg font-bold text-center">Secure Blockchain Voting</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-gray-300 text-sm text-center">
                    Immutable and tamper-proof voting records secured by blockchain technology
                  </CardDescription>
                </CardContent>
              </Card>
              <Card className="bg-slate-800/70 border-purple-500/30 hover:border-purple-500/50 transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-purple-500/20 rounded-xl p-4 min-h-[160px] flex flex-col items-center justify-center">
                <CardHeader className="flex flex-col items-center justify-center mb-2">
                  <Eye className="w-8 h-8 text-purple-400 mb-2" />
                  <CardTitle className="text-white text-lg font-bold text-center">Transparent Results</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-gray-300 text-sm text-center">
                    Real-time, verifiable results that all stakeholders can audit independently
                  </CardDescription>
                </CardContent>
              </Card>
              <Card className="bg-slate-800/70 border-purple-500/30 hover:border-purple-500/50 transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-purple-500/20 rounded-xl p-4 min-h-[160px] flex flex-col items-center justify-center">
                <CardHeader className="flex flex-col items-center justify-center mb-2">
                  <Settings className="w-8 h-8 text-blue-400 mb-2" />
                  <CardTitle className="text-white text-lg font-bold text-center">Easy Election Management</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-gray-300 text-sm text-center">
                    Intuitive interface for creating and managing corporate elections and governance
                  </CardDescription>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Create Election Section */}
        <section id="create-election" className="py-8 px-2 bg-slate-800/30">
          <div className="container mx-auto max-w-xl">
            <h2 className="text-2xl font-bold text-center mb-8 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Create Election
            </h2>
            <div className="flex flex-col items-center justify-center">
              <div className="flex flex-col items-center justify-center bg-gradient-to-br from-purple-700/60 to-blue-700/60 rounded-xl shadow-lg p-6 w-full max-w-xl mb-6">
                <div className="flex flex-col items-center justify-center w-full h-20 rounded bg-slate-900/80 shadow mb-4">
                  <Vote className="w-8 h-8 text-purple-300 mb-1" />
                  <span className="text-lg font-bold text-white text-center">New Election</span>
                </div>
                <div className="w-full space-y-4">
                  <Input
                    value={electionTitle}
                    onChange={(e) => setElectionTitle(e.target.value)}
                    placeholder="Election Title"
                    className="w-full bg-slate-700/70 border-0 text-white placeholder-purple-300 focus:ring-2 focus:ring-purple-400/40 rounded-lg px-4 py-2 text-base shadow text-center"
                    maxLength={64}
                  />
                  <Textarea
                    value={electionDescription}
                    onChange={(e) => setElectionDescription(e.target.value)}
                    placeholder="Purpose/Description"
                    className="w-full bg-slate-700/70 border-0 text-white placeholder-purple-300 focus:ring-2 focus:ring-purple-400/40 rounded-lg px-4 py-2 text-base shadow text-center"
                    rows={3}
                    maxLength={256}
                  />
                  <div className="flex gap-3">
                    <Input
                      type="datetime-local"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="flex-1 bg-slate-700/70 border-0 text-white focus:ring-2 focus:ring-purple-400/40 rounded-lg px-2 py-2 text-sm shadow text-center"
                    />
                    <Input
                      type="datetime-local"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="flex-1 bg-slate-700/70 border-0 text-white focus:ring-2 focus:ring-purple-400/40 rounded-lg px-2 py-2 text-sm shadow text-center"
                    />
                  </div>
                  <div className="space-y-2">
                    {candidateNames.map((name, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <Input
                          value={name}
                          onChange={(e) => handleCandidateChange(idx, e.target.value)}
                          placeholder={`Candidate ${idx + 1}`}
                          className="flex-1 bg-slate-700/70 border-0 text-white placeholder-purple-300 focus:ring-2 focus:ring-purple-400/40 rounded-lg px-2 py-2 text-sm shadow text-center"
                          maxLength={48}
                        />
                        {candidateNames.length > 1 && (
                          <Button type="button" variant="destructive" size="icon" onClick={() => removeCandidateField(idx)} className="rounded-lg w-7 h-7 flex items-center justify-center">
                            <span className="text-base">✕</span>
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button type="button" variant="secondary" size="sm" onClick={addCandidateField} className="mt-1 rounded-lg px-4 py-2 w-full text-sm">
                      Add Candidate
                    </Button>
                  </div>
                </div>
              </div>
              <Button
                onClick={createElection}
                disabled={!walletAddress || isCreatingElection}
                className="w-56 h-10 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-600 text-white border-0 transition-all duration-200 hover:scale-105 hover:shadow-md hover:shadow-purple-500/25 rounded-lg text-base font-bold flex items-center justify-center"
                title={!walletAddress ? "Please connect your wallet first" : ""}
              >
                <Plus className="w-5 h-5 mr-2" />
                {isCreatingElection ? "Creating..." : "Create Election"}
              </Button>
            </div>

            {/* Elections List */}
            {elections.length > 0 && (
              <div className="mt-4">
                <h3 className="text-base font-bold text-white mb-2">Created Elections</h3>
                <div className="space-y-2">
                  {elections.map((election, index) => (
                    <Card
                      key={election.id}
                      className="bg-slate-800/50 border-purple-500/20 animate-fade-in rounded-lg"
                      style={{ animationDelay: `${index * 0.1}s` }}
                    >
                      <CardContent className="p-2">
                        <h4 className="text-white text-sm font-bold">{election.title}</h4>
                        <p className="text-gray-300 text-xs">{election.description}</p>
                        <div className="flex items-center text-xs text-gray-400 mt-1">
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
        <section id="add-voter" className="py-8 px-2">
          <div className="container mx-auto max-w-xl">
            <h2 className="text-2xl font-bold text-center mb-8 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Add Voter
            </h2>
            <div className="flex flex-col items-center justify-center">
              <div className="flex flex-col items-center justify-center bg-gradient-to-br from-purple-700/60 to-blue-700/60 rounded-xl shadow-lg p-6 w-full max-w-xl mb-6">
                <div className="flex flex-col items-center justify-center w-full h-20 rounded bg-slate-900/80 shadow mb-4">
                  <Users className="w-8 h-8 text-purple-300 mb-1" />
                  <span className="text-lg font-bold text-white text-center">Voter</span>
                </div>
                <div className="w-full space-y-4">
                  <Input
                    value={voterName}
                    onChange={(e) => setVoterName(e.target.value)}
                    placeholder="Voter Name"
                    className="w-full bg-slate-700/70 border-0 text-white placeholder-purple-300 focus:ring-2 focus:ring-purple-400/40 rounded-lg px-4 py-2 text-base shadow text-center"
                    maxLength={64}
                  />
                  <Input
                    value={voterAddress}
                    onChange={(e) => setVoterAddress(e.target.value)}
                    placeholder="0x..."
                    className="w-full bg-slate-700/70 border-0 text-white placeholder-purple-300 focus:ring-2 focus:ring-purple-400/40 rounded-lg px-4 py-2 text-base shadow text-center"
                    maxLength={42}
                  />
                </div>
              </div>
              <Button
                onClick={addVoter}
                disabled={!walletAddress}
                className="w-56 h-10 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-600 text-white border-0 transition-all duration-200 hover:scale-105 hover:shadow-md hover:shadow-purple-500/25 rounded-lg text-base font-bold flex items-center justify-center"
                title={!walletAddress ? "Please connect your wallet first" : ""}
              >
                <Plus className="w-5 h-5 mr-2" />
                Add Voter
              </Button>
            </div>

            {/* Voters List */}
            {voters.length > 0 && (
              <div className="mt-4">
                <h3 className="text-base font-bold text-white mb-2">Registered Voters</h3>
                <div className="space-y-2">
                  {voters.map((voter, index) => (
                    <Card
                      key={voter.id}
                      className="bg-slate-800/50 border-purple-500/20 animate-fade-in rounded-lg"
                      style={{ animationDelay: `${index * 0.1}s` }}
                    >
                      <CardContent className="p-2 flex items-center justify-between">
                        <div>
                          <h4 className="text-white text-sm font-bold">{voter.name}</h4>
                          <p className="text-gray-400 text-xs font-mono">{voter.address}</p>
                        </div>
                        <Users className="w-4 h-4 text-purple-400 ml-2" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Voter Section: Voting for a Candidate in the Election */}
        <section className="py-8 px-2 bg-slate-800/30">
          <div className="container mx-auto max-w-xl">
            <h2 className="text-2xl font-bold text-center mb-8 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Vote for a Candidate
            </h2>
            <div className="flex flex-col items-center justify-center">
              <div className="w-full space-y-4">
                <select
                  aria-label="Select Election"
                  value={selectedElectionId}
                  onChange={(e) => {
                    setSelectedElectionId(e.target.value)
                    setSelectedCandidateId("")
                  }}
                  className="w-full bg-slate-700/70 border-0 text-white focus:ring-2 focus:ring-purple-400/40 rounded-lg px-4 py-2 text-base shadow"
                >
                  <option value="">Select Election</option>
                  {elections.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.title}
                    </option>
                  ))}
                </select>
                {selectedElectionId && (
                  <select
                  aria-label="Select Candidate"
                  value={selectedCandidateId}
                  onChange={(e) => setSelectedCandidateId(e.target.value)}
                  className="w-full bg-slate-700/70 border-0 text-white focus:ring-2 focus:ring-purple-400/40 rounded-lg px-4 py-2 text-base shadow"
                  >
                    <option value="">Select Candidate</option>
                    {elections
                      .find((e) => e.id === selectedElectionId)
                      ?.candidates.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                )}
                <Button
                  onClick={voteForCandidate}
                  disabled={!selectedElectionId || !selectedCandidateId || hasVoted[selectedElectionId]}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border-0 transition-all duration-200 hover:scale-105 hover:shadow-md hover:shadow-purple-500/25 rounded-lg text-base font-bold flex items-center justify-center"
                >
                  Vote
                </Button>
              </div>
              {/* Show vote counts and winner if election ended */}
              {selectedElectionId && (
                <div className="mt-6 w-full">
                  <h3 className="text-base font-bold text-white mb-2">Vote Counts</h3>
                  <div className="space-y-2">
                    {elections
                      .find((e) => e.id === selectedElectionId)
                      ?.candidates.map((c) => (
                        <div key={c.id} className="flex items-center justify-between bg-slate-800/50 border-purple-500/20 rounded-lg px-3 py-2">
                          <span className="text-white text-sm font-bold">{c.name}</span>
                          <span className="text-purple-400 font-bold">{c.votes} votes</span>
                        </div>
                      ))}
                  </div>
                  {/* Winner announcement if election ended */}
                  {(() => {
                    const election = elections.find((e) => e.id === selectedElectionId)
                    if (!election) return null
                    const now = new Date()
                    const end = new Date(election.endDate)
                    if (now > end) {
                      const winner = getWinner(election)
                      return (
                        <div className="mt-4 p-3 bg-green-900/60 border border-green-500/30 rounded-lg text-green-200 text-center font-bold">
                          Winner: {winner ? winner.name : "No winner (tie or no votes)"}
                        </div>
                      )
                    }
                    return null
                  })()}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900/80 border-t border-purple-500/20 py-5">
        <div className="container mx-auto px-4 max-w-xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-2">
            <div className="text-lg font-extrabold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              D-VOTE
            </div>
            <nav className="flex gap-4">
              <a href="#" className="text-gray-300 hover:text-white text-sm font-semibold transition-colors duration-200">
                About
              </a>
              <a href="#" className="text-gray-300 hover:text-white text-sm font-semibold transition-colors duration-200">
                Privacy Policy
              </a>
              <a href="#" className="text-gray-300 hover:text-white text-sm font-semibold transition-colors duration-200">
                Contact Us
              </a>
            </nav>
            <div className="flex gap-4">
              <a href="#" className="text-gray-400 hover:text-white transition-all duration-200 hover:scale-110" title="Twitter">
                <Twitter className="w-4 h-4" />
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition-all duration-200 hover:scale-110" title="LinkedIn">
                <Linkedin className="w-4 h-4" />
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition-all duration-200 hover:scale-110" title="GitHub">
                <Github className="w-4 h-4" />
              </a>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-purple-500/20 text-center text-gray-400 text-xs">
            © 2025 D-VOTE. All rights reserved. Powered by blockchain technology.
          </div>
        </div>
      </footer>
    </div>
  )
}
        
