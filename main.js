async function getKV(key) {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${process.env.accountId}/storage/kv/namespaces/${process.env.namespaceId}/values/${key}`
  , {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${process.env.apiToken}`}});
    return response;
};

async function storeKV(key, value) {
    await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${process.env.accountId}/storage/kv/namespaces/${process.env.namespaceId}/values/${key}`
  , {
      method: 'PUT',
      body: JSON.stringify(value),
      headers: { 'Authorization': `Bearer ${process.env.apiToken}`}});
};

// This function runs before a transaction.
  const beforeTransaction = async (authorization) => {
    // transactionStart = new Date().getTime(); 
    // Immediately authorise any purchases under the limit
    if (authorization.centsAmount <= process.env.transactionLimitCents) {
        return true;
    }

    const key = `${authorization.currencyCode}-${authorization.centsAmount}-${authorization.merchant.category.code}-${authorization.merchant.name}`
    const now = Date.now();
    const cardId = authorization.card.id;
    const value = {'cardId': cardId, 'now': now};
    // console.log(`${key}: ` + JSON.stringify(value));

    var prev_value = await getKV(key);
    if (prev_value.status == 404) {
        /*await*/ storeKV(key, value);  // Do not wait before declining, because storing takes too long ( > 2 seconds)
		//transactionEnd = new Date().getTime(); 
        //console.log('Transaction duration: ' + (transactionEnd - transactionStart));
        return false; // Decline the first transaction
    }

    const firstTrans = await prev_value.json();
    // console.log(firstTrans);
    if ((now - firstTrans.now)/1000 > process.env.transactionWindowSeconds) {
        // console.log('Too long ago: ' + (now - firstTrans.now)/1000);
        /*await*/ storeKV(key, value);
        return false; // Decline, and save as the first transaction
    }

    /*await*/ storeKV(key, value); // Store as most recent, in case this transaction is now declined due to differentCard logic
    if (process.env.differentCard == "true"){   // Grrr, workaround env.json forcing everything to a string
        // console.log(cardId !== firstTrans.cardId)
        return (cardId !== firstTrans.cardId);
    } else {
        // console.log(cardId === firstTrans.cardId)
        return (cardId === firstTrans.cardId);
    }
};

// This function runs after a transaction was successful.
const afterTransaction = async (transaction) => {
  console.log(transaction);
};

// This function runs after a transaction has been declined.
// const afterDecline = async (transaction) => { };
// This function runs after a transaction has been reversed.
// const afterReversal = async (transaction) => { };
// This function runs after a transaction has been adjusted.
// const afterAdjustment = async (transaction) => { };