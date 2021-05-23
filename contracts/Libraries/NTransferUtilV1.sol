// SPDX-License-Identifier: BUSL-1.1
pragma solidity >=0.4.22 <0.9.0;
import "openzeppelin-solidity/contracts/utils/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";

library NTransferUtilV1 {
  using SafeMath for uint256;

  function safeTransfer(
    IERC20 malicious,
    address recipient,
    uint256 amount
  ) public {
    require(recipient != address(0), "Invalid recipient");
    require(amount > 0, "Invalid transfer amount");

    uint256 pre = malicious.balanceOf(recipient);
    malicious.transfer(recipient, amount);
    uint256 post = malicious.balanceOf(recipient);

    require(post.sub(pre) == amount, "Invalid transfer");
  }

  function safeTransferFrom(
    IERC20 malicious,
    address sender,
    address recipient,
    uint256 amount
  ) public {
    require(recipient != address(0), "Invalid recipient");
    require(amount > 0, "Invalid transfer amount");

    uint256 pre = malicious.balanceOf(recipient);
    malicious.transferFrom(sender, recipient, amount);
    uint256 post = malicious.balanceOf(recipient);

    require(post.sub(pre) == amount, "Invalid transfer");
  }
}
