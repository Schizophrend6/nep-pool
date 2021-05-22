// SPDX-License-Identifier: BUSL-1.1
pragma solidity >=0.4.22 <0.9.0;
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "../Libraries/NTransferUtilV1.sol";

contract NTransferUtilV1Intermediate {
  using NTransferUtilV1 for IERC20;
  
  function iTransfer(IERC20 token, address recipient, uint256 amount) external {
    token.safeTransfer(recipient, amount);
  }
  
  function iTransferFrom(IERC20 token, address sender, address recipient, uint256 amount) external {
    token.safeTransferFrom(sender, recipient, amount);
  }  
}
