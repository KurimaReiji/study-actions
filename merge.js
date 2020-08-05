const fs = require("fs");
const path = require("path");
const os = require("os");
const errHandler = (err) => console.log(err);

const VM = os.type() === "Linux" ? "azure" : "win";
const params = {
  "azure": {
    chromePath: "/usr/bin/google-chrome",
    targetDir: `${process.env.GITHUB_WORKSPACE}/artifact`,
  },
  "win": {
    chromePath: "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    targetDir: path.resolve(__dirname, "./artifact"),
  }
}

const targetDir = params[VM].targetDir;

const date = (() => {
  if (process.argv.length == 3) {
    return process.argv.slice(2)[0];
  } else {
    return (new Date((new Date()).toUTCString())).toISOString().slice(0, 10);
  }
})();

const db = require(`${targetDir}/${date}-status.json`);
const games = db.games;
const outfile = `${targetDir}/${date}.json`;

const add_attemptId = (obj) => {
  const id = [
    obj.date, obj.home, obj.road, obj.inning, obj.sb, obj.cs, obj.outs,
  ].join("=");
  return Object.assign({ attempt: id }, obj);
};

const data = games
  .map((g) => {
    const yah = g.yahoo.attempts
      .map(add_attemptId)
      .map((obj) => {
        obj.catcher = obj.catcher.replace("Ａ．マルティネス｜1800008", "A.マルティネス｜73975136");
        return obj;
      })
      ;
    const npbjp = g.npbjp.attempts
      .map(add_attemptId)
      .map((obj) => {
        if (obj.catchers.length == 1) {
          obj.catcher = obj.catchers[0];
        }
        return obj;
      })
      .map((obj) => {
        const ysb = yah.find((o) => o.attempt == obj.attempt);
        if (ysb) {
          if (obj.catchers.length > 1) {
            obj.catcher = obj.catchers.find((c) => c.split("｜")[0] == ysb.catcher.split("｜")[0]);
          }
          obj.credit = ysb.credit;
          obj.ytext = [ysb.pickoff, ysb.text].filter((s) => s).join("\n");
        } else {
          console.log(`${obj.attempt}`);
        }
        return obj;
      })
      .map((obj) => {
        delete obj.attempt;
        return obj;
      })
      ;
    return npbjp;
  })
  .reduce((acc, cur) => acc.concat(cur))
  ;

const output = JSON.stringify(data, null, 2);
fs.writeFileSync(outfile, output);
