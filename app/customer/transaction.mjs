import {toHex} from 'viem';
// The generic SDK formatter omits chainId for eth_sendTransaction. Our browser
// boundary deliberately requires it, so construct the reviewed RPC request here.
export function sepoliaTransaction({account,target,data,nonce,gas,maxFeePerGas,maxPriorityFeePerGas}){
 return {from:account,...(target?{to:target}:{}),data,value:'0x0',nonce:toHex(nonce),gas:toHex(gas),maxFeePerGas:toHex(maxFeePerGas),maxPriorityFeePerGas:toHex(maxPriorityFeePerGas),chainId:'0xaa36a7'};
}
