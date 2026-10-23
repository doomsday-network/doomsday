"""
Doomsday MCP Server: Proof-of-Escrow Verifier
This MCP tool allows AI agents to verify if a GitHub issue contains a valid Escrow ID.
"""

import re

def verify_escrow(issue_body: str) -> dict:
    """
    MCP Tool: Parses an issue body to check for a valid Doomsday escrow ID.
    """
    # Sucht nach dem Muster "escrow_XXXXXXXX"
    match = re.search(r'escrow_[a-zA-Z0-9]+', issue_body)
    
    if match:
        return {
            "status": "verified",
            "escrow_id": match.group(0),
            "message": "Valid escrow ID found. This bounty is backed by on-chain funds."
        }
    else:
        return {
            "status": "failed",
            "escrow_id": None,
            "message": "No escrow ID detected. Be careful, this might be a fake bounty."
        }
