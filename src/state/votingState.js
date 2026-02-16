// Shared voting enabled state for all controllers
let votingEnabled = true;

export function setVotingStatus(enabled) {
  votingEnabled = !!enabled;
}

export function getVotingStatus() {
  return votingEnabled;
}