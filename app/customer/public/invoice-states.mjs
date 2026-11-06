import {esc} from './presentation.mjs';
export function setupOperation(purpose='',org='your organization'){
 const operations=[
  ['Create the organization', 'Set up organization names', 'Create the place where your organization controls its ENS subnames.'],
  ['Set the organization', 'Connect organization names', 'Link these names to your existing organization ENS identity.'],
  ['Create the official invoice', 'Set up invoice names', 'Let your invoice signer register invoice names while you keep administration.'],
  ['Set the invoice', 'Connect invoice names', 'Link invoice names to your organization’s ENS hierarchy.'],
  ['Attach the organization', 'Enable organization names', 'Connect the new names to your existing identity, keeping its resolver and records.'],
  ['Register invoices under', `Register invoices.${org}`, 'Create your reusable invoice namespace under your organization’s ownership.'],
  ['Publish the reviewed', 'Publish invoice permissions', 'Approve the reviewed invoice signer and payment details, and allow the invoice smart contract to publish evidence references.']
 ];
 const found=operations.find(([prefix])=>purpose.startsWith(prefix));
 return found?{title:found[1],purpose:found[2]}:{title:'Configure invoice authority',purpose:purpose||'Approve your reviewed invoice configuration.'};
}
export function renderOperationState({phase,hash,error,purpose,signature=false}={}){
 if(!phase)return '';
 const states={prepared:['Review before approving','No wallet request has been sent. Review the operation, target and approving wallet before continuing.'],wallet:['Waiting for wallet approval',signature?'Review the PDF approval message in your wallet. A message signature does not get block confirmations.':'Review this transaction in your wallet.'],pending:['Waiting for confirmation','The transaction was submitted. Check its confirmation before continuing.'],declined:['Approval declined','The wallet returned a rejection. Earlier confirmed steps remain preserved.'],failed:['This step was not completed','Review the failure details. Confirmed earlier steps are reused.'],ambiguous:['Wallet response interrupted','We do not know whether this request was submitted. Check the existing transaction before another request.']};
 const [title,body]=states[phase]||states.ambiguous;
 return `<section class="operation-state ${esc(phase)}" role="status"><h3>${title}</h3><p>${body}</p>${purpose?`<p>${esc(purpose)}</p>`:''}${hash?`<p><a target="_blank" rel="noopener noreferrer" class="mono" href="https://sepolia.etherscan.io/tx/${esc(hash)}">View existing transaction ↗</a></p>`:''}${error?`<details><summary>Details</summary><p>${esc(error)}</p></details>`:''}</section>`;
}
