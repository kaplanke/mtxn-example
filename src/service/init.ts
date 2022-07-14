import log4js from "log4js";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose, { Schema } from "mongoose";
import mysql from "mysql2";
import { createClient } from "redis";
import RedisMemoryServer from "redis-memory-server";
import { INTEGER, Sequelize, STRING } from "sequelize";



/*
* Prerequisite: Change the the DB connection according to your DB credentials.
*               PostgreSQL or MSSQL can also be used with adding related context dependencies.
*/
const dbConfig = {
    connectionLimit: 3,
    host: "localhost",
    user: "root",
    password: "changeme",
    database: "mtxnmngr",
}


/*
* Init the system
*/
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
            host: dbConfig.host,
            dialect: "mysql" // -> also change this line if you want to use any other DB instead...
        });
    const Account = sequelize.define("Account", {
        accountId: {
            type: INTEGER,
            autoIncrement: true,
            primaryKey: true
        },
        accountName: {
            type: STRING,
            unique: true,
            validate: { notEmpty: true }
        },
        balance: {
            type: INTEGER,
            validate: { min: 0 }
        }
    }, {
        initialAutoIncrement: "100000",
    });
    await sequelize.sync({ force: true });
    global.seqModels = { "Account": Account };

    // init redis & redisClient
    const redisServer = new RedisMemoryServer();
    const host = await redisServer.getHost();
    const port = await redisServer.getPort();
    global.redisClient = createClient({ url: "redis://" + host + ":" + port });
    await global.redisClient.connect();
    global.redisQueues = {};
    global.redisQueues.REDIS_CREDIT_PROMOTION_QUEUE = "queue:creditPromotions";


    //init mongodb
    const mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 4 } });
    const mongoServerUri = mongoServer.getUri();
    const theMongoose = await mongoose.connect(mongoServerUri);
    const activityModel = theMongoose.model(
        'Activity',
        new Schema({
            accountId: Number,
            date: Date,
            desc: String
        })
    );
    global.mongoose = theMongoose;
    global.mongoModels = { "Activity": activityModel };

    console.log("Initialization Completed");

}


