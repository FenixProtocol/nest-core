// SPDX-License-Identifier: MIT
pragma solidity =0.8.19;

contract SelfDestructSenderMock {
    constructor(address payable recipient_) payable {
        selfdestruct(recipient_);
    }
}
