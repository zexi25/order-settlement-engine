const axios = require('axios');
// Test concurrent order creation
async function testConcurrentOrders() {
    const requests =[];
    for (let i = 0; i < 20; i++) {
        requests.push(axios.post('http://localhost:3000/orders', {
            product_id: 1,
            quantity: 1
        }).then(response => ( {success: true, data: response.data }))
        .catch(err => ({ success: false, error: err.response?.data || err.code || err.toString() })));
    }
    const results = await Promise.all(requests);

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`Successful orders: ${successCount}`);
    console.log(`Failed orders: ${failCount}`);

    const failReasons = results.filter(r => !r.success).map(r => r.error);
    console.log('Failure reasons:', failReasons);
  
}

testConcurrentOrders();