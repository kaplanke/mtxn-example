import express, { Express, Request, Response, NextFunction } from "express";
import { MultiTxnMngr, Task } from "multiple-transaction-manager";
import { MysqlDBContext } from "@multiple-transaction-manager/mysql";
import { SeqDBContext } from "@multiple-transaction-manager/sequelize";
import { MongoContext } from "@multiple-transaction-manager/mongodb";
import { exec } from "child_process";

const router = express.Router();

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
        (mongoose, txn, task) => global.mongoModels["Statement"].create([
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

router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
    const txnMngr: MultiTxnMngr = new MultiTxnMngr();
    const mysqlContext: MysqlDBContext = new MysqlDBContext(global.mysqlPool);
    const mongoContext: MongoContext = new MongoContext(global.mongoose);
    const mysqlTask: Task = mysqlContext.addTask(txnMngr, "SELECT * FROM Accounts WHERE accountId=:accountId", { accountId: req.params.id });
    const mongoTask: Task = mongoContext.addFunctionTask(txnMngr, (mongoose, txn, task) =>
        global.mongoModels["Statement"].find({ accountId: req.params.id }).sort({ date: "asc" }).session(txn).exec());
    txnMngr.exec().then((_) => {
        res.json({
            account: mysqlTask.getResult().results,
            statements: mongoTask.getResult()
        });
        next();
    }).catch((err) => {
        res.status(500).json({ error: JSON.stringify(err) })
    });
});

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
                global.mongoModels["Statement"].create([
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

router.post("/:id/delete", async (req: Request, res: Response, next: NextFunction) => {
    const txnMngr: MultiTxnMngr = new MultiTxnMngr();
    const mysqlContext: MysqlDBContext = new MysqlDBContext(global.mysqlPool);
    const mongoContext: MongoContext = new MongoContext(global.mongoose);
    mysqlContext.addTask(txnMngr, "DELETE FROM Accounts WHERE accountId=:accountId", { accountId: req.params.id });
    mongoContext.addFunctionTask(txnMngr,
        (mongoose, txn, task) => global.mongoModels["Statement"].create([
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