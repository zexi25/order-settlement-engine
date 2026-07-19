const redis = require('../config/redis');

async function acquireLock(lockKey, lockValue, ttlMs = 5000) {
    const result = await redis.set(lockKey, lockValue, 'NX', 'PX', ttlMs);
    console.log(`Lock attempt for ${lockKey} with value ${lockValue}: ${result === 'OK' ? 'acquired' : 'failed'}`);
    return result === 'OK';
}

// Release the lock only if the value matches
async function releaseLock(lockKey, lockValue) {
    const currentValue = await redis.get(lockKey);
    if (currentValue === lockValue) {
        await redis.del(lockKey);
    
    }
}
module.exports = {
    acquireLock,
    releaseLock,
};