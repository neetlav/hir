import {esc} from './presentation.mjs';
export function renderOperationState({phase,hash,error,purpose,signature=false}={}){
 if(!phase)return '';
 const states={wallet:['Waiting for wallet approval',signature?'Review the PDF approval message in your wallet. A message signature does not get block confirmations.':'Review this transaction in your wallet.'],pending:['Waiting for confirmation','The transaction was submitted. Check its confirmation before continuing.'],declined:['Approval declined','The wallet returned a rejection. Earlier confirmed steps remain preserved.'],failed:['This step was not completed','Review the failure details. Confirmed earlier steps are reused.'],ambiguous:['Wallet response interrupted','We do not know whether this request was submitted. Check the existing transaction before another request.']};
 const [title,body]=states[phase]||states.ambiguous;
 return `<section class="operation-state ${esc(phase)}" role="status"><h3>${title}</h3><p>${body}</p>${purpose?`<p>${esc(purpose)}</p>`:''}${hash?`<p><a target="_blank" rel="noopener noreferrer" class="mono" href="https://sepolia.etherscan.io/tx/${esc(hash)}">View existing transaction ↗</a></p>`:''}${error?`<details><summary>Details</summary><p>${esc(error)}</p></details>`:''}</section>`;
}
