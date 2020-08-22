const path = require("path");
const fs = require("fs");
const ejs = require("ejs");

const outfile = path.resolve(__dirname, `docs/index.html`);

const data = {};//require(path.resolve(__dirname, `data/${target.replace(".html", ".json")}`));
const templateFile = path.resolve(__dirname, `templates/layout.ejs`);
const template = fs.readFileSync(templateFile, "utf-8");

const html = ejs.render(template, { filename: templateFile, data });
const buf = fs.readFileSync(outfile, null, {encoding: 'utf-8'});

if(html != buf) {
  fs.writeFileSync(outfile, html);
}