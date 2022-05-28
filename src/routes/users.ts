import express, { Express, Request, Response, NextFunction } from "express";
import { MultiTxnMngr, Task } from "multiple-transaction-manager";
import { MysqlDBContext } from "@multiple-transaction-manager/mysql";
import { Model } from "sequelize";

const router = express.Router();

router.post("/create", async (req: Request, res: Response, next: NextFunction) => {
    const user = req.body.map((x: any) => {
        const y: any = {};
        y[x.name] = x.value;
        return y;
    });
    await global.models["User"].create(user);
    const txnMngr: MultiTxnMngr = new MultiTxnMngr();
    res.send({});
    next();
});

router.get("", async (req: Request, res: Response, next: NextFunction) => {

    const txnMngr: MultiTxnMngr = new MultiTxnMngr();
    const mysqlContext: MysqlDBContext = new MysqlDBContext(global.mysqlPool);
    mysqlContext.addTask(txnMngr, "SELECT * FROM Users");
    const tasks: Task[] = await txnMngr.exec();
    res.send(tasks[0].getResult().results);
    next();
});

export default router;