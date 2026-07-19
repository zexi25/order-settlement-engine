const pool = require('../config/db');
const { acquireLock, releaseLock } = require('./lockService');
const { randomUUID } = require('crypto');

async function createOrder(product_id, quantity) {
    const lockKey = `lock:inventory:${product_id}`;
    const lockValue = randomUUID();

    let locked = false;
    for (let attempt = 0; attempt < 50; attempt++) {
        locked = await acquireLock(lockKey, lockValue, 5000);
        if (locked) break;
        await new Promise(resolve => setTimeout(resolve, 30)); // Wait before retrying
    }

    if (!locked) {
        throw new Error('Please try again later'); 
    }

    try {
        //locked, proceed with order creation
        // Check if the product exists and has sufficient stock
        const inventoryResult = await pool.query(
            'SELECT quantity FROM inventory WHERE id = $1',
            [product_id]
        );

        const currentStock = inventoryResult.rows[0].quantity;

        if (currentStock < quantity) {
            throw new Error('Insufficient stock for the product');
        }

        await new Promise(resolve => setTimeout(resolve, 100)); // Simulate processing delay

        // Deduct the quantity from inventory
        await pool.query(
            'UPDATE inventory SET quantity = quantity - $1 WHERE id = $2',
            [quantity, product_id]
        );
        // Create the order
        const orderResult = await pool.query(
            'INSERT INTO orders (product_id, quantity) VALUES ($1, $2) RETURNING *',
            [product_id, quantity]
        );

        return orderResult.rows[0];
    } finally {
        // Always release the lock
        await releaseLock(lockKey, lockValue);
    }
}

module.exports = {
    createOrder,
};