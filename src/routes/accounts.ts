import { MongoContext } from "@multiple-transaction-manager/mongodb";
import { MysqlDBContext } from "@multiple-transaction-manager/mysql";
import { SeqDBContext } from "@multiple-transaction-manager/sequelize";
import express, { NextFunction, Request, Response } from "express";
import { MultiTxnMngr, Task } from "multiple-transaction-manager";

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
    const mysqlContext: MysqlDBContext = new MysqlDBContext(global.mysqlPool);
    const resTask: Task = mysqlContext.addTask(txnMngr, "SELECT * FROM Accounts ORDER BY accountId");
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
    const mysqlContext: MysqlDBContext = new MysqlDBContext(global.mysqlPool);
    const mongoContext: MongoContext = new MongoContext(global.mongoose);
    const mysqlTask: Task = mysqlContext.addTask(txnMngr, "SELECT * FROM Accounts WHERE accountId=:accountId", { accountId: req.params.id });
    const mongoTask: Task = mongoContext.addFunctionTask(txnMngr, (mongoose, txn, task) =>
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
router.post("/create", async (req: Request, res: Response, next: NextFunction) => {
    const txnMngr: MultiTxnMngr = new MultiTxnMngr();
    const seqDBContext: SeqDBContext = new SeqDBContext(global.sequelize);
    const mongoContext: MongoContext = new MongoContext(global.mongoose);

    const account = req.body.reduce((px: any, x: any) => {
        px[x.name] = x.value;
        return px;
    }, {});
    seqDBContext.addFunctionTask(txnMngr, (sequelize, txn, task) => global.seqModels["Account"].create(account, { transaction: txn }));
    seqDBContext.addTask(txnMngr, "SELECT * FROM Accounts ORDER BY accountId");
    mongoContext.addFunctionTask(txnMngr,
        (mongoose, txn, task) => global.mongoModels["Activity"].create([
            {
                accountId: account.accountId,
                date: new Date(),
                desc: "Account created."
            }
        ], { session: txn })).exec();

    txnMngr.exec().then((tasks: Task[]) => {
        res.json(tasks[1].getResult().results);
    }).catch((err) => {
        res.status(500).json({ error: JSON.stringify(err) })
    });

});


/*
*   Update an account. 
*   Sequelize context is used to update the account.
*   Mongo context is used to add account activity.
*   Returns account list.
*/
router.post("/:id", async (req: Request, res: Response, next: NextFunction) => {

    const txnMngr: MultiTxnMngr = new MultiTxnMngr();
    const seqDBContext: SeqDBContext = new SeqDBContext(global.sequelize);
    const mongoContext: MongoContext = new MongoContext(global.mongoose);

    const account = req.body.reduce((px: any, x: any) => {
        px[x.name] = x.value;
        return px;
    }, {});

    const initialAccount: Task = seqDBContext.addFunctionTask(txnMngr,
        (sequelize, txn, task) => global.seqModels["Account"].findOne(
            {
                where: { accountId: req.params.id },
                transaction: txn
            }
        ));

    mongoContext.addFunctionTask(txnMngr,
        (mongoose, txn, task) => {
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
    seqDBContext.addFunctionTask(txnMngr, (sequelize, txn, task) =>
        global.seqModels["Account"].update({ balance: account.balance }, { where: { accountId: req.params.id }, transaction: txn }));
    const resTask: Task = seqDBContext.addTask(txnMngr, "SELECT * FROM Accounts ORDER BY accountId");
    txnMngr.exec().then((tasks) => {
        res.json(resTask.getResult().results);
        next();
    }).catch((err) => {
        res.status(500).json({ error: JSON.stringify(err) })
    });
});

/*
*   DElete an account. 
*   Mysql context is used to delete the account.
*   Mongo context is used to add account activity.
*   Returns account list.
*/
router.post("/:id/delete", async (req: Request, res: Response, next: NextFunction) => {
    const txnMngr: MultiTxnMngr = new MultiTxnMngr();
    const mysqlContext: MysqlDBContext = new MysqlDBContext(global.mysqlPool);
    const mongoContext: MongoContext = new MongoContext(global.mongoose);
    mysqlContext.addTask(txnMngr, "DELETE FROM Accounts WHERE accountId=:accountId", { accountId: req.params.id });
    mongoContext.addFunctionTask(txnMngr,
        (mongoose, txn, task) => global.mongoModels["Activity"].create([
            {
                accountId: req.params.id,
                date: new Date(),
                desc: "Account deleted"
            }
        ], { session: txn }));
    const resTask: Task = mysqlContext.addTask(txnMngr, "SELECT * FROM Accounts ORDER BY accountId");
    txnMngr.exec().then((_) => {
        res.json(resTask.getResult().results);
        next()
    }).catch((err) => {
        res.status(500).json({ error: JSON.stringify(err) })
    });
});

export default router;