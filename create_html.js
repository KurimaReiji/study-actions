const path = require("path");
const fs = require("fs");
const ejs = require("ejs");

if (process.argv.length < 3) {
  console.error("Usage: node script.js target");
  process.exit(1);
};

const outfile = process.argv[2];
const target = outfile.replace("fragments/", "");

const data = require(path.resolve(__dirname, `data/${target.replace(".html", ".json")}`));
const templateFile = path.resolve(__dirname, `templates/${target.replace(".html", ".ejs")}`);
const template = fs.readFileSync(templateFile, "utf-8");

const html = ejs.render(template, { filename: templateFile, data });
const buf = fs.readFileSync(outfile, null, {encoding: 'utf-8'});

if(html != buf) {
  fs.writeFileSync(outfile, html);
}