const pool = require('../config/db');

async function createOrder(product_id, quantity) {
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
}

module.exports = {
    createOrder,
};