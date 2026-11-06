// Explicit environments only. Existing local PDF copy stays unchanged.
export function pdfEnvironment(chainId){
 if(String(chainId)==='31337')return {banner:'LOCAL DEMONSTRATION - NO REAL PAYMENT',asset:'local demo asset',network:'HIR local chain · 31337'};
 if(String(chainId)==='11155111')return {banner:'SEPOLIA TESTNET - NO REAL PAYMENT',asset:'Sepolia test asset',network:'Sepolia testnet · 11155111'};
 throw Error('Unsupported invoice PDF network');
}
