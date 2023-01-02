require('dotenv').config();
const csv = require("csvtojson");


// console.log(process.env);
const csvFilePath='Jira Sprint 18.csv';

csv()
.fromFile(csvFilePath)
.then((jsonObj)=>{
    console.log(jsonObj);
    /**
     * [
     * 	{a:"1", b:"2", c:"3"},
     * 	{a:"4", b:"5". c:"6"}
     * ]
     */ 
});