export const unresolvedOperation=row=>['awaiting-wallet','wallet-dispatched','submitted','confirming'].includes(row.status);
// Historical declines/failures remain stored, but do not replace a later request.
export function walletOperation(model){
 const rows=Object.values(model.wallet?.operations??{}),open=rows.find(unresolvedOperation);
 if(open)return open;
 const latest=rows.sort((a,b)=>String(b.preparedAt).localeCompare(String(a.preparedAt)))[0];
 return ['rejected','failed'].includes(latest?.status)?latest:null;
}
