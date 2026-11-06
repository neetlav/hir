// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
/// @notice Metadata asset for the isolated demo. No minting or payment flow is provided.
contract LocalDemoToken is ERC20 {
    constructor() ERC20("HIR Local Unit", "HUSD") {}
    function decimals() public pure override returns (uint8) { return 6; }
}
