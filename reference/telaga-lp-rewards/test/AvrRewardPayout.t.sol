// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {AvrRewardPayout} from "../src/AvrRewardPayout.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

// Fault injection is confined to tests. Fee/rebase tokens are not activation-qualified.
contract TestToken is ERC20 {
    uint8 private immutable units;
    address public payout;
    uint16 public incomingFeeBps;
    bool public failIncoming;
    bool public failOutgoing;
    bool public revertOutgoing;
    bool public attackIncoming;
    bool public attackOutgoing;
    bytes public attackResult;
    bool public attackSucceeded;

    constructor(uint8 decimals_) ERC20("Fixture reward", "FIX") {
        units = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return units;
    }

    function mint(address user, uint256 amount) external {
        _mint(user, amount);
    }

    function configure(address p, uint16 fee, bool incoming, bool outgoing, bool revert_) external {
        payout = p;
        incomingFeeBps = fee;
        failIncoming = incoming;
        failOutgoing = outgoing;
        revertOutgoing = revert_;
    }

    function attack(bool incoming, bool outgoing) external {
        attackIncoming = incoming;
        attackOutgoing = outgoing;
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        if (failIncoming) return false;
        bool ok = super.transferFrom(from, to, amount);
        if (to == payout && incomingFeeBps > 0) _burn(to, amount * incomingFeeBps / 10_000);
        if (attackIncoming) {
            (attackSucceeded, attackResult) = payout.call(abi.encodeCall(AvrRewardPayout.fund, (1)));
        }
        return ok;
    }

    function transfer(address to, uint256 amount) public override returns (bool) {
        if (failOutgoing) return false;
        if (revertOutgoing) revert("outgoing failure");
        if (attackOutgoing) {
            (attackSucceeded, attackResult) =
                payout.call(abi.encodeCall(AvrRewardPayout.claim, (1, type(uint256).max, bytes(""))));
        }
        return super.transfer(to, amount);
    }
}

// A conventional ERC20 with no returndata is SafeERC20-compatible; not a tax-token guarantee.
contract NoReturnToken {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address user, uint256 amount) external {
        balanceOf[user] += amount;
    }

    function approve(address spender, uint256 amount) external {
        allowance[msg.sender][spender] = amount;
    }

    function transferFrom(address from, address to, uint256 amount) external {
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
    }

    function transfer(address to, uint256 amount) external {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
    }
}

contract TestClaimAccount {
    function claim(AvrRewardPayout payout, uint256 amount, uint256 deadline, bytes calldata signature)
        external
        returns (uint256)
    {
        return payout.claim(amount, deadline, signature);
    }
}

