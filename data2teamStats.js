const fs = require("fs");
const path = require("path");

const dbfile = path.resolve(__dirname, `./docs/data.json`);
const outfile = path.resolve(__dirname, `./data/teamStats.json`);

const inputs = require(dbfile);

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

const formatPct = (val) => {
  if (val == 0) {
    return '-';
  } else if (val == 1) {
    return '1.000';
  } else {
    return `${Math.round(val * 1000) / 1000}000`.slice(0, 5);
  }
}

const data = inputs
  //.filter((obj)=>!obj.date.match(/2020-08-1[89]/))
  ;

const stats = {};
Object.keys(teams)
  .forEach((t) => {
    const d = data.filter((obj) => [obj.home, obj.road].includes(t));
    const batting = d
      .filter((obj) => {
        if (obj.inning[0] == "t" && obj.road == t) {
          return true;
        } else if (obj.inning[0] == "b" && obj.home == t) {
          return true;
        } else {
          return false;
        }
      })
      ;
    const fielding = d
      .filter((obj) => {
        if (obj.inning[0] == "t" && obj.home == t) {
          return true;
        } else if (obj.inning[0] == "b" && obj.road == t) {
          return true;
        } else {
          return false;
        }
      })
      ;

    const cBatting = batting.filter((obj) => obj.credit > 0);
    const cFielding = fielding.filter((obj) => obj.credit > 0);

    stats[t] = {
      name: teams[t],
      batting: {
        sb: batting
          .filter((obj) => obj.sb == "SB")
          .map((obj) => obj.runners.length)
          .reduce((acc, cur) => acc + cur, 0),
        cs: batting
          .filter((obj) => obj.cs == "CS").length,
        csb: cBatting
          .filter((obj) => obj.sb == "SB").length,
        ccs: cBatting
          .filter((obj) => obj.cs == "CS").length,
      },
      fielding: {
        sb: fielding
          .filter((obj) => obj.sb == "SB")
          .map((obj) => obj.runners.length)
          .reduce((acc, cur) => acc + cur, 0),
        cs: fielding
          .filter((obj) => obj.cs == "CS").length,
        csb: cFielding
          .filter((obj) => obj.sb == "SB").length,
        ccs: cFielding
          .filter((obj) => obj.cs == "CS").length,
      },
    };

    stats[t].batting.sbPct = formatPct(stats[t].batting.csb / (stats[t].batting.csb + stats[t].batting.ccs));

    stats[t].fielding.csPct = formatPct(stats[t].fielding.ccs / (stats[t].fielding.csb + stats[t].fielding.ccs));
  })
  ;

const ary = Object.keys(teams)
  .map((t, idx) => Object.assign({ team: t, league: idx > 5 ? "Pacific" : "Central" }, stats[t]))
  .sort((a, b) => {
    const [aa, bb] = [a, b].map((x) => {
      return [
        x.fielding.sb + x.fielding.cs,
        x.fielding.sb,
        x.fielding.cs,
        x.batting.sb + x.batting.cs,
        x.batting.sb,
        x.batting.cs,
      ].map((n) => `00${n}`.slice(-3)).join(" ");
    })
    if (aa > bb) {
      return -1;
    } else if (aa < bb) {
      return 1;
    } else {
      return 0;
    }
  })
  ;

["Pacific", "Central"].forEach((league) => {
  const ldata = ary.filter((obj) => obj.league == league);
  const bsb = ldata
    .reduce((acc, cur) => acc + cur.batting.sb, 0);
  const bcs = ldata
    .reduce((acc, cur) => acc + cur.batting.cs, 0);
  const fsb = ldata
    .reduce((acc, cur) => acc + cur.fielding.sb, 0);
  const fcs = ldata
    .reduce((acc, cur) => acc + cur.fielding.cs, 0);
  const cbsb = ldata
    .reduce((acc, cur) => acc + cur.batting.csb, 0);
  const cbcs = ldata
    .reduce((acc, cur) => acc + cur.batting.ccs, 0);
  const cfsb = ldata
    .reduce((acc, cur) => acc + cur.fielding.csb, 0);
  const cfcs = ldata
    .reduce((acc, cur) => acc + cur.fielding.ccs, 0);
  ary.push({
    league,
    name: "League Total",
    team: "Z",
    batting: { attempt: bsb + bcs, sb: bsb, cs: bcs, sbPct: formatPct(cbsb / (cbsb + cbcs)) },
    fielding: { attempt: fsb + fcs, sb: fsb, cs: fcs, csPct: formatPct(cfcs / (cfsb + cfcs)) },
  });
});

const updated = data.map((obj) => obj.date).sort().slice(-1)[0];

const json = JSON.stringify({ data: ary, updated }, null, 2);
fs.writeFileSync(outfile, json);

