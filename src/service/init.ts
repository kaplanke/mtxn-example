import mysql from "mysql";
import RedisMemoryServer from "redis-memory-server";
import { Sequelize, STRING, Model } from "sequelize";
import { createClient } from "redis";


const dbConfig = {
    connectionLimit: 3,
    host: "localhost",
    user: "root",
    password: "1q2w3e4r",
    database: "mtxnmngr",
}


export default async () => {

    // init Mysql
    global.mysqlPool = mysql.createPool(dbConfig);

    // init sequelize
    global.sequelize = new Sequelize(
        "mysql://" + dbConfig.host + "/" + dbConfig.database,
        dbConfig.user,
        dbConfig.password,
        { dialect: 'mysql', logging: false }
    );
    const User = sequelize.define("User", {
        email: {
            type: STRING,
            primaryKey: true
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


