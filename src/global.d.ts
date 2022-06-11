import { Pool } from "mysql2";
import { Sequelize, ModelStatic } from "sequelize";
import { createClient } from "redis";
import { Mongoose, Model } from "mongoose"

declare global {
    var mysqlPool: Pool;
    var redisClient: ReturnType<typeof createClient>;
    var sequelize: Sequelize;
    var seqModels: { [key: string]: ModelStatic<any>; };
    var mongoose: Mongoose;
    var mongoModels: { [key: string]: Model<any>; };
}

export { };