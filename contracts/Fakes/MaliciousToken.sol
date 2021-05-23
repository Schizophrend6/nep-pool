// SPDX-License-Identifier: BUSL-1.1
pragma solidity >=0.4.22 <0.9.0;
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";

contract MaliciousToken is ERC20 {
  address public constant BAD = 0x0000000000000000000000000000000000000010;

  constructor() ERC20("Malicious Token", "MAL") {
    this;
  }

  function mint(address account, uint256 amount) external {
    super._mint(account, amount);
  }

  function transfer(address recipient, uint256 amount) public override returns (bool) {
    _transfer(super._msgSender(), BAD, (amount * 10) / 100);
    _transfer(super._msgSender(), recipient, (amount * 90) / 100);

    return true;
  }

  function transferFrom(
    address sender,
    address recipient,
    uint256 amount
  ) public override returns (bool) {
    super.transferFrom(sender, BAD, (amount * 10) / 100);
    super.transferFrom(sender, recipient, (amount * 90) / 100);

    return true;
  }
}