contract AvrRewardPayoutTest is Test {
    uint256 private constant SIGNER_KEY = 0xa11ce;
    uint256 private constant ROTATED_KEY = 0xcafe;
    bytes32 private constant TYPE_HASH = keccak256("Claim(address user,uint256 totalAmount,uint256 deadline)");
    bytes32 private constant DOMAIN_TYPE_HASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    TestToken private token;
    AvrRewardPayout private payout;
    address private alice;
    address private bob;
    uint256 private deadline;

    event Claim(address target, uint256 reward, uint256 totalAmount);
    event Funded(address indexed funder, uint256 received, uint256 totalFunded);

    function setUp() public {
        vm.chainId(1339);
        vm.warp(1_800_000_000);
        alice = vm.addr(0xb0b);
        bob = vm.addr(0xb0b2);
        deadline = block.timestamp + 3600;
        token = new TestToken(18);
        payout = new AvrRewardPayout(token, address(this), vm.addr(SIGNER_KEY));
        token.configure(address(payout), 0, false, false, false);
        token.mint(address(this), 1_000_000 ether);
        token.approve(address(payout), type(uint256).max);
    }

    function digest(
        address user,
        uint256 amount,
        uint256 expires,
        address verifier,
        uint256 chain,
        string memory name,
        string memory version
    ) private pure returns (bytes32) {
        bytes32 domain = keccak256(
            abi.encode(DOMAIN_TYPE_HASH, keccak256(bytes(name)), keccak256(bytes(version)), chain, verifier)
        );
        return keccak256(abi.encodePacked(hex"1901", domain, keccak256(abi.encode(TYPE_HASH, user, amount, expires))));
    }

    function signature(address user, uint256 amount, uint256 expires, address verifier, uint256 chain, uint256 key)
        private
        pure
        returns (bytes memory)
    {
        (uint8 v, bytes32 r, bytes32 s) =
            vm.sign(key, digest(user, amount, expires, verifier, chain, "GaugeRewarder", "1"));
        return abi.encodePacked(r, s, v);
    }

    function sig(address user, uint256 amount) private view returns (bytes memory) {
        return signature(user, amount, deadline, address(payout), block.chainid, SIGNER_KEY);
    }

    function pay(address user, uint256 amount) private returns (uint256) {
        bytes memory s = sig(user, amount);
        vm.prank(user);
        return payout.claim(amount, deadline, s);
    }

    function testConstructorPinsTokenOwnerAndSigner() public view {
        assertEq(address(payout.token()), address(token));
        assertEq(payout.owner(), address(this));
        assertEq(payout.signer(), vm.addr(SIGNER_KEY));
    }

    function testRejectZeroAndNonContractTokens() public {
        vm.expectRevert(AvrRewardPayout.AddressZero.selector);
        new AvrRewardPayout(IERC20(address(0)), address(this), address(0));
        vm.expectRevert(AvrRewardPayout.AddressZero.selector);
        new AvrRewardPayout(IERC20(alice), address(this), address(0));
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableInvalidOwner.selector, address(0)));
        new AvrRewardPayout(token, address(0), address(0));
    }

    function testZeroSignerDeploymentPausesClaims() public {
        AvrRewardPayout paused = new AvrRewardPayout(token, address(this), address(0));
        vm.expectRevert(AvrRewardPayout.ClaimDisabled.selector);
        paused.claim(1, deadline, "");
    }

    function testFundingAndCumulativeDeltaReturnAndEvent() public {
        vm.expectEmit(true, false, false, true, address(payout));
        emit Funded(address(this), 150 ether, 150 ether);
        payout.fund(150 ether);
        bytes memory s = sig(alice, 100 ether);
        vm.expectEmit(false, false, false, true, address(payout));
        emit Claim(alice, 100 ether, 100 ether);
        vm.prank(alice);
        assertEq(payout.claim(100 ether, deadline, s), 100 ether);
        bytes memory second = sig(alice, 150 ether);
        vm.expectEmit(false, false, false, true, address(payout));
        emit Claim(alice, 50 ether, 150 ether); // Word 1 is the paid delta, word 2 the cumulative total.
        vm.prank(alice);
        assertEq(payout.claim(150 ether, deadline, second), 50 ether);
        assertEq(token.balanceOf(alice), 150 ether);
        assertEq(payout.claimed(alice), 150 ether);
        assertEq(payout.totalFunded(), 150 ether);
        assertEq(payout.totalRewardClaimed(), 150 ether);
    }

    function testFuzzCumulativeDeltaAndGlobalBudget(uint128 first, uint128 extra) public {
        first = uint128(bound(first, 1, 100_000 ether));
        extra = uint128(bound(extra, 1, 100_000 ether));
        uint256 total = uint256(first) + extra;
        payout.fund(total);
        assertEq(pay(alice, first), first);
        assertEq(pay(alice, total), extra);
        assertEq(payout.totalRewardClaimed(), total);
        assertEq(token.balanceOf(alice), total);
    }

    function testBudgetIsSharedAcrossAccountsAndFailedClaimIsRetryable() public {
        payout.fund(100);
        pay(alice, 80);
        bytes memory s = sig(bob, 30);
        vm.prank(bob);
        vm.expectRevert(AvrRewardPayout.InsufficientFunding.selector);
        payout.claim(30, deadline, s);
        assertEq(payout.claimed(bob), 0);
        assertEq(payout.totalRewardClaimed(), 80);
        payout.fund(10);
        vm.prank(bob);
        assertEq(payout.claim(30, deadline, s), 30);
    }

    function testDirectDonationDoesNotIncreaseFundingCapacity() public {
        token.transfer(address(payout), 1000);
        assertEq(payout.totalFunded(), 0);
        bytes memory s = sig(alice, 1);
        vm.prank(alice);
        vm.expectRevert(AvrRewardPayout.InsufficientFunding.selector);
        payout.claim(1, deadline, s);
        payout.fund(1);
        pay(alice, 1);
        assertEq(token.balanceOf(address(payout)), 1000);
    }

    function testFundUsesActualReceivedAndDoesNotCountExistingDonation() public {
        token.transfer(address(payout), 777);
        token.configure(address(payout), 1000, false, false, false);
        payout.fund(100);
        assertEq(payout.totalFunded(), 90);
        assertEq(token.balanceOf(address(payout)), 867);
    }

    function testRejectZeroFundingAndZeroReceived() public {
        vm.expectRevert(AvrRewardPayout.ZeroAmount.selector);
        payout.fund(0);
        token.configure(address(payout), 10_000, false, false, false);
        vm.expectRevert(AvrRewardPayout.ZeroAmount.selector);
        payout.fund(100);
        assertEq(payout.totalFunded(), 0);
        assertEq(token.balanceOf(address(payout)), 0);
    }

    function testFalseFundingTransferRejectedWithoutCounters() public {
        token.configure(address(payout), 0, true, false, false);
        vm.expectRevert(abi.encodeWithSelector(SafeERC20.SafeERC20FailedOperation.selector, address(token)));
        payout.fund(100);
        assertEq(payout.totalFunded(), 0);
    }

    function testReplayLowerAndZeroAmountsRejected() public {
        payout.fund(100);
        pay(alice, 100);
        for (uint256 n; n < 3; ++n) {
            uint256 amount = n == 0 ? 100 : n == 1 ? 99 : 0;
            bytes memory s = sig(alice, amount);
            vm.prank(alice);
            vm.expectRevert(AvrRewardPayout.AlreadyClaimed.selector);
            payout.claim(amount, deadline, s);
        }
        assertEq(payout.totalRewardClaimed(), 100);
    }

    function testWrongUserCannotUseSignature() public {
        payout.fund(100);
        bytes memory s = sig(alice, 100);
        vm.prank(bob);
        vm.expectRevert(AvrRewardPayout.InvalidSignature.selector);
        payout.claim(100, deadline, s);
    }

    function testWrongTotalAndDeadlineCannotUseSignature() public {
        payout.fund(100);
        bytes memory s = sig(alice, 100);
        vm.prank(alice);
        vm.expectRevert(AvrRewardPayout.InvalidSignature.selector);
        payout.claim(99, deadline, s);
        vm.prank(alice);
        vm.expectRevert(AvrRewardPayout.InvalidSignature.selector);
        payout.claim(100, deadline + 1, s);
    }

    function testWrongChainAndContractCannotUseSignature() public {
        payout.fund(100);
        bytes memory s = signature(alice, 100, deadline, address(payout), 1, SIGNER_KEY);
        vm.prank(alice);
        vm.expectRevert(AvrRewardPayout.InvalidSignature.selector);
        payout.claim(100, deadline, s);
        s = signature(alice, 100, deadline, address(0xdead), block.chainid, SIGNER_KEY);
        vm.prank(alice);
        vm.expectRevert(AvrRewardPayout.InvalidSignature.selector);
        payout.claim(100, deadline, s);
    }

    function testWrongDomainNameAndVersionRejected() public {
        payout.fund(100);
        for (uint256 i; i < 2; ++i) {
            (uint8 v, bytes32 r, bytes32 s) = vm.sign(
                SIGNER_KEY,
                digest(
                    alice,
                    100,
                    deadline,
                    address(payout),
                    block.chainid,
                    i == 0 ? "AVR" : "GaugeRewarder",
                    i == 0 ? "1" : "2"
                )
            );
            vm.prank(alice);
            vm.expectRevert(AvrRewardPayout.InvalidSignature.selector);
            payout.claim(100, deadline, abi.encodePacked(r, s, v));
        }
    }

    function testChangedChainInvalidatesCachedDomain() public {
        payout.fund(100);
        bytes memory s = sig(alice, 100);
        vm.chainId(1340);
        vm.prank(alice);
        vm.expectRevert(AvrRewardPayout.InvalidSignature.selector);
        payout.claim(100, deadline, s);
        assertEq(pay(alice, 100), 100);
    }

    function testDeadlineEqualNowAndPastRejected() public {
        payout.fund(100);
        for (uint256 i; i < 2; ++i) {
            uint256 expiry = block.timestamp - i;
            bytes memory s = signature(alice, 100, expiry, address(payout), block.chainid, SIGNER_KEY);
            vm.prank(alice);
            vm.expectRevert(AvrRewardPayout.SignatureExpired.selector);
            payout.claim(100, expiry, s);
        }
    }

    function testOneSecondBeforeExpirySucceeds() public {
        payout.fund(100);
        bytes memory s = sig(alice, 100);
        vm.warp(deadline - 1);
        vm.prank(alice);
        assertEq(payout.claim(100, deadline, s), 100);
    }

    function testPauseRotateAndRestoreRevivesOnlyUnexpiredUnconsumedAmounts() public {
        payout.fund(200);
        bytes memory oldSig = sig(alice, 100);
        payout.setSigner(address(0));
        vm.prank(alice);
        vm.expectRevert(AvrRewardPayout.ClaimDisabled.selector);
        payout.claim(100, deadline, oldSig);
        payout.setSigner(vm.addr(ROTATED_KEY));
        vm.prank(alice);
        vm.expectRevert(AvrRewardPayout.InvalidSignature.selector);
        payout.claim(100, deadline, oldSig);
        bytes memory rotated = signature(alice, 80, deadline, address(payout), block.chainid, ROTATED_KEY);
        vm.prank(alice);
        assertEq(payout.claim(80, deadline, rotated), 80);
        payout.setSigner(vm.addr(SIGNER_KEY));
        vm.prank(alice);
        assertEq(payout.claim(100, deadline, oldSig), 20);
        vm.prank(alice);
        vm.expectRevert(AvrRewardPayout.AlreadyClaimed.selector);
        payout.claim(100, deadline, oldSig);
        bytes memory unconsumed = sig(bob, 100);
        vm.warp(deadline);
        vm.prank(bob);
        vm.expectRevert(AvrRewardPayout.SignatureExpired.selector);
        payout.claim(100, deadline, unconsumed);
    }

    function testTwoStepOwnershipAndOnlyOwnerSigner() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        payout.setSigner(address(0));
        payout.transferOwnership(alice);
        assertEq(payout.owner(), address(this));
        assertEq(payout.pendingOwner(), alice);
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, bob));
        payout.acceptOwnership();
        vm.prank(alice);
        payout.acceptOwnership();
        assertEq(payout.owner(), alice);
        assertEq(payout.pendingOwner(), address(0));
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, address(this)));
        payout.setSigner(address(0));
        vm.prank(alice);
        payout.setSigner(address(0));
    }

    function testOwnershipOfferCanBeCancelledAndRenounceAlwaysDisabled() public {
        payout.transferOwnership(alice);
        payout.transferOwnership(address(0));
        assertEq(payout.pendingOwner(), address(0));
        vm.expectRevert(AvrRewardPayout.RenounceDisabled.selector);
        payout.renounceOwnership();
        vm.prank(alice);
        vm.expectRevert(AvrRewardPayout.RenounceDisabled.selector);
        payout.renounceOwnership();
        assertEq(payout.owner(), address(this));
    }

    function testNoDelegatedClaimWithdrawOrProxyUpgradeEntrypoints() public {
        (bool ok,) = address(payout)
            .call(abi.encodeWithSignature("claimFor(address,uint256,uint256,bytes)", alice, 1, deadline, bytes("")));
        assertFalse(ok);
        (ok,) = address(payout).call(abi.encodeWithSignature("withdraw(uint256)", 1));
        assertFalse(ok);
        (ok,) = address(payout).call(abi.encodeWithSignature("upgradeTo(address)", alice));
        assertFalse(ok);
    }

    function testMalformedAndMalleableSignaturesRejected() public {
        payout.fund(100);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(ECDSA.ECDSAInvalidSignatureLength.selector, 0));
        payout.claim(100, deadline, "");
        (uint8 v, bytes32 r, bytes32 s) =
            vm.sign(SIGNER_KEY, digest(alice, 100, deadline, address(payout), block.chainid, "GaugeRewarder", "1"));
        bytes32 highS = bytes32(0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141 - uint256(s));
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(ECDSA.ECDSAInvalidSignatureS.selector, highS));
        payout.claim(100, deadline, abi.encodePacked(r, highS, v == 27 ? uint8(28) : uint8(27)));
    }

    function testFalseOutgoingTransferRollsBackCountersAndAllowsRetry() public {
        payout.fund(100);
        token.configure(address(payout), 0, false, true, false);
        bytes memory s = sig(alice, 100);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(SafeERC20.SafeERC20FailedOperation.selector, address(token)));
        payout.claim(100, deadline, s);
        assertEq(payout.claimed(alice), 0);
        assertEq(payout.totalRewardClaimed(), 0);
        token.configure(address(payout), 0, false, false, false);
        vm.prank(alice);
        assertEq(payout.claim(100, deadline, s), 100);
    }

    function testRevertedOutgoingTransferRollsBackCounters() public {
        payout.fund(100);
        token.configure(address(payout), 0, false, false, true);
        bytes memory s = sig(alice, 100);
        vm.prank(alice);
        vm.expectRevert(bytes("outgoing failure"));
        payout.claim(100, deadline, s);
        assertEq(payout.claimed(alice), 0);
        assertEq(payout.totalRewardClaimed(), 0);
    }

    function testFundAndClaimRejectNestedReentrancy() public {
        token.attack(true, false);
        payout.fund(100);
        assertFalse(token.attackSucceeded());
        assertEq(bytes4(token.attackResult()), ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        assertEq(payout.totalFunded(), 100);
        token.attack(false, true);
        pay(alice, 100);
        assertFalse(token.attackSucceeded());
        assertEq(bytes4(token.attackResult()), ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        assertEq(payout.totalRewardClaimed(), 100);
        assertEq(token.balanceOf(alice), 100);
    }

    function testGenericSixAndEighteenDecimalTokens() public {
        for (uint8 n; n < 2; ++n) {
            TestToken other = new TestToken(n == 0 ? 6 : 18);
            AvrRewardPayout p = new AvrRewardPayout(other, address(this), vm.addr(SIGNER_KEY));
            uint256 unit = 10 ** other.decimals();
            other.mint(address(this), 150 * unit);
            other.approve(address(p), 150 * unit);
            p.fund(150 * unit);
            bytes memory s = signature(alice, 100 * unit, deadline, address(p), block.chainid, SIGNER_KEY);
            vm.prank(alice);
            assertEq(p.claim(100 * unit, deadline, s), 100 * unit);
            s = signature(alice, 150 * unit, deadline, address(p), block.chainid, SIGNER_KEY);
            vm.prank(alice);
            assertEq(p.claim(150 * unit, deadline, s), 50 * unit);
            assertEq(other.balanceOf(alice), 150 * unit);
            assertEq(p.totalRewardClaimed(), 150 * unit);
        }
    }

    function testNoReturnERC20TransferCompatibility() public {
        NoReturnToken other = new NoReturnToken();
        AvrRewardPayout p = new AvrRewardPayout(IERC20(address(other)), address(this), vm.addr(SIGNER_KEY));
        other.mint(address(this), 100);
        other.approve(address(p), 100);
        p.fund(100);
        bytes memory s = signature(alice, 100, deadline, address(p), block.chainid, SIGNER_KEY);
        vm.prank(alice);
        assertEq(p.claim(100, deadline, s), 100);
        assertEq(other.balanceOf(alice), 100);
    }

    function testAnyFunderCanAddOnlyTransferredCapacity() public {
        token.mint(bob, 123);
        vm.prank(bob);
        token.approve(address(payout), 123);
        vm.prank(bob);
        payout.fund(123);
        assertEq(payout.totalFunded(), 123);
        assertEq(token.balanceOf(bob), 0);
        assertEq(pay(alice, 123), 123);
    }

    function testContractAccountClaimsAsActualHolderAndReceivesFunds() public {
        // This checks generic caller custody, not qualification of a production vFat executor.
        payout.fund(100);
        TestClaimAccount account = new TestClaimAccount();
        address holder = address(account);
        bytes memory s = sig(holder, 100);
        assertEq(account.claim(payout, 100, deadline, s), 100);
        assertEq(payout.claimed(holder), 100);
        assertEq(token.balanceOf(holder), 100);
        assertEq(payout.claimed(alice), 0);
    }

    function testAnotherPayoutCannotReplayAndKeepsIndependentCumulativeBook() public {
        payout.fund(100);
        AvrRewardPayout other = new AvrRewardPayout(token, address(this), vm.addr(SIGNER_KEY));
        token.approve(address(other), 100);
        other.fund(100);
        bytes memory s = sig(alice, 100);
        vm.prank(alice);
        vm.expectRevert(AvrRewardPayout.InvalidSignature.selector);
        other.claim(100, deadline, s);
        assertEq(pay(alice, 100), 100);
        s = signature(alice, 100, deadline, address(other), block.chainid, SIGNER_KEY);
        vm.prank(alice);
        assertEq(other.claim(100, deadline, s), 100);
        assertEq(payout.claimed(alice), 100);
        assertEq(other.claimed(alice), 100);
        assertEq(token.balanceOf(alice), 200);
    }

    function testBackendFixtureDigestSignatureAndRealClaim() public {
        string memory fixture = vm.readFile("test/fixtures/eip712-claim.json");
        address user = vm.parseJsonAddress(fixture, ".message.user");
        address verifier = vm.parseJsonAddress(fixture, ".domain.verifyingContract");
        uint256 amount = vm.parseJsonUint(fixture, ".message.totalAmount");
        uint256 expiry = vm.parseJsonUint(fixture, ".message.deadline");
        uint256 chain = vm.parseJsonUint(fixture, ".domain.chainId");
        bytes32 expected = vm.parseJsonBytes32(fixture, ".digest");
        bytes memory signed = vm.parseJsonBytes(fixture, ".signature");
        assertEq(digest(user, amount, expiry, verifier, chain, "GaugeRewarder", "1"), expected);
        assertEq(ECDSA.recover(expected, signed), vm.parseJsonAddress(fixture, ".signer"));
        vm.chainId(chain);
        vm.warp(expiry - 1);
        deployCodeTo(
            "AvrRewardPayout.sol:AvrRewardPayout", abi.encode(token, address(this), vm.addr(SIGNER_KEY)), verifier
        );
        AvrRewardPayout fixturePayout = AvrRewardPayout(verifier);
        token.approve(verifier, amount);
        fixturePayout.fund(amount);
        vm.prank(user);
        assertEq(fixturePayout.claim(amount, expiry, signed), amount);
        assertEq(token.balanceOf(user), amount);
        assertEq(fixturePayout.claimed(user), amount);
    }
}
