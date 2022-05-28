import { Pool } from "mysql";
import { Sequelize, ModelStatic } from "sequelize";
import { createClient } from "redis";

declare global {
    var mysqlPool: Pool;
    var redisClient: ReturnType<typeof createClient>;
    var sequelize: Sequelize;
    var models: { [key: string]: ModelStatic<any>; };
}

export { };