/* eslint-disable @typescript-eslint/no-explicit-any */
import { MongoContext } from "@multiple-transaction-manager/mongodb";
import { MysqlDBContext } from "@multiple-transaction-manager/mysql";
import { RedisContext, RedisTask } from "@multiple-transaction-manager/redis";
import { SeqDBContext } from "@multiple-transaction-manager/sequelize";
import express, { NextFunction, Request, Response } from "express";
import { FunctionContext, MultiTxnMngr, Task } from "multiple-transaction-manager";

const router = express.Router();

/*
*   Example transactions with multiple contexts.
*   CRUD operations for an account table in a relational DB and related account activities logs in document DB
*   All data manipulations are executed within transaction managers with adding related tasks into them.
*   If any exception occurs (e.g. negative account balance) both contexts (relational and document base) are rollbacked sequentially. 
*   Sequelize and Mysql contexts are both used in example to demonstrate their uses.
*/


/*
*   Get all accounts. 
*   Mysql context is used to fetch all accounts.
*   Returns account list.
*/
router.get("", async (req: Request, res: Response, next: NextFunction) => {

    const txnMngr: MultiTxnMngr = new MultiTxnMngr();
    const mysqlContext: MysqlDBContext = new MysqlDBContext(txnMngr, global.mysqlPool);

    const resTask: Task = mysqlContext.addTask("SELECT * FROM Accounts ORDER BY accountId");

    txnMngr.exec().then((_) => {
        res.json(resTask.getResult().results);
        next();
    }).catch((err) => {
        res.status(500).json({ error: JSON.stringify(err) })
    });

});

/*
*   Get a specific account. 
*   Mysql context is used to the account
*   Mongo context is used to fetch the account activities
*   Returns account detail with the activity list.
*/
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {

    const txnMngr: MultiTxnMngr = new MultiTxnMngr();
    const mysqlContext: MysqlDBContext = new MysqlDBContext(txnMngr, global.mysqlPool);
    const mongoContext: MongoContext = new MongoContext(txnMngr, global.mongoose);

    const mysqlTask: Task = mysqlContext.addTask("SELECT * FROM Accounts WHERE accountId=:accountId", { accountId: req.params.id });

    const mongoTask: Task = mongoContext.addFunctionTask((_mongoose, txn, _task) =>
        global.mongoModels["Activity"].find({ accountId: req.params.id }).sort({ date: "asc" }).session(txn).exec());

    txnMngr.exec().then((_) => {
        res.json({
            account: mysqlTask.getResult().results,
            activities: mongoTask.getResult()
        });
        next();
    }).catch((err) => {
        res.status(500).json({ error: JSON.stringify(err) })
    });

});

/*
*   Create an account. 
*   Sequelize context is used to create the account.
*   Mongo context is used to add account activity.
*   Returns account list.
*/
router.post("/create", async (req: Request, res: Response) => {

    const txnMngr: MultiTxnMngr = new MultiTxnMngr();
    const seqDBContext: SeqDBContext = new SeqDBContext(txnMngr, global.sequelize);
    const mongoContext: MongoContext = new MongoContext(txnMngr, global.mongoose);

    const account = req.body.reduce((px: any, x: any) => {
        px[x.name] = x.value;
        return px;
    }, {});

    const newAccountTask: Task = seqDBContext.addFunctionTask((sequelize, txn, _task) => global.seqModels["Account"].create(account, { transaction: txn }));

    mongoContext.addFunctionTask(
        (mongoose, txn, _task) => global.mongoModels["Activity"].create([
            {
                accountId: newAccountTask.getResult().accountId,
                date: new Date(),
                desc: "Account " + account.accountName + " is created."
            }
        ], { session: txn }));

    seqDBContext.addTask("SELECT * FROM Accounts ORDER BY accountId");

    txnMngr.exec().then((tasks: Task[]) => {
        res.json(tasks[2].getResult().results);
    }).catch((err) => {
        res.status(500).json({ error: JSON.stringify(err) })
    });

});

/*
*   Update an account. 
*   Sequelize context is used to update the account.
*   Mongo context is used to add account activity.
*   Redis context is used to push credit promotion leads when the new balance is 0 for the account
*   Returns account list.
*/
router.post("/:id", async (req: Request, res: Response, next: NextFunction) => {

    const txnMngr: MultiTxnMngr = new MultiTxnMngr();
    const seqDBContext: SeqDBContext = new SeqDBContext(txnMngr, global.sequelize);
    const mongoContext: MongoContext = new MongoContext(txnMngr, global.mongoose);
    const redisContext: RedisContext = new RedisContext(txnMngr, global.redisClient);
    const functionContext: FunctionContext = new FunctionContext(txnMngr);

    const account = req.body.reduce((px: any, x: any) => {
        px[x.name] = x.value;
        return px;
    }, {});

    const initialAccount: Task = seqDBContext.addFunctionTask(
        (_sequelize, txn, _task) => global.seqModels["Account"].findOne(
            {
                where: { accountId: req.params.id },
                transaction: txn
            }
        ));

    mongoContext.addFunctionTask(
        (_mongoose, txn, _task) => {
            return new Promise<any>((resolve, reject) => {
                const initialBalance = initialAccount.getResult().balance;
                const diff = account.balance - initialBalance;
                global.mongoModels["Activity"].create([
                    {
                        accountId: req.params.id,
                        date: new Date(),
                        desc: "Account updated. " + (diff < 0 ? "Withdraw" : "Deposit") + " amount: " + diff
                    }
                ], { session: txn }).then((value) => resolve(value)).catch((err) => reject(err));
            });
        });

    seqDBContext.addFunctionTask(
        (_sequelize, txn, _task) =>
            global.seqModels["Account"].update({ balance: account.balance }, { where: { accountId: req.params.id }, transaction: txn })
    );

    const resTask: Task = seqDBContext.addTask("SELECT * FROM Accounts ORDER BY accountId");

    functionContext.addPopTask(
        (popTask) => {
            if (Number(account.balance) === 0) {
                const taskForCreditPromotion: Task = new RedisTask(redisContext,
                    (_client, txn, _task) => txn.rPush(global.redisQueues.REDIS_CREDIT_PROMOTION_QUEUE, "Credit lead for account with id " + req.params.id + " at " + new Date()));
                popTask.popTasks.push(taskForCreditPromotion);
            }
            return popTask.popTasks;
        });

    txnMngr.exec().then((_tasks) => {
        res.json(resTask.getResult().results);
        next();
    }).catch((err) => {
        res.status(500).json({ error: JSON.stringify(err) })
    });

});

/*
*   Delete an account. 
*   Mysql context is used to delete the account.
*   Mongo context is used to add account activity.
*   Returns account list.
*/
router.post("/:id/delete", async (req: Request, res: Response, next: NextFunction) => {

    const txnMngr: MultiTxnMngr = new MultiTxnMngr();
    const mysqlContext: MysqlDBContext = new MysqlDBContext(txnMngr, global.mysqlPool);
    const mongoContext: MongoContext = new MongoContext(txnMngr, global.mongoose);

    mysqlContext.addTask("DELETE FROM Accounts WHERE accountId=:accountId", { accountId: req.params.id });

    mongoContext.addFunctionTask(
        (_mongoose, txn, _task) => global.mongoModels["Activity"].create([
            {
                accountId: req.params.id,
                date: new Date(),
                desc: "Account deleted"
            }
        ], { session: txn }));

    const resTask: Task = mysqlContext.addTask("SELECT * FROM Accounts ORDER BY accountId");

    txnMngr.exec().then((_) => {
        res.json(resTask.getResult().results);
        next()
    }).catch((err) => {
        res.status(500).json({ error: JSON.stringify(err) })
    });
    
});

export default router;