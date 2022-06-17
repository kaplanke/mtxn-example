import { Pool } from "mysql2";
import { Sequelize, ModelStatic } from "sequelize";
import { Mongoose, Model } from "mongoose"

/*
*   Global variable declarations to hold global Context sources
*/
declare global {
    var mysqlPool: Pool;
    var sequelize: Sequelize;
    var seqModels: { [key: string]: ModelStatic<any>; };
    var mongoose: Mongoose;
    var mongoModels: { [key: string]: Model<any>; };
}

export { };