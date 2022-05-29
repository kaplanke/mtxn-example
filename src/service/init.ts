import mysql from "mysql2";
import RedisMemoryServer from "redis-memory-server";
import { Sequelize, STRING, Model } from "sequelize";
import { createClient } from "redis";
import log4js from "log4js";



const dbConfig = {
    connectionLimit: 3,
    host: "localhost",
    user: "root",
    password: "1q2w3e4r",
    database: "mtxnmngr",
}


export default async () => {

    // init logger
    log4js.configure({
        appenders: { 'out': { type: 'stdout' } },
        categories: {
            default: { appenders: ['out'], level: 'debug' },
            MultiTxnMngr: { appenders: ['out'], level: 'debug' }
        }
    });

    // init Mysql
    global.mysqlPool = mysql.createPool(dbConfig);

    // init sequelize
    global.sequelize = new Sequelize(
        dbConfig.database,
        dbConfig.user,
        dbConfig.password,
        {
            host: "localhost",
            dialect: "mysql"
        });

    const User = sequelize.define("User", {
        email: {
            type: STRING,
            primaryKey: true,
            validate: { notEmpty: true }
        },
        name: {
            type: STRING,
        },
        surname: {
            type: STRING,
        }

    });
    await sequelize.sync({ force: true });

    global.models = { "User": User };

    // init redis & redisClient
    const redisServer = new RedisMemoryServer();
    let host = await redisServer.getHost();
    let port = await redisServer.getPort();
    global.redisClient = createClient({ url: "redis://" + host + ":" + port });
    await global.redisClient.connect();

    console.log("Initialization Completed");

}


