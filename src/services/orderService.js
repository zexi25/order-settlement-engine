const pool = require('../config/db');
// const { acquireLock, releaseLock } = require('./lockService');
// const { randomUUID } = require('crypto');
const redlock = require('./lockService');

async function createOrder(product_id, quantity, simulateFailure = false) {
    const lockKey = `lock:inventory:${product_id}`;
    // const lockValue = randomUUID();

    // let locked = false;
    // for (let attempt = 0; attempt < 50; attempt++) {
    //     locked = await acquireLock(lockKey, lockValue, 5000);
    //     if (locked) break;
    //     await new Promise(resolve => setTimeout(resolve, 30)); // Wait before retrying
    // }

    // if (!locked) {
    //     throw new Error('Please try again later'); 
    // }

    try {
        
        const order = await redlock.using([lockKey], 5000, async (signal) => {
            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                // Check if the product exists and has sufficient stock
                // Check if the product exists and has sufficient stock
                const inventoryResult = await client.query(
                    'SELECT quantity FROM inventory WHERE id = $1',
                    [product_id]
                );

                const currentStock = inventoryResult.rows[0].quantity;

                if (currentStock < quantity) {
                    throw new Error('Insufficient stock for the product');
                }

                await new Promise(resolve => setTimeout(resolve, 100)); // Simulate processing delay

                // check if the lock has been aborted
                if (signal.aborted) {
                    throw signal.error;
                    }

                // Deduct the quantity from inventory
                await client.query(
                    'UPDATE inventory SET quantity = quantity - $1 WHERE id = $2',
                    [quantity, product_id]
                );

                if (simulateFailure) {
                    throw new Error('Simulated failure after inventory deduction (for testing rollback)');
                }
                // Create the order
                const orderResult = await client.query(
                    'INSERT INTO orders (product_id, quantity) VALUES ($1, $2) RETURNING *',
                    [product_id, quantity]
                );

                await client.query('COMMIT');

                return orderResult.rows[0];
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
});

    return order;
} catch (error) {

        if (error.message === 'ExecutionError'){
            throw new Error('Please try again later'); 
        }
        throw error;
    }
        // Always release the lock
        // await releaseLock(lockKey, lockValue);
}

module.exports = {
    createOrder,
};