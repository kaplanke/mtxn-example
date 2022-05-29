import express, { Express, Request, Response, NextFunction } from "express";
import { MultiTxnMngr, Task } from "multiple-transaction-manager";
import { MysqlDBContext } from "@multiple-transaction-manager/mysql";
import { SeqDBContext } from "@multiple-transaction-manager/sequelize";


const router = express.Router();

router.post("/create", async (req: Request, res: Response, next: NextFunction) => {
    const user = req.body.reduce((px: any, x: any) => {
        px[x.name] = x.value;
        return px;
    }, {});
    const txnMngr: MultiTxnMngr = new MultiTxnMngr();
    const seqDBContext: SeqDBContext = new SeqDBContext(global.sequelize);
    seqDBContext.addFunctionTask(txnMngr,
        (sequelize, txn, task) => {
            return new Promise<any | undefined>((resolve, reject) => {
                global.models["User"].create(user, { transaction: txn }).then((newUser) => {
                    resolve(newUser);
                }).catch((err) => {
                    reject(err);
                });
            });
        }
    );
    seqDBContext.addTask(txnMngr, "SELECT * FROM Users ORDER BY email");

    txnMngr.exec().then((tasks: Task[]) => {
        res.json(tasks[1].getResult().results);
    }).catch((err) => {
        res.status(500).json({ error: JSON.stringify(err) })
    });

});

router.get("", async (req: Request, res: Response, next: NextFunction) => {
    const txnMngr: MultiTxnMngr = new MultiTxnMngr();
    const mysqlContext: MysqlDBContext = new MysqlDBContext(global.mysqlPool);
    mysqlContext.addTask(txnMngr, "SELECT * FROM Users ORDER BY email");
    const tasks: Task[] = await txnMngr.exec();
    res.json(tasks[0].getResult().results);
    next();
});

export default router;