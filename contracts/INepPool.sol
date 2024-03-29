// SPDX-License-Identifier: BUSL-1.1
pragma solidity >=0.4.22 <0.9.0;

interface INepPool {
  struct Liquidity {
    string name;
    uint256 maxStake;
    uint256 nepUnitPerTokenUnitPerBlock;
    uint256 entryFee; // Percentage value: upto 4 decimal places, x10000
    uint256 exitFee; // Percentage value: upto 4 decimal places, x10000
    uint256 lockingPeriod;
    uint256 totalLocked;
    uint256 totalNepRewarded;
    uint256 minStakingPeriodInBlocks;
  }

  event Deposit(address indexed token, address indexed account, uint256 amount);
  event RewardsWithdrawn(address indexed token, address indexed account, uint256 amount);
  event Withdrawn(address indexed token, address indexed account, uint256 amount);

  /**
   * @dev Gets the total number of NEP allocated to be distributed as reward
   */
  function _totalRewardAllocation() external view returns (uint256);

  /**
   * @dev Gets the number of NEP tokens in this farm allocated to be distributed as reward
   * @param token Provide the token address to get the reward allocation
   */
  function _rewardAllocation(address token) external view returns (uint256);

  /**
   * @dev Gets the remaining number of NEP tokens in this farm to be distributed as reward
   * @param token Provide the token address to get the remaining rewards
   */
  function _remainingNEPRewards(address token) external view returns (uint256);

  /**
   * @dev Gets the number of blocks since last rewards
   * @param token Provide the token address to get the blocks
   * @param account Provide an address to get the blocks
   */
  function getTotalBlocksSinceLastReward(address token, address account) external view returns (uint256);

  /**
   * @dev Calculates the NEP rewards accumulated on the `account`
   * @param token Provide the token address to get the rewards
   * @param account Provide an address to get the rewards
   */
  function calculateRewards(address token, address account) external view returns (uint256);

  /**
   * @dev Reports the remaining amount of CAKE that can be farmed here
   */
  function getRemainingToStake(address token) external view returns (uint256);

  /**
   * @dev Returns the total tokens locked in the pool
   */
  function getTotalLocked(address token) external view returns (uint256);

  /**
   * @dev Returns the entry fee of the given token for the given amount
   */
  function getEntryFeeFor(address token, uint256 amount) external view returns (uint256);

  /**
   * @dev Returns the exit fee of the given token for the given amount
   */
  function getExitFeeFor(address token, uint256 amount) external view returns (uint256);

  /**
   * @dev Returns the total CAKE staked in this farm
   * @param account Provide account to check
   */
  function totalStaked(address token, address account) external view returns (uint256);

  /**
   * @dev Reports when an account can withdraw their staked balance
   * @param token Provide the token address
   * @param account Provide an account
   */
  function canWithdrawFrom(address token, address account) external view returns (uint256);

  /**
   * @dev Gets the summary of the given token farm for the gven account
   * @param token The farm token in the pool
   * @param account Account to obtain summary of
   * @param values[0] rewards Your pending rewards
   * @param values[1] staked Your liquidity token balance
   * @param values[2] nepPerTokenPerBlock NEP token per liquidity token unit per block
   * @param values[3] totalTokensLocked Total liquidity token locked
   * @param values[4] totalNepLocked Total NEP locked
   * @param values[5] maxToStake Total tokens to be staked
   * @param values[6] myNepRewards Sum of NEP rewareded to the account in this farm
   * @param values[7] totalNepRewards Sum of all NEP rewarded in this farm
   * @param values[8] remainingNEPRewards Remaining NEP in this farm
   */
  function getInfo(address token, address account) external view returns (uint256[] memory values);

  /**
   * @dev Returns the total NEP locked in this farm
   */
  function getTotalNEPLocked() external view returns (uint256);

  /**
   * @dev Allows depositing CAKE to enter into farming.
   * The rewards are finite and constant amount of NEP/CAKE/block.
   *
   * There is a maximum limit of CAKE which can be staked in this smart contract
   * based on first come first serve basis.
   * @param amount The amount to deposit to this farm.
   */
  function deposit(address token, uint256 amount) external;

  /**
   * @dev Withdraws the specified amount of staked CAKE from the farm.
   *
   * To avoid spams, the withdrawal can only be unlocked
   *  after 259200 blocks since the last deposit (equivalent to 24 hours).
   * @param amount Amount to withdraw.
   */
  function withdraw(address token, uint256 amount) external;

  /**
   * @dev Withdraws the sender's NEP rewards accumulated
   */
  function withdrawRewards(address token) external;
}
