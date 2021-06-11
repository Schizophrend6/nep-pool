// SPDX-License-Identifier: BUSL-1.1
pragma solidity >=0.4.22 <0.9.0;
import "openzeppelin-solidity/contracts/access/Ownable.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";

abstract contract Recoverable is Ownable {
  /**
   * @dev Recover all Ether held by the contract to the owner.
   */
  function recoverEther() external onlyOwner {
    address owner = super.owner();

    // slither-disable-next-line arbitrary-send
    payable(owner).transfer(address(this).balance);
  }

  /**
   * @dev Recover all BEP-20 compatible tokens sent to this address.
   * @param token BEP-20 The address of the token contract
   */
  function recoverToken(address token) external onlyOwner {
    address owner = super.owner();
    IERC20 bep20 = IERC20(token);

    uint256 balance = bep20.balanceOf(address(this));
    require(bep20.transfer(owner, balance), "Transfer failed");
  }
}
