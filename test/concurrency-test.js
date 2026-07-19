const axios = require('axios');
// Test concurrent order creation
async function testConcurrentOrders() {
    const requests =[];
    for (let i = 0; i < 20; i++) {
        requests.push(axios.post('http://localhost:3000/orders', {
            product_id: 1,
            quantity: 1
        }).catch(err => ({ error: err.response?.data?.error || err.message })));
    }
    const results = await Promise.allSettled(requests);

    const successCount = results.filter(r => !r.error && !r.data?.error).length;
    const failCount = results.length - successCount;

    console.log(`Successful orders: ${successCount}`);
    console.log(`Failed orders: ${failCount}`);
  
}

testConcurrentOrders();