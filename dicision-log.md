# Technical Decision Log

## 2026-7-18: Reproducing the Oversell Bug
- Test method: send 20 concurrent requests to buy the same product with only 5 units in stock( via a node script using axios + Promise.all)
- Result: after multiple rounds of testing (including debugging with manual curl requests), the orders talbe accumulated 41 order records, and inventory dropped to -15
- Root cause: the system has no concurrency control mechanism. There is a race condition between checking the stock and decrementing it - multiple requests can read "stock available" at the same time , before any of them has actually decremented the stock yet.
As a result, all requests proceed to "successfully" decrement stock, regardless of whether real stock was actually available.
- Conclusion:confirmed taht without locking, overselling happens consistently and has no self-correcting mechanism.
- Next step: introduce a redis-based lock to ensure only one request can operate on a given product's inventory at a time.

## 2026-07-19: Naive Redis lock fixes the overselling bug
- Implemented a basic Redis lock using `SET key value NX PX ttl`,
  applied around the check-stock → decrement-stock → create-order flow.
- First attempt (retry limit = 10, interval = 50ms):
  Successful orders: 4, Failed orders: 16 — all 16 failures were
  "Please try again later" (lock contention), meaning 1 unit of real
  inventory went unsold even though it was available. This revealed
  a distinct failure mode: requests can be rejected due to lock
  contention, separate from genuine "out of stock" rejections.
- Adjusted retry limit to 50, interval to 30ms.
- Second attempt: Successful orders: 5, Failed orders: 15, all 15
  failures correctly reported "Insufficient stock for the product".
- Conclusion: The naive Redis lock (SET NX PX) successfully eliminates
  the race condition — inventory now decrements exactly to 0, matching
  the real stock count. Retry limit/interval is a tunable trade-off
  between wait tolerance and system responsiveness under contention.
- Known limitation: the current unlock logic (GET then DEL) is not
  atomic — there's a theoretical race window between checking lock
  ownership and deleting it. This will be addressed in the next stage
  by switching to the `redlock` library, which uses a Lua script to
  make the check-and-delete operation atomic.
- Next step: Replace the hand-written lock with the `redlock` npm
  package for a more production-grade implementation.

  ## 2026-07-19: Replaced hand-written lock with redlock library
- Motivation: The hand-written lock (Stage 2) had a known limitation —
  the unlock logic (GET then DEL) was not atomic, creating a theoretical
  race window where a lock could be released by the wrong request.
- Implementation: Switched to the `redlock` npm package, using
  `redlock.using([lockKey], ttl, callback)` to automatically handle
  acquire → execute → release, with retryCount=50, retryDelay=30ms,
  retryJitter=20ms (jitter added to avoid synchronized retry storms
  across multiple waiting requests, i.e. thundering herd).
- Verification: Re-ran the same 20-concurrent-request test against
  5 units of stock. Result: Successful orders: 5, Failed orders: 15,
  all 15 correctly reported "Insufficient stock for the product" —
  identical to Stage 2's correct behavior, confirming no regression.
- Key improvements over the hand-written version:
  1. Atomic lock release — redlock uses a Lua script internally to
     make "check ownership + delete" a single atomic operation,
     eliminating the race window from Stage 2.
  2. Auto-extension (watchdog-like behavior) — if business logic
     takes longer than expected, redlock can extend the lock's TTL
     automatically, removing the need to manually estimate a safe
     timeout value.
- Trade-off: Introduced a new dependency (redlock library) and its
  associated API surface (using() with abort signal), slightly
  increasing complexity compared to the hand-written version — but
  the correctness guarantees are worth it for a real system.