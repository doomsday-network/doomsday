// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Wrapped DOOM (wDOOM)
 * @dev 1:1 Backed Decentralized ERC-20 Representation of Native DOOM for EVM Chains (Base, Ethereum, Arbitrum)
 * Facilitates decentralized liquidity pools (Uniswap v3 wDOOM/USDC, wDOOM/ETH) and fiat off-ramps.
 */

interface IERC20 {
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 value) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}

interface IERC20Metadata is IERC20 {
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
}

abstract contract Context {
    function _msgSender() internal view virtual returns (address) {
        return msg.sender;
    }

    function _msgData() internal view virtual returns (bytes calldata) {
        return msg.data;
    }
}

abstract contract Ownable is Context {
    address private _owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    constructor(address initialOwner) {
        require(initialOwner != address(0), "Ownable: new owner is zero address");
        _transferOwnership(initialOwner);
    }

    function owner() public view virtual returns (address) {
        return _owner;
    }

    modifier onlyOwner() {
        _checkOwner();
        _;
    }

    function _checkOwner() internal view virtual {
        require(owner() == _msgSender(), "Ownable: caller is not owner");
    }

    function transferOwnership(address newOwner) public virtual onlyOwner {
        require(newOwner != address(0), "Ownable: new owner is zero address");
        _transferOwnership(newOwner);
    }

    function _transferOwnership(address newOwner) internal virtual {
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}

contract WrappedDOOM is Context, IERC20, IERC20Metadata, Ownable {
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    uint256 private _totalSupply;
    string private _name;
    string private _symbol;

    // Authorized Bridge Daemon Relayers
    mapping(address => bool) public isBridgeRelayer;

    // Processed Native Transactions to prevent double-minting
    mapping(string => bool) public processedDoomsdayTxs;

    // Total Native DOOM held in 1:1 Proof-of-Reserve Vault
    string public constant NATIVE_VAULT_ADDRESS = "doom1vault000000000000000000000000000000";

    event BridgeRelayerSet(address indexed relayer, bool status);
    event BridgedFromNative(address indexed to, uint256 amount, string doomsdayTxId);
    event BridgedToNative(address indexed from, uint256 amount, string doomsdayAddress);

    modifier onlyBridge() {
        require(isBridgeRelayer[_msgSender()] || owner() == _msgSender(), "wDOOM: caller is not bridge relayer");
        _;
    }

    constructor(address initialOwner) Ownable(initialOwner) {
        _name = "Wrapped DOOM";
        _symbol = "wDOOM";
        isBridgeRelayer[initialOwner] = true;
        emit BridgeRelayerSet(initialOwner, true);
    }

    function name() public view virtual override returns (string memory) {
        return _name;
    }

    function symbol() public view virtual override returns (string memory) {
        return _symbol;
    }

    function decimals() public view virtual override returns (uint8) {
        return 18;
    }

    function totalSupply() public view virtual override returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) public view virtual override returns (uint256) {
        return _balances[account];
    }

    function transfer(address to, uint256 value) public virtual override returns (bool) {
        address ownerAddr = _msgSender();
        _transfer(ownerAddr, to, value);
        return true;
    }

    function allowance(address ownerAddr, address spender) public view virtual override returns (uint256) {
        return _allowances[ownerAddr][spender];
    }

    function approve(address spender, uint256 value) public virtual override returns (bool) {
        address ownerAddr = _msgSender();
        _approve(ownerAddr, spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) public virtual override returns (bool) {
        address spender = _msgSender();
        _spendAllowance(from, spender, value);
        _transfer(from, to, value);
        return true;
    }

    function setBridgeRelayer(address relayer, bool status) external onlyOwner {
        require(relayer != address(0), "Invalid relayer");
        isBridgeRelayer[relayer] = status;
        emit BridgeRelayerSet(relayer, status);
    }

    /**
     * @notice Mint wDOOM when native DOOM is deposited into the 1:1 reserve vault on Doomsday Network
     * @param to EVM address to receive the minted wDOOM
     * @param amount Token amount in 18 decimals (1 DOOM = 1e18 wDOOM)
     * @param doomsdayTxId Native blockchain transaction ID
     */
    function mintFromNative(
        address to,
        uint256 amount,
        string calldata doomsdayTxId
    ) external onlyBridge {
        require(!processedDoomsdayTxs[doomsdayTxId], "wDOOM: transaction already processed");
        require(to != address(0), "wDOOM: mint to zero address");

        processedDoomsdayTxs[doomsdayTxId] = true;
        _mint(to, amount);

        emit BridgedFromNative(to, amount, doomsdayTxId);
    }

    /**
     * @notice Burn wDOOM to withdraw native DOOM back to a native Doomsday Network address (doom1...)
     * @param amount Amount of wDOOM to burn
     * @param doomsdayRecipientAddress Native Base58Check address to receive unlocked DOOM
     */
    function burnToNative(uint256 amount, string calldata doomsdayRecipientAddress) external {
        require(bytes(doomsdayRecipientAddress).length >= 35, "wDOOM: invalid native address length");
        require(bytes(doomsdayRecipientAddress)[0] == 'd' && 
                bytes(doomsdayRecipientAddress)[1] == 'o' && 
                bytes(doomsdayRecipientAddress)[2] == 'o' && 
                bytes(doomsdayRecipientAddress)[3] == 'm' && 
                bytes(doomsdayRecipientAddress)[4] == '1', 
                "wDOOM: address must start with doom1");

        _burn(_msgSender(), amount);
        emit BridgedToNative(_msgSender(), amount, doomsdayRecipientAddress);
    }

    function _transfer(address from, address to, uint256 value) internal virtual {
        require(from != address(0), "ERC20: transfer from zero address");
        require(to != address(0), "ERC20: transfer to zero address");

        uint256 fromBalance = _balances[from];
        require(fromBalance >= value, "ERC20: transfer amount exceeds balance");
        unchecked {
            _balances[from] = fromBalance - value;
            _balances[to] += value;
        }

        emit Transfer(from, to, value);
    }

    function _mint(address account, uint256 value) internal virtual {
        require(account != address(0), "ERC20: mint to zero address");

        _totalSupply += value;
        unchecked {
            _balances[account] += value;
        }
        emit Transfer(address(0), account, value);
    }

    function _burn(address account, uint256 value) internal virtual {
        require(account != address(0), "ERC20: burn from zero address");

        uint256 accountBalance = _balances[account];
        require(accountBalance >= value, "ERC20: burn amount exceeds balance");
        unchecked {
            _balances[account] = accountBalance - value;
            _totalSupply -= value;
        }

        emit Transfer(account, address(0), value);
    }

    function _approve(address ownerAddr, address spender, uint256 value) internal virtual {
        require(ownerAddr != address(0), "ERC20: approve from zero address");
        require(spender != address(0), "ERC20: approve to zero address");

        _allowances[ownerAddr][spender] = value;
        emit Approval(ownerAddr, spender, value);
    }

    function _spendAllowance(address ownerAddr, address spender, uint256 value) internal virtual {
        uint256 currentAllowance = allowance(ownerAddr, spender);
        if (currentAllowance != type(uint256).max) {
            require(currentAllowance >= value, "ERC20: insufficient allowance");
            unchecked {
                _approve(ownerAddr, spender, currentAllowance - value);
            }
        }
    }
}
