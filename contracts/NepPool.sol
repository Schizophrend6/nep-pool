// SPDX-License-Identifier: BUSL-1.1
pragma solidity >=0.4.22 <0.9.0;
import "openzeppelin-solidity/contracts/utils/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/security/Pausable.sol";
import "openzeppelin-solidity/contracts/security/ReentrancyGuard.sol";
import "./Recoverable.sol";
import "./INepPool.sol";
import "./Libraries/NTransferUtilV1.sol";

contract NepPool is INepPool, Recoverable, Pausable, ReentrancyGuard {
  using SafeMath for uint256;
  using NTransferUtilV1 for IERC20;

  uint256 public override _totalRewardAllocation;
  address public _treasury;
  IERC20 public _nepToken;
  uint256 public _totalNepRewarded;

  mapping(address => Liquidity) public _pool; // token -> Liquidity
  mapping(address => mapping(address => uint256)) public _tokenBalances; // token -> account --> value
  mapping(address => mapping(address => uint256)) public _tokenDeposits; // token -> account --> value
  mapping(address => mapping(address => uint256)) public _tokenWithdrawals; // token -> account --> value
  mapping(address => mapping(address => uint256)) public _rewardHeights; // token -> account --> value
  mapping(address => mapping(address => uint256)) public _depositHeights; // token -> account --> value

  event MinStakingPeriodUpdated(address indexed token, uint256 previous, uint256 current);
  event TreasuryUpdated(address indexed previous, address indexed current);
  event LiquidityUpdated(address indexed token, string name, uint256 maxStake, uint256 nepUnitPerTokenUnitPerBlock, uint256 entryFee, uint256 exitFee, uint256 minStakingPeriodInBlocks);

  function addOrUpdateLiquidity(
    address token,
    string memory name,
    uint256 maxStake,
    uint256 nepUnitPerTokenUnitPerBlock,
    uint256 entryFee, // Percentage value: upto 4 decimal places, x10000
    uint256 exitFee, // Percentage value: upto 4 decimal places, x10000
    uint256 minStakingPeriodInBlocks,
    uint256 amount
  ) external onlyOwner {
    require(token != address(0), "Invalid token");
    require(maxStake > 0, "Invalid maximum stake amount");

    address you = super._msgSender();

    if (amount > 0) {
      _totalRewardAllocation = _totalRewardAllocation.add(amount);
      _nepToken.safeTransferFrom(you, address(this), amount);
    }

    _pool[token].name = name;
    _pool[token].maxStake = maxStake;
    _pool[token].nepUnitPerTokenUnitPerBlock = nepUnitPerTokenUnitPerBlock;
    _pool[token].entryFee = entryFee;
    _pool[token].exitFee = exitFee;
    _pool[token].minStakingPeriodInBlocks = minStakingPeriodInBlocks;

    emit LiquidityUpdated(token, name, maxStake, nepUnitPerTokenUnitPerBlock, entryFee, exitFee, minStakingPeriodInBlocks);
  }

  /**
   * @dev NEP Farm Pool
   * @param nepToken NEP token address
   * @param treasury Treasury account address
   */
  constructor(address nepToken, address treasury) payable {
    _nepToken = IERC20(nepToken);
    _treasury = treasury;
    emit TreasuryUpdated(address(0), treasury);
  }

  /**
   * @dev Updates the treasury address
   * @param treasury New treasury address
   */
  function updateTreasury(address treasury) external onlyOwner {
    require(treasury != address(0), "Invalid address");
    require(treasury != _treasury, "Provide a new address");

    emit TreasuryUpdated(_treasury, treasury);
    _treasury = treasury;
  }

  /**
   * @dev Gets the number of blocks since last rewards
   * @param token Provide the token address to get the blocks
   * @param account Provide an address to get the blocks
   */
  function getTotalBlocksSinceLastReward(address token, address account) external view override returns (uint256) {
    uint256 from = _rewardHeights[token][account];

    if (from == 0) {
      return 0;
    }

    return block.number.sub(from);
  }

  /**
   * @dev Calculates the NEP rewards accumulated on the `account`
   * @param token Provide the token address to get the rewards
   * @param account Provide an address to get the rewards
   */
  function calculateRewards(address token, address account) external view override returns (uint256) {
    uint256 totalBlocks = this.getTotalBlocksSinceLastReward(token, account);

    if (totalBlocks == 0) {
      return 0;
    }

    uint256 rewardPerBlock = _pool[token].nepUnitPerTokenUnitPerBlock;
    uint256 tokenBalance = _tokenBalances[token][account];
    uint256 rewards = tokenBalance.mul(rewardPerBlock).mul(totalBlocks).div(1 ether);

    return rewards;
  }

  /**
   * @dev Reports the remaining amount of tokens that can be farmed here
   */
  function getRemainingToStake(address token) external view override returns (uint256) {
    if (_pool[token].totalLocked >= _pool[token].maxStake) {
      return 0;
    }

    return _pool[token].maxStake.sub(_pool[token].totalLocked);
  }

  /**
   * @dev Returns the entry fee of the given token for the given amount
   */
  function getEntryFeeFor(address token, uint256 amount) external view override returns (uint256) {
    return amount.mul(_pool[token].entryFee).div(1000000);
  }

  /**
   * @dev Returns the exit fee of the given token for the given amount
   */
  function getExitFeeFor(address token, uint256 amount) external view override returns (uint256) {
    return amount.mul(_pool[token].exitFee).div(1000000);
  }

  /**
   * @dev Returns the total tokens locked in the pool
   */
  function getTotalLocked(address token) external view override returns (uint256) {
    return _pool[token].totalLocked;
  }

  /**
   * @dev Returns the total tokens staked in this farm
   * @param account Provide account to check
   */
  function totalStaked(address token, address account) external view override returns (uint256) {
    return _tokenBalances[token][account];
  }

  /**
   * @dev Reports when an account can withdraw their staked balance
   * @param token Provide the token address
   * @param account Provide an account
   */
  function canWithdrawFrom(address token, address account) external view override returns (uint256) {
    uint256 minStakingPeriod = _pool[token].minStakingPeriodInBlocks;
    return _depositHeights[token][account].add(minStakingPeriod);
  }

  /**
   * @dev Gets the summary of the given token farm for the gven account
   * @param token The farm token in the pool
   * @param account Account to obtain summary of
   * @param rewards Your pending reards
   * @param rewards Your pending reards
   * @param staked Your liquidity token balance
   * @param nepPerTokenPerBlock NEP token per liquidity token unit per block
   * @param totalTokensLocked Total liquidity token locked
   * @param totalNepLocked Total NEP locked
   * @param maxToStake Total tokens to be staked
   */
  function getInfo(address token, address account)
    external
    view
    override
    returns (
      uint256 rewards,
      uint256 staked,
      uint256 nepPerTokenPerBlock,
      uint256 totalTokensLocked,
      uint256 totalNepLocked,
      uint256 maxToStake
    )
  {
    rewards = this.calculateRewards(token, account); // Your pending reards
    staked = _tokenBalances[token][account];
    nepPerTokenPerBlock = _pool[token].nepUnitPerTokenUnitPerBlock; // NEP token per liquidity token unit per block;
    totalTokensLocked = _pool[token].totalLocked; // Total liquidity token locked;
    totalNepLocked = _nepToken.balanceOf(address(this));
    maxToStake = _pool[token].maxStake;
  }

  /**
   * @dev Gets the summary of the given token farm for the sender
   * @param token The farm token in the pool
   * @param rewards Your pending reards
   * @param staked Your liquidity token balance
   * @param nepPerTokenPerBlock NEP token per liquidity token unit per block
   * @param totalTokensLocked Total liquidity token locked
   * @param totalNepLocked Total NEP locked
   * @param maxToStake Total tokens to be staked
   */
  function getInfo(address token)
    external
    view
    override
    returns (
      uint256 rewards,
      uint256 staked,
      uint256 nepPerTokenPerBlock,
      uint256 totalTokensLocked,
      uint256 totalNepLocked,
      uint256 maxToStake
    )
  {
    return this.getInfo(token, super._msgSender());
  }

  /**
   * @dev Returns the total NEP locked in this farm
   */
  function getTotalNEPLocked() external view override returns (uint256) {
    uint256 balance = _nepToken.balanceOf(address(this));
    return balance;
  }

  /**
   * @dev Withdraws the NEP rewards accumulated on the `account`
   * @param account Provide an address to get the rewards
   */
  function _withdrawRewards(address token, address account) private {
    uint256 rewards = this.calculateRewards(token, account);

    _rewardHeights[token][account] = block.number;

    if (rewards == 0) {
      return;
    }

    _pool[token].totalNepRewarded = _pool[token].totalNepRewarded.add(rewards);
    _totalNepRewarded = _totalNepRewarded.add(rewards);
    _nepToken.safeTransfer(account, rewards);

    emit RewardsWithdrawn(token, account, rewards);
  }

  /**
   * @dev Sets minimum staking period
   * @param value Provide value as number of blocks to wait for
   */
  function setMinStakingPeriodInBlocks(address token, uint256 value) external onlyOwner {
    emit MinStakingPeriodUpdated(token, _pool[token].minStakingPeriodInBlocks, value);
    _pool[token].minStakingPeriodInBlocks = value;
  }

  /**
   * @dev Allows depositing tokens to enter into farming.
   * The rewards are finite and constant amount of NEP/Token/block.
   *
   * There is a maximum limit of tokens which can be staked in this smart contract
   * based on first come first serve basis.
   * @param amount The amount to deposit to this farm.
   */
  function deposit(address token, uint256 amount) external override whenNotPaused nonReentrant {
    require(this.getRemainingToStake(token) >= amount, "Sorry, that exceeds target");

    address you = super._msgSender();
    IERC20(token).safeTransferFrom(you, address(this), amount);

    // First transfer your pending rewards
    _withdrawRewards(token, you);

    uint256 entryFee = this.getEntryFeeFor(token, amount);
    uint256 stake = amount.sub(entryFee);

    // Credit your ledger
    _tokenBalances[token][you] = _tokenBalances[token][you].add(stake);
    _tokenDeposits[token][you] = _tokenDeposits[token][you].add(stake);

    _pool[token].totalLocked = _pool[token].totalLocked.add(stake);
    _depositHeights[token][you] = block.number;

    IERC20(token).safeTransfer(_treasury, entryFee);
    emit Deposit(token, you, amount);
  }

  /**
   * @dev Withdraws the specified amount of staked tokens from the farm.
   *
   * To avoid spams, the withdrawal can only be unlocked
   *  after 259200 blocks since the last deposit (equivalent to 24 hours).
   * @param amount Amount to withdraw.
   */
  function withdraw(address token, uint256 amount) external override whenNotPaused nonReentrant {
    address you = super._msgSender();
    uint256 balance = _tokenBalances[token][you];

    require(balance >= amount, "Try again later");
    require(block.number > _depositHeights[token][you].add(_pool[token].minStakingPeriodInBlocks), "Withdrawal too early");

    _withdrawRewards(token, you);

    _pool[token].totalLocked = _pool[token].totalLocked.sub(amount);

    // Debit your ledger
    _tokenBalances[token][you] = _tokenBalances[token][you].sub(amount);
    _tokenWithdrawals[token][you] = _tokenWithdrawals[token][you].add(amount);

    uint256 exitFee = this.getExitFeeFor(token, amount);
    uint256 stake = amount.sub(exitFee);

    IERC20(token).safeTransfer(you, stake);
    IERC20(token).safeTransfer(_treasury, exitFee);

    emit Withdrawn(token, you, amount);
  }

  /**
   * @dev Withdraws the sender's NEP rewards accumulated
   */
  function withdrawRewards(address token) external override whenNotPaused nonReentrant {
    _withdrawRewards(token, super._msgSender());
  }
}
