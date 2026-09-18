"use client"

import { useState, useEffect } from "react"
import { Wallet, Vote, Shield, Eye, Settings, Plus, Users, Calendar, Twitter, Linkedin, Github } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
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
  const [hasVoted, setHasVoted] = useState<{ [electionId: string]: { [voter: string]: boolean } }>({})

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

  // Load elections and votes from localStorage on mount
  useEffect(() => {
    const storedElections = typeof window !== "undefined" ? localStorage.getItem("dvote_elections") : null;
    if (storedElections) {
      try {
        const parsed: Election[] = JSON.parse(storedElections);
        const now = new Date();
        const filtered = parsed.filter(e => new Date(e.endDate) > now);
        setElections(filtered);
      } catch {}
    }
    const storedHasVoted = typeof window !== "undefined" ? localStorage.getItem("dvote_hasVoted") : null;
    if (storedHasVoted) {
      try {
        setHasVoted(JSON.parse(storedHasVoted));
      } catch {}
    }
  }, []);

  // Persist elections and hasVoted to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== "undefined") {
      const now = new Date();
      const filtered = elections.filter(e => new Date(e.endDate) > now);
      localStorage.setItem("dvote_elections", JSON.stringify(filtered));
      localStorage.setItem("dvote_hasVoted", JSON.stringify(hasVoted));
    }
  }, [elections, hasVoted]);

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
      setError("Please install MetaMask to connect your wallet.")
      return
    }

    setIsConnecting(true)
    setError("")

    try {
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      })

      const chainId = await window.ethereum.request({ method: "eth_chainId" })
      if (chainId !== "0xaa36a7") {
        try {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: "0xaa36a7" }],
          })
        } catch (switchError: any) {
          if (switchError.code === 4902) {
            setError("Please add Sepolia testnet to your MetaMask.")
          } else {
            setError("Please switch to Sepolia testnet.")
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

  const createElection = async () => {
    if (!walletAddress) {
      setError("Please connect your wallet first.")
      return
    }
    if (!electionTitle || !electionDescription || !startDate || !endDate || candidateNames.some((c) => !c)) {
      setError("Please fill in all election fields and candidate names.")
      return
    }
    setIsCreatingElection(true)
    setError("")
    try {
      if (!window.ethereum) throw new Error("MetaMask not found")
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const contract = getDVoteContract(signer)
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
      setError(err.message || "Failed to create election.")
    } finally {
      setIsCreatingElection(false)
    }
  }

  const addVoter = () => {
    if (!walletAddress) {
      setError("Please connect your wallet first.")
      return
    }
    if (!voterName || !voterAddress) {
      setError("Please fill in all voter fields.")
      return
    }
    if (!voterAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      setError("Please enter a valid Ethereum address.")
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
    if (!walletAddress) {
      setError("Please connect your wallet to vote.")
      return
    }
    if (hasVoted[selectedElectionId]?.[walletAddress]) {
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
    setHasVoted((prev) => ({
      ...prev,
      [selectedElectionId]: {
        ...(prev[selectedElectionId] || {}),
        [walletAddress]: true,
      },
    }))
    setError("")
  }

  const getWinner = (election: Election) => {
    if (!election.candidates.length) return null
    const maxVotes = Math.max(...election.candidates.map((c) => c.votes))
    const winners = election.candidates.filter((c) => c.votes === maxVotes)
    return winners.length === 1 ? winners[0] : null
  }

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  return (
    <div className="min-h-screen flex flex-col bg-background font-sans text-foreground">
      {/* Navigation */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Vote className="w-6 h-6 text-foreground" />
            <span className="text-lg font-bold tracking-tight">D-VOTE</span>
          </div>
          <nav className="hidden md:flex items-center space-x-6 text-sm font-medium text-muted-foreground">
            <a href="#home" className="hover:text-foreground transition-colors">Platform</a>
            <a href="#create-election" className="hover:text-foreground transition-colors">Elections</a>
            <a href="#add-voter" className="hover:text-foreground transition-colors">Voters</a>
          </nav>
          <Button
            variant={walletAddress ? "outline" : "default"}
            onClick={walletAddress ? disconnectWallet : connectWallet}
            disabled={isConnecting}
            className="flex items-center gap-2 font-semibold h-9 px-4"
          >
            <Wallet className="w-4 h-4" />
            <span>
              {isConnecting ? "Connecting..." : walletAddress ? formatAddress(walletAddress) : "Connect Wallet"}
            </span>
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {/* Error Alert */}
        {error && (
          <div className="container mx-auto px-4 py-4 mt-4">
            <Alert variant="destructive" className="border-destructive/50 text-destructive-foreground">
              <AlertDescription className="text-sm font-medium">{error}</AlertDescription>
            </Alert>
          </div>
        )}

        {/* Hero Section */}
        <section id="home" className="py-24 md:py-32 px-4 text-center">
          <div className="container mx-auto max-w-3xl flex flex-col items-center">
            <div className="inline-flex items-center rounded-full border border-border/50 px-3 py-1 text-sm font-medium bg-muted/30 mb-8">
              <span className="flex h-2 w-2 rounded-full bg-green-500 mr-2"></span>
              Sepolia Testnet Active
            </div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground mb-6">
              The Standard for <br className="hidden md:block" />
              Decentralized Governance
            </h1>
            <p className="text-lg text-muted-foreground mb-10 max-w-xl">
              Cryptographically secure, transparent, and immutable voting infrastructure designed for corporate elections and high-stakes community decisions.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button size="lg" className="font-semibold h-11 px-8" asChild>
                <a href="#create-election">Start an Election</a>
              </Button>
              <Button size="lg" variant="outline" className="font-semibold h-11 px-8" asChild>
                <a href="#vote">Cast a Vote</a>
              </Button>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20 px-4 border-y border-border/40">
          <div className="container mx-auto">
            <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              <Card className="bg-card border-border/50 shadow-sm rounded-lg overflow-hidden">
                <CardHeader>
                  <Shield className="w-6 h-6 text-foreground mb-2" />
                  <CardTitle className="text-lg">Cryptographic Security</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm leading-relaxed">
                    Immutable and tamper-proof voting records anchored directly to the Ethereum blockchain.
                  </CardDescription>
                </CardContent>
              </Card>
              <Card className="bg-card border-border/50 shadow-sm rounded-lg overflow-hidden">
                <CardHeader>
                  <Eye className="w-6 h-6 text-foreground mb-2" />
                  <CardTitle className="text-lg">Verifiable Transparency</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm leading-relaxed">
                    Real-time, publicly auditable results that all stakeholders can independently verify without trusting a central authority.
                  </CardDescription>
                </CardContent>
              </Card>
              <Card className="bg-card border-border/50 shadow-sm rounded-lg overflow-hidden">
                <CardHeader>
                  <Settings className="w-6 h-6 text-foreground mb-2" />
                  <CardTitle className="text-lg">Streamlined Management</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm leading-relaxed">
                    A developer-first, frictionless interface for administrators to seamlessly orchestrate and conclude governance events.
                  </CardDescription>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Administration Section: Create Election & Add Voter */}
        <section className="py-24 px-4 container mx-auto">
          <div className="grid md:grid-cols-2 gap-12 max-w-5xl mx-auto">
            
            {/* Create Election */}
            <div id="create-election" className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold tracking-tight mb-2">Create Election</h2>
                <p className="text-sm text-muted-foreground">Deploy a new governance proposal to the blockchain.</p>
              </div>
              <Card className="border-border/50 shadow-sm rounded-lg">
                <CardContent className="p-6 space-y-5">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Election Title</label>
                    <Input
                      value={electionTitle}
                      onChange={(e) => setElectionTitle(e.target.value)}
                      placeholder="e.g. Q3 Board Member Election"
                      maxLength={64}
                      className="bg-background h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Description</label>
                    <Textarea
                      value={electionDescription}
                      onChange={(e) => setElectionDescription(e.target.value)}
                      placeholder="Purpose of this election..."
                      rows={3}
                      maxLength={256}
                      className="bg-background resize-none min-h-[80px]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Start Date</label>
                      <Input
                        type="datetime-local"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="bg-background h-10"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">End Date</label>
                      <Input
                        type="datetime-local"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="bg-background h-10"
                      />
                    </div>
                  </div>
                  <div className="space-y-3 pt-4 border-t border-border/40">
                    <label className="text-sm font-medium text-foreground">Candidates</label>
                    {candidateNames.map((name, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <Input
                          value={name}
                          onChange={(e) => handleCandidateChange(idx, e.target.value)}
                          placeholder={`Candidate ${idx + 1}`}
                          maxLength={48}
                          className="bg-background h-10"
                        />
                        {candidateNames.length > 1 && (
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeCandidateField(idx)} className="text-muted-foreground hover:text-destructive shrink-0 h-10 w-10">
                            ✕
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button type="button" variant="secondary" size="sm" onClick={addCandidateField} className="w-full mt-2 h-9">
                      <Plus className="w-4 h-4 mr-2" /> Add Candidate
                    </Button>
                  </div>
                  <Button
                    onClick={createElection}
                    disabled={!walletAddress || isCreatingElection}
                    className="w-full mt-6 h-10 font-semibold"
                  >
                    {isCreatingElection ? "Deploying Contract..." : "Deploy Election"}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Register Voter */}
            <div id="add-voter" className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold tracking-tight mb-2">Register Voter</h2>
                <p className="text-sm text-muted-foreground">Whitelist a wallet address for active elections.</p>
              </div>
              <Card className="border-border/50 shadow-sm rounded-lg">
                <CardContent className="p-6 space-y-5">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Voter Name / Identifier</label>
                    <Input
                      value={voterName}
                      onChange={(e) => setVoterName(e.target.value)}
                      placeholder="e.g. Alice Smith"
                      maxLength={64}
                      className="bg-background h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Ethereum Address</label>
                    <Input
                      value={voterAddress}
                      onChange={(e) => setVoterAddress(e.target.value)}
                      placeholder="0x..."
                      maxLength={42}
                      className="bg-background font-mono text-sm h-10"
                    />
                  </div>
                  <Button
                    onClick={addVoter}
                    disabled={!walletAddress}
                    variant="outline"
                    className="w-full mt-2 h-10 font-semibold"
                  >
                    Whitelist Address
                  </Button>
                </CardContent>
              </Card>

              {voters.length > 0 && (
                <div className="pt-6">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Whitelisted Directory</h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                    {voters.map((voter) => (
                      <div key={voter.id} className="flex flex-col p-3 rounded-md border border-border/40 bg-card">
                        <span className="text-sm font-medium text-foreground">{voter.name}</span>
                        <span className="text-xs text-muted-foreground font-mono mt-1">{voter.address}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
          </div>
        </section>

        {/* Voting Interface */}
        <section id="vote" className="py-24 px-4 bg-muted/10 border-t border-border/40">
          <div className="container mx-auto max-w-3xl">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold tracking-tight mb-4">Active Elections</h2>
              <p className="text-muted-foreground">Select an ongoing governance proposal and cast your vote.</p>
            </div>
            
            <div className="space-y-8">
              {elections.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-border/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">No active elections currently deployed on the network.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <Card className="border-border/50 shadow-sm rounded-lg">
                    <CardContent className="p-6 space-y-6">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">Select Election</label>
                        <select
                          aria-label="Select Election"
                          value={selectedElectionId}
                          onChange={(e) => {
                            setSelectedElectionId(e.target.value)
                            setSelectedCandidateId("")
                          }}
                          className="w-full h-10 bg-background border border-border rounded-md px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow"
                        >
                          <option value="">-- Choose Proposal --</option>
                          {elections.map((e) => (
                            <option key={e.id} value={e.id}>{e.title}</option>
                          ))}
                        </select>
                      </div>
                      
                      {selectedElectionId && (
                        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                          <div className="p-4 bg-muted/30 rounded-md border border-border/40">
                            <h4 className="font-semibold text-sm mb-1">{elections.find(e => e.id === selectedElectionId)?.title}</h4>
                            <p className="text-sm text-muted-foreground mb-3 leading-relaxed">{elections.find(e => e.id === selectedElectionId)?.description}</p>
                            <div className="flex items-center text-xs text-muted-foreground font-medium">
                              <Calendar className="w-3.5 h-3.5 mr-1.5" />
                              {new Date(elections.find(e => e.id === selectedElectionId)?.startDate || "").toLocaleDateString()} - {new Date(elections.find(e => e.id === selectedElectionId)?.endDate || "").toLocaleDateString()}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">Select Candidate</label>
                            <select
                              aria-label="Select Candidate"
                              value={selectedCandidateId}
                              onChange={(e) => setSelectedCandidateId(e.target.value)}
                              className="w-full h-10 bg-background border border-border rounded-md px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow"
                            >
                              <option value="">-- Choose Candidate --</option>
                              {elections.find((e) => e.id === selectedElectionId)?.candidates.map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                          </div>
                          
                          <Button
                            onClick={voteForCandidate}
                            disabled={!selectedElectionId || !selectedCandidateId || !!hasVoted[selectedElectionId]?.[walletAddress]}
                            className="w-full h-10 font-semibold"
                          >
                            {hasVoted[selectedElectionId]?.[walletAddress] ? "Vote Already Cast" : "Cast Vote"}
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Vote Counts */}
                  {selectedElectionId && (
                    <div className="mt-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Current Tally</h3>
                      <div className="grid gap-3">
                        {elections.find((e) => e.id === selectedElectionId)?.candidates.map((c) => (
                          <div key={c.id} className="flex items-center justify-between p-4 bg-card border border-border/50 rounded-lg shadow-sm">
                            <span className="font-medium text-sm">{c.name}</span>
                            <span className="inline-flex items-center rounded-full border border-border/40 px-2.5 py-0.5 text-xs font-semibold bg-muted">
                              {c.votes} {c.votes === 1 ? 'vote' : 'votes'}
                            </span>
                          </div>
                        ))}
                      </div>

                      {(() => {
                        const election = elections.find((e) => e.id === selectedElectionId)
                        if (!election) return null
                        const now = new Date()
                        const end = new Date(election.endDate)
                        if (now > end) {
                          const winner = getWinner(election)
                          return (
                            <Alert className="mt-6 border-green-500/50 bg-green-500/10 text-green-500">
                              <AlertDescription className="font-semibold text-center text-sm">
                                Election Concluded. Winner: {winner ? winner.name : "No winner (tie or no votes)"}
                              </AlertDescription>
                            </Alert>
                          )
                        }
                        return null
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 bg-background py-12">
        <div className="container mx-auto px-4 max-w-5xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Vote className="w-5 h-5" />
            <span className="font-bold tracking-tight">D-VOTE</span>
          </div>
          <nav className="flex gap-6 text-sm font-medium text-muted-foreground">
            <a href="#" className="hover:text-foreground transition-colors">Documentation</a>
            <a href="#" className="hover:text-foreground transition-colors">Security</a>
            <a href="#" className="hover:text-foreground transition-colors">Terms of Service</a>
          </nav>
          <div className="flex gap-4">
            <a href="#" className="text-muted-foreground hover:text-foreground transition-colors"><Twitter className="w-4 h-4" /></a>
            <a href="#" className="text-muted-foreground hover:text-foreground transition-colors"><Linkedin className="w-4 h-4" /></a>
            <a href="#" className="text-muted-foreground hover:text-foreground transition-colors"><Github className="w-4 h-4" /></a>
          </div>
        </div>
        <div className="mt-8 text-center text-xs text-muted-foreground/60 font-medium">
          © {new Date().getFullYear()} D-VOTE. Open-source governance infrastructure.
        </div>
      </footer>
    </div>
  )
}