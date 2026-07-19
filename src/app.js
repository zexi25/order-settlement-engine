const express = require('express');
const pool = require('./config/db');
require('dotenv').config();
const { createOrder } = require('./services/orderService');

const app = express();
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Hello, World!');
});

app.get('/inventory/:id', async (req, res) => {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM inventory WHERE id = $1', [id]);
    res.json(result.rows[0]);
});

// app.post('/orders', async (req, res) => {
//     const { product_id, quantity } = req.body;
//     const result = await pool.query(
//         'INSERT INTO orders (product_id, quantity) VALUES ($1, $2) RETURNING *',
//         [product_id, quantity]
//     );
//     res.json(result.rows[0]);
// });

app.post('/orders', async (req, res) => {
    const { product_id, quantity } = req.body;
    try {
        const order = await createOrder(product_id, quantity);
        res.json(order);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});