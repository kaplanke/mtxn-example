/* eslint-disable @typescript-eslint/no-explicit-any */
import { RedisContext } from "@multiple-transaction-manager/redis";
import express, { NextFunction, Request, Response } from "express";
import { MultiTxnMngr, Task } from "multiple-transaction-manager";

const router = express.Router();


/*
*   Get the current credit promotion lead queue. 
*   Redis context is used to fetch credit promotion queue.
*   Returns the contents of the credit promotion queue.
*/
router.get("/queue", async (req: Request, res: Response, next: NextFunction) => {

    const txnMngr: MultiTxnMngr = new MultiTxnMngr();
    const redisContext: RedisContext = new RedisContext(txnMngr, global.redisClient);

    const redisTask: Task = redisContext.addFunctionTask(
        (_client, txn, _task) => txn.lRange(global.redisQueues.REDIS_CREDIT_PROMOTION_QUEUE, 0, -1));

    txnMngr.exec().then((_) => {
        res.json(redisTask.getResult());
        next();
    }).catch((err) => {
        res.status(500).json({ error: JSON.stringify(err) })
    });
});

export default router;