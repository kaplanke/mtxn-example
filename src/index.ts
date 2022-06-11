import express, { Express } from "express";
import accounts from "./routes/accounts";
import init from "./service/init";

const app: Express = express();
app.use(express.json());
app.use(express.static('public'));
app.use("/accounts", accounts);
init().then(() => {
    app.listen(3000, () => { console.log("Server running at http://127.0.0.1:3000") });
}).catch((err) => {
    console.log(err);
    console.log("Unfortunately quitting.....");
});

