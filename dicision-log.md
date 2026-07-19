# Technical Decision Log

## 2026-7-18: Reproducing the Oversell Bug
- Test method: send 20 concurrent requests to buy the same product with only 5 units in stock( via a node script using axios + Promise.all)
- Result: after multiple rounds of testing (including debugging with manual curl requests), the orders talbe accumulated 41 order records, and inventory dropped to -15
- Root cause: the system has no concurrency control mechanism. There is a race condition between checking the stock and decrementing it - multiple requests can read "stock available" at the same time , before any of them has actually decremented the stock yet.
As a result, all requests proceed to "successfully" decrement stock, regardless of whether real stock was actually available.
- Conclusion:confirmed taht without locking, overselling happens consistently and has no self-correcting mechanism.
- Next step: introduce a redis-based lock to ensure only one request can operate on a given product's inventory at a time.