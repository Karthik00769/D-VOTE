
pragma solidity ^0.8.20;

contract DVote {
    struct Voter {
        bool isRegistered;
        bool hasVoted;
        uint256 voteChoice; // Index of the candidate voted for
    }

    struct Election {
        string title;
        string purpose;
        uint256 startDate;
        uint256 endDate;
        address creator;
        string[] candidates;
        mapping(address => Voter) voters;
        uint256[] voteCounts; // Tally for each candidate
        bool isActive;
    }

    mapping(uint256 => Election) public elections;
    uint256 public electionCount;

    event ElectionCreated(uint256 electionId, string title, address creator);
    event VoterAdded(uint256 electionId, address voter);
    event VoteCast(uint256 electionId, address voter, uint256 candidateIndex);
    event ElectionEnded(uint256 electionId);

    modifier onlyCreator(uint256 _electionId) {
        require(msg.sender == elections[_electionId].creator, "Not the election creator");
        _;
    }

    modifier electionActive(uint256 _electionId) {
        require(elections[_electionId].isActive, "Election is not active");
        require(block.timestamp >= elections[_electionId].startDate, "Election has not started");
        require(block.timestamp <= elections[_electionId].endDate, "Election has ended");
        _;
    }

    function createElection(
        string memory _title,
        string memory _purpose,
        uint256 _startDate,
        uint256 _endDate,
        string[] memory _candidateNames
    ) external {
        require(_startDate > block.timestamp, "Start date must be in the future");
        require(_endDate > _startDate, "End date must be after start date");
        require(_candidateNames.length >= 2, "At least 2 candidates required");

        electionCount++;
        Election storage election = elections[electionCount];
        election.title = _title;
        election.purpose = _purpose;
        election.startDate = _startDate;
        election.endDate = _endDate;
        election.creator = msg.sender;
        election.candidates = _candidateNames;
        election.isActive = true;

        // Initialize vote counts for each candidate
        for (uint256 i = 0; i < _candidateNames.length; i++) {
            election.voteCounts.push(0);
        }

        emit ElectionCreated(electionCount, _title, msg.sender);
    }

    function addVoter(uint256 _electionId, address _voter) external onlyCreator(_electionId) {
        require(_electionId <= electionCount && _electionId != 0, "Invalid election ID");
        require(!elections[_electionId].voters[_voter].isRegistered, "Voter already registered");

        elections[_electionId].voters[_voter] = Voter({
            isRegistered: true,
            hasVoted: false,
            voteChoice: 0
        });

        emit VoterAdded(_electionId, _voter);
    }

    function castVote(uint256 _electionId, uint256 _candidateIndex) external electionActive(_electionId) {
        Voter storage voter = elections[_electionId].voters[msg.sender];
        require(voter.isRegistered, "Not registered to vote");
        require(!voter.hasVoted, "Already voted");
        require(_candidateIndex < elections[_electionId].candidates.length, "Invalid candidate");

        voter.hasVoted = true;
        voter.voteChoice = _candidateIndex;
        elections[_electionId].voteCounts[_candidateIndex]++;

        emit VoteCast(_electionId, msg.sender, _candidateIndex);
    }

    function endElection(uint256 _electionId) external onlyCreator(_electionId) {
        require(_electionId <= electionCount && _electionId != 0, "Invalid election ID");
        require(elections[_electionId].isActive, "Election already ended");

        elections[_electionId].isActive = false;
        emit ElectionEnded(_electionId);
    }

    function getElectionDetails(uint256 _electionId) external view returns (
        string memory title,
        string memory purpose,
        uint256 startDate,
        uint256 endDate,
        address creator,
        string[] memory candidates,
        uint256[] memory voteCounts,
        bool isActive
    ) {
        require(_electionId <= electionCount && _electionId != 0, "Invalid election ID");
        Election storage election = elections[_electionId];
        return (
            election.title,
            election.purpose,
            election.startDate,
            election.endDate,
            election.creator,
            election.candidates,
            election.voteCounts,
            election.isActive
        );
    }

    function getVoterStatus(uint256 _electionId, address _voter) external view returns (
        bool isRegistered,
        bool hasVoted,
        uint256 voteChoice
    ) {
        require(_electionId <= electionCount && _electionId != 0, "Invalid election ID");
        Voter storage voter = elections[_electionId].voters[_voter];
        return (voter.isRegistered, voter.hasVoted, voter.voteChoice);
    }
}
