# Multiple Transaction Manager Example Project

An example project to demonstrate the usage of multiple-transaction-manager.

> Please see multiple-transaction-manager page for detailed information about the library

https://github.com/kaplanke/mtxn

In this example, an account management system is implemented with very basic and limited feature set. The user can create accounts and set their balances. 
During these operations, a relational DB (mysql) is used for keeping the account information. The account activity is recorded in a document DB (mongodb) and finally when the account is depleted, a lead for credit campaign is pushed to a redis queue. 

The aim of the example, ant the library, is to manage all these operations within a transaction.
The library orchestrates the transactions for each context (mysql, mongodb, and redis) and commits (or rollbacks) each context at the end of each request.

Please keep in mind that all data will be erased when the server is restarted. If you like to persist the data, you may alter the _init.ts_ file for pointing out the persistent databases.

![MTXN Screen snapshots](https://raw.githubusercontent.com/kaplanke/mtxn/master/mtxn_ss.png)