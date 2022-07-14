import express, { Express } from "express";
import accounts from "./routes/accounts";
import credits from "./routes/credits";
import init from "./service/init";


/*
*   Create the basic express app
*/
const app: Express = express();
app.use(express.json());
app.use(express.static('public'));
app.use("/accounts", accounts);
app.use("/credits", credits);
init().then(() => {
    app.listen(3000, () => { console.log("Server running at http://127.0.0.1:3000") });
}).catch((err) => {
    console.log(err);
    console.log("Unfortunately quitting.....");
});

