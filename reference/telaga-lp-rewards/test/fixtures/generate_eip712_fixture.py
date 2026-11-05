"""Deterministic public test-only key; invokes Foundry cast offline, never a live signer."""
import json
import subprocess
from pathlib import Path

def cast(*args):
    return subprocess.check_output(['cast', *map(str, args)], text=True).strip()

def keccak(value):
    return cast('keccak', value)

key = '0x' + format(0xa11ce, '064x')
user = cast('wallet', 'address', '--private-key', '0x' + format(0xb0b, '064x'))
signer = cast('wallet', 'address', '--private-key', key)
verifier = '0x0000000000000000000000000000000000001001'
chain, amount, deadline = 1339, 150_000_000_000_000_000_000, 1_800_003_600
domain_hash = keccak(cast('abi-encode', 'f(bytes32,bytes32,bytes32,uint256,address)',
    keccak('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)'),
    keccak('GaugeRewarder'), keccak('1'), chain, verifier))
struct_hash = keccak(cast('abi-encode', 'f(bytes32,address,uint256,uint256)',
    keccak('Claim(address user,uint256 totalAmount,uint256 deadline)'), user, amount, deadline))
digest = keccak('0x1901' + domain_hash[2:] + struct_hash[2:])
signature = cast('wallet', 'sign', '--no-hash', '--private-key', key, digest)
fixture = {
    'warning': 'Deterministic test-only key, never use for production',
    'fixtureSignerPrivateKey': key,
    'domain': {'name': 'GaugeRewarder', 'version': '1', 'chainId': chain, 'verifyingContract': verifier},
    'primaryType': 'Claim',
    'types': {'Claim': [ {'name': 'user', 'type': 'address'}, {'name': 'totalAmount', 'type': 'uint256'}, {'name': 'deadline', 'type': 'uint256'} ]},
    'message': {'user': user, 'totalAmount': str(amount), 'deadline': deadline},
    'domainSeparator': domain_hash, 'structHash': struct_hash, 'digest': digest,
    'signer': signer, 'signature': signature,
}
Path(__file__).with_name('eip712-claim.json').write_text(json.dumps(fixture, indent=2) + '\n')
print(json.dumps({k: fixture[k] for k in ['digest', 'signer', 'signature']}))
