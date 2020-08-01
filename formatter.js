const path = require("path");
const fs = require("fs");
const ejs = require("ejs");

const VM = process.env.VM == "azure" ? "azure" : "win";
const params = {
  "azure": {
    targetDir: `${process.env.GITHUB_WORKSPACE}/artifact`,
  },
  "win": {
    targetDir: `artifact`,
  }
}
const targetDir = params[VM].targetDir;

const templateFile = path.resolve(__dirname, "./templates/daily.ejs");
const template = fs.readFileSync(templateFile, "utf-8");

const date = (new Date((new Date()).toUTCString())).toISOString().slice(0, 10);

const inputs = require(path.resolve(__dirname, `${targetDir}/${date}.json`));
const data = inputs;
const plaintext = ejs.render(template, { filename: templateFile, data });

console.log(plaintext);
