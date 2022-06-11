import log4js from "log4js";
import mysql from "mysql2";
import { createClient } from "redis";
import RedisMemoryServer from "redis-memory-server";
import { Sequelize, STRING, INTEGER } from "sequelize";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose, { Mongoose, Schema, Model, Date } from "mongoose";




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

    const Account = sequelize.define("Account", {
        accountId: {
            type: STRING,
            primaryKey: true,
            validate: { notEmpty: true }
        },
        balance: {
            type: INTEGER,
            validate: { min: 0 }
        }

    });
    await sequelize.sync({ force: true });

    global.seqModels = { "Account": Account };

    // init redis & redisClient
    const redisServer = new RedisMemoryServer();
    let host = await redisServer.getHost();
    let port = await redisServer.getPort();
    global.redisClient = createClient({ url: "redis://" + host + ":" + port });
    await global.redisClient.connect();


    //init mongodb
    const mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 4 } });
    const mongoServerUri = mongoServer.getUri();
    const theMongoose = await mongoose.connect(mongoServerUri);
    const statementModel = theMongoose.model(
        'Statement',
        new Schema({
            accountId: String,
            date: Date,
            desc: String
        })
    );
    global.mongoose = theMongoose;
    global.mongoModels = { "Statement": statementModel };

    console.log("Initialization Completed");

}


