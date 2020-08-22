const fs = require("fs");
const path = require("path");

const dbfile = path.resolve(__dirname, `./docs/data.json`);
const outfile = path.resolve(__dirname, `./data/catchers.json`);

const inputs = require(dbfile)
  //.filter((obj) => !obj.date.match(/2020-08-1[8-9]/))
  ;

const teams = {
  "G": "Yomiuri Giants",
  "DB": "DeNA Baystars",
  "T": "Hanshin Tigers",
  "C": "Hiroshima Carp",
  "D": "Chunichi Dragons",
  "S": "Yakult Swallows",
  "L": "Seibu Lions",
  "H": "SoftBank Hawks",
  "E": "Rakuten Eagles",
  "M": "Lotte Marines",
  "F": "Nippon-Ham Fighters",
  "B": "ORIX Buffaloes"
};

const calc_cspct = (inputs) => {
  const formatter = (obj) => {
    const team = obj.inning[0] == "t" ? obj.road : obj.home;
    return {
      date: obj.date,
      runners: obj.runners
      //.map((r) => toNplayer(r, team))
      //.map((obj) => simplifyPlayer(obj))
    }
  };
  const sortByAttempts = (a, b) => {
    const criteria = [a, b].map((k) => {
      const sb = k.sb.length;
      const cs = k.cs.length;
      const d = [sb + cs, cs, sb].map((i) => `000${i}`.slice(-3)).join("")
      return `${d}`;
    });

    if (criteria[0] > criteria[1]) {
      return -1;
    } else if (criteria[0] < criteria[1]) {
      return 1;
    } else {
      return 0;
    }
  };

  const formatPct = (val) => {
    if (val == 0) {
      return '-';
    } else if (val == 1) {
      return '1.000';
    } else {
      return `${Math.round(val * 1000) / 1000}000`.slice(0, 5);
    }
  }

  const catchers = inputs
    .map((obj) => obj.catcher)
    .filter((item, idx, ary) => ary.indexOf(item) === idx)
    ;
  const data = catchers
    .map((c) => {
      const attempt = inputs.filter((obj) => obj.catcher == c && obj.credit == "1");
      const sb = attempt.filter((obj) => obj.sb == "SB");
      const cs = attempt.filter((obj) => obj.cs == "CS");
      const team = attempt[0].inning[0] == "t" ? attempt[0].home : attempt[0].road;
      return {
        catcher: c,//simplifyPlayer(toNplayer(c, team)),
        sb: sb.map(formatter),
        cs: cs.map(formatter),
        csPct: cs.length / (sb.length + cs.length),
        team,
      }
    })
    .filter((c) => c.sb.length > 0 || c.cs.length > 0)
    .sort(sortByAttempts)
    .map((obj) => {
      return {
        catcher: obj.catcher.replace(/｜\d+/, ""),
        csPct: formatPct(obj.csPct),
        cs: obj.cs.length,
        sb: obj.sb.length,
        team: obj.team,
        league: ["G", "DB", "T", "C", "D", "S"].indexOf(obj.team) > -1 ? "central" : "pacific",
      }
    })
    ;
  return data;
}

const data = calc_cspct(inputs);
const json = JSON.stringify(data, null, 2);
fs.writeFileSync(outfile, json);
