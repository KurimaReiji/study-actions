const fs = require("fs");
const path = require("path");
const os = require("os");
const puppeteer = require('puppeteer-core');
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

const chromePath = params[VM].chromePath;
const targetDir = params[VM].targetDir;

const today = process.argv.length != 3;

const date = (() => {
  if (process.argv.length == 3) {
    return process.argv.slice(2)[0];
  } else {
    return (new Date((new Date()).toUTCString())).toISOString().slice(0, 10);
  }
})();

const dbfile = `${targetDir}/${date}-status.json`;
const db = require(dbfile);
const oldValue = JSON.stringify(db,null,2);

const scraper_get_games_from_today = () => {
  return Array.from(document.querySelectorAll("#score_live_basic a"))
    .filter((a) => a.href.includes("scores/2020"))
    .filter((a) => !a.textContent.includes("中止"))
    .map((a) => {
      return {
        id: a.href.match(/([bcdefghlmst]{1,2}-[bcdefghlmst]{1,2}-\d\d)/)[1].toUpperCase(),
        "npbjp": {
          url: `${a.href}index.html`,
          status: a.querySelector(".state").textContent.trim(),
        }
      };
    })
    ;
};

const scraper_get_games_of_the_day_from_npbjp = (date) => {
  const mmdd = date.split("-").slice(-2).join("");
  return Array.from(document.querySelectorAll(".summary_table a"))
    .filter((a) => a.href.includes(`scores/2020/${mmdd}`))
    .filter((a) => a.querySelector(".state"))
    .map((a) => {
      return {
        id: a.href.match(/([bcdefghlmst]{1,2}-[bcdefghlmst]{1,2}-\d\d)/)[1].toUpperCase(),
        "npbjp": {
          url: `${a.href}index.html`,
          status: a.querySelector(".state").textContent.trim(),
        }
      };
    })
    ;
};

const scraper_get_targets_from_yahoo = () => {
  return Array.from(document.querySelectorAll("#gm_card a"))
    .filter((a) => {
      const text = a.querySelector(".bb-score__link").textContent;
      return /試合前|試合終了|回(?:表|裏)/.test(text);
    })
    .map((a) => a.href.replace("index", "text"))
    ;
};

const scraper_get_catchers = () => {

  const scraper = () => {
    const set_playersId = () => {
      Array.from(document.querySelectorAll("a"))
        .filter((a) => a.href.includes("/bis/players"))
        .filter((a) => a.href.match(/(\d+)\.html/))
        .forEach((a) => {
          if (!a.textContent.includes("〔")) {
            a.textContent = `〔${a.textContent}｜${a.href.match(/(\d+)\.html/)[1]}〕`
          }
        });
    };

    set_playersId();
    const batteryTable = Array.from(document.querySelectorAll("h4"))
      .filter((el) => el.textContent.includes("バッテリー"))[0].nextElementSibling;
    const catchers = Array.from(batteryTable.querySelectorAll("td"))
      .map((td) => td.textContent.split("　‐　")[1].split("、").map((c) => c.replace(/〔|〕/g, "")))
      .reduce((acc, cur, idx) => {
        if (idx == 0) {
          acc.b = cur;
        } else {
          acc.t = cur;
        }
        return acc;
      }, {});

    return catchers;
  };

  return scraper();
};

const scraper_get_stolenbases = (catchers = { t: ["home"], b: ["road"] }) => {

  const scraper = (catchers = { t: ["home"], b: ["road"] }) => {
    const set_playersId = () => {
      Array.from(document.querySelectorAll("a"))
        .filter((a) => a.href.includes("/bis/players"))
        .filter((a) => a.href.match(/(\d+)\.html/))
        .forEach((a) => {
          if (!a.textContent.includes("〔")) {
            a.textContent = `〔${a.textContent}｜${a.href.match(/(\d+)\.html/)[1]}〕`
          }
        });
    };

    const date = (() => {
      const str = document.querySelector(".game_tit time").textContent.trim();
      const m = str.match(/\d+/g);
      if (m && m.length == 3) {
        return m.map((d) => d.length == 1 ? `0${d}` : d).join("-");
      } else {
        return str;
      }
    })();

    const [home, road] = location.pathname.match(/([bcdefghlmst]{1,2})-([bcdefghlmst]{1,2})-\d/).slice(1, 3).map((s) => s.toUpperCase());

    const gameInfo = {
      url: window.location.href,
      date,
      home, road,
    };

    const targetBase = (str) => {
      return ["二塁", "三塁", "本塁"].map((base, i) => str.includes(base) ? i + 2 : 0)
        .filter((s) => s > 0)[0].toString();
    };

    const RoB = (str) => {
      return ['-', '-', '-'].map((s, i) => {
        if (str == "満塁") {
          return i + 1;
        } else if (str.includes(i + 1)) {
          return i + 1;
        } else {
          return s;
        }
      }).join("");
    };

    const h52obj = (h5) => {
      const text = h5.textContent.trim();
      const m = text.match(/(\d+)回([表裏])/);
      if (m) {
        const obj = {
          tb: m[2] == "表" ? "t" : "b",
          inning: m[1]
        }
        obj.text = `${obj.tb}${obj.inning}`;
        return obj;
      } else {
        return false;
      };
    };

    const combineDoubleSteal = (acc, cur) => {
      if (cur.ds == "DS" && acc.slice(-1)[0].ds == "DS") {
        const item = acc.pop();
        cur.runners = item.runners.concat(cur.runners);
        cur.text = [item.text, cur.text].join("／");
        cur.base += item.base;
      }
      return acc.concat(cur)
    }

    set_playersId();
    const create_inning_object = (el) => el.tagName == "TR" ? el : h52obj(el);
    const add_inning_property = (item, idx, ary) => {
      if (item.hasOwnProperty("inning")) return item;
      return {
        element: item,
        inning: ary.slice(0, idx).filter((obj) => obj.hasOwnProperty("inning")).slice(-1)[0].text,
      };
    };
    const remove_inning_object = (item) => item.hasOwnProperty("element");
    const create_pitcher_object = (obj) => {
      const tds = Array.from(obj.element.querySelectorAll("td")).map((td) => td.textContent.trim());
      if (tds.length == 1) {
        const p = tds[0].match(/投手[\S\s]+ 〔(\S+)〕$/);
        const pObj = { pitcher: {}, inning: obj.inning };
        if (p) {
          pObj.pitcher[obj.inning[0]] = p[1];
        }
        return pObj;
      } else {
        return {
          row: tds,
          inning: obj.inning,
        }
      }
    };
    const add_pitcher_property = (item, idx, ary) => {
      if (item.hasOwnProperty("pitcher")) return item;
      const pitcher = ary.slice(0, idx)
        .filter((obj) => obj.hasOwnProperty("pitcher"))
        .filter((obj) => obj.inning[0] == item.inning[0])
        .slice(-1)[0].pitcher[item.inning[0]]
        ;
      return Object.assign({ pitcher }, item);
    };
    const remove_pitcher_object = (item) => item.hasOwnProperty("row");

    const plays = Array.from(document.querySelectorAll("#progress tr, #progress h5"))
      .filter((el) => !el.querySelector("th"))
      .map(create_inning_object)
      .map(add_inning_property)
      .filter(remove_inning_object)
      .map(create_pitcher_object)
      .map(add_pitcher_property)
      .filter(remove_pitcher_object)
      .map((obj, idx, ary) => {
        const row = obj.row;
        if (row.slice(-1)[0].includes("盗塁")) {
          const batter = ary.slice(idx)
            .filter((item) => item.hasOwnProperty("row") && item.row[2].length > 0)[0]
            .row[2].replace("代打・", "").replace(/〔|〕/g, "");
          return {
            inning: obj.inning,
            pitcher: obj.pitcher,
            catchers: catchers[obj.inning[0]],
            batter,
            runners: [row[4].match(/（走者・〔(\S+?)〕）/)[1]],
            sb: row[4].includes("盗塁成功") ? "SB" : "",
            cs: row[4].includes("盗塁失敗") ? "CS" : "",
            base: targetBase(row[4]),
            ds: row[4].includes("ダブルスチール") ? "DS" : "",
            outs: row[0].match(/\d/)[0],
            RoB: RoB(row[1]),
            credit: "1",
            text: row.join("｜")
          };
        } else {
          return false;
        }
      })
      .filter((sb) => sb)
      .reduce(combineDoubleSteal, [])
      .map((obj) => Object.assign({}, gameInfo, obj))
      ;

    return plays;
  };

  const data = { attempts: scraper(catchers) };
  data.status = document.querySelector(".game_info").textContent.includes("試合終了");
  return data;
};

const scraper_get_stolenbases_from_yahoo = () => {

  const set_playersId = () => {
    Array.from(document.querySelectorAll("a"))
      .filter((a) => a.href.match(/player\/(\d+)/))
      .forEach((a) => {
        if (!a.textContent.includes("〔")) {
          a.textContent = `〔${a.textContent}｜${a.href.match(/player\/(\d+)/)[1]}〕`
        }
      });
  };

  const teams = {
    "巨人": "G",
    "ＤｅＮＡ": "DB",
    "阪神": "T",
    "広島": "C",
    "中日": "D",
    "東京ヤクルト": "S",
    "ヤクルト": "S",
    "西武": "L",
    "ソフトバンク": "H",
    "楽天": "E",
    "ロッテ": "M",
    "日本ハム": "F",
    "オリックス": "B"
  };

  const gameInfo = {
    date: location.pathname.match(/(2020)(\d\d)(\d\d)/).slice(-3).join("-"),
    url: location.href,
    title: document.querySelector(".bb-head01__title").textContent.split("\n").map((s) => s.trim()).filter((s) => s).join(" "),
  };

  gameInfo.title.match(/ (\S+) vs. (\S+) (\d+)回戦/).slice(1, 5).forEach((t, idx) => {
    if (idx == 0) gameInfo["home"] = teams[t];
    if (idx == 1) gameInfo["road"] = teams[t];
    if (idx == 2) gameInfo["gameNo"] = `0${t}`.slice(-2);
  });

  const header2obj = (el) => {
    return {
      inning: el.id ? el.id : "00"
    };
  };

  const create_inning_object = (el) => el.tagName == "OL" ? el : header2obj(el);
  const add_inning_property = (item, idx, ary) => {
    if (item.hasOwnProperty("inning")) return item;
    return {
      element: item,
      inning: ary.slice(0, idx).filter((obj) => obj.hasOwnProperty("inning")).slice(-1)[0].inning,
    };
  };
  const remove_inning_object = (item) => item.hasOwnProperty("element");

  const add_starting_batteries = (item) => {
    if (item.inning == "00") {
      const lines = item.summary.join("＃");
      const p = lines.match(/[がのでる] 〔(\S+?)〕 .*[がのでる] 〔(\S+)〕/);
      item.pitchers = { t: p[1], b: p[2] };

      const c = lines.match(/〔(\S+?)〕\s\(捕\)[\S\s]+〔(\S+?)〕\s\(捕\)/)
      item.catchers = { t: c[2], b: c[1] };
    }
    return item;
  };

  const updat_batteries = (item, idx, ary) => {
    const substitutes = ary.slice(0, idx + 1)
      .filter((o) => o.inning[0] == item.inning[0])
      .filter((o) => o.text.includes("SUBSTI"))
      ;
    const onMound = substitutes.filter((o) => /投手交代|ピッチャー/.test(o.text));
    item.pitcher = onMound.length > 0 ? onMound.slice(-1)[0].text.match(/投手交代:.*?→ 〔(\S+)〕|ピッチャー.*? 〔(\S+)〕 がマウンドにあがる/).slice(-2).filter((s) => s)[0] : ary[0].pitchers[item.inning[0]];
    const onPlate = substitutes.filter((o) => /キャッチャー/.test(o.text));
    item.catcher = onPlate.length > 0 ? onPlate.slice(-1)[0].text.match(/守備交代:キャッチャー\s+〔(\S+)〕|守備変更.*? 〔(\S+)〕 \S*→キャッチャー|〔(\S+)〕 がキャッチャーの守備につく/).slice(-3).filter((s) => s)[0] : ary[0].catchers[item.inning[0]];
    return item;
  };

  const re_stealattempts = RegExp(/盗塁|スチール|三振！スタートを切っていた\S+走者|走者スタート！その間に|走者スタート！.*?飛び出して|飛び出しておりアウト/);

  const RoB = (str) => {
    return ['-', '-', '-'].map((s, i) => {
      if (str == "満塁") {
        return i + 1;
      } else if (str.includes(i + 1)) {
        return i + 1;
      } else {
        return s;
      }
    }).join("");
  };

  set_playersId();
  const attempts = Array.from(document.querySelectorAll(".bb-liveText__head, .bb-liveText__orderedList"))
    .map(create_inning_object)
    .map(add_inning_property)
    .filter(remove_inning_object)
    .map((item) => {
      const lis = Array.from(item.element.querySelectorAll(".bb-liveText__item"))
        .filter((li) => li.querySelector(".bb-liveText__player"))
        .map((li) => {
          const order = item.inning[0] != "0" ? li.querySelector(".bb-liveText__number").textContent.trim() : "00";
          return {
            batter: item.inning[0] != "0" ? li.querySelector(".bb-liveText__player").textContent.trim().replace(/〔|〕/g, "") : undefined,
            state: item.inning[0] != "0" ? li.querySelector(".bb-liveText__state").textContent.trim() : undefined,
            summary: Array.from(li.querySelectorAll(".bb-liveText__summary"))
              .map((p) => {
                let text = p.textContent.split("\n").map((line) => line.trim()).filter((s) => s).join(" ");
                if (p.classList.contains("bb-liveText__summary--change")) {
                  text = `SUBSTITUTE: ${text}`;
                }
                return text;
              }),
            inning: item.inning,
            order: `${item.inning.replace(/t|b/, "")}${item.inning}${order}`,
          };
        })
      return lis;
    })
    .reduce((acc, cur) => acc.concat(cur))
    .sort((a, b) => {
      if (a.order > b.order) {
        return 1;
      } else if (a.order < b.order) {
        return -1;
      } else {
        return 0;
      }
    })
    .map(add_starting_batteries)
    .map((obj) => {
      return obj.summary.map((text) => {
        return {
          inning: obj.inning,
          batter: obj.batter,
          state: obj.state,
          text,
          pitchers: obj.pitchers,
          catchers: obj.catchers,
        };
      })
    })
    .reduce((acc, cur) => acc.concat(cur))
    .map(updat_batteries)
    .map((item, idx, ary) => {
      if (idx != 0 && ary[idx - 1].text.match(/けん制:ランナー 〔(\S+)〕 スタート/)) {
        item.pickoff = ary[idx - 1].text;
        item.credit = 0;
      } else {
        item.credit = 1;
      }
      return item;
    })
    .filter((item) => re_stealattempts.test(item.text))
    .map((item, idx, ary) => {
      const msb = item.text.match(/([一二三])塁走者[\s\S]+〔(\S+)〕.*(?:盗塁|スチール)成功/);
      const mcs = item.text.match(/([一二三])塁走者[\s\S]+〔(\S+)〕.*(?:本塁突入を試みるもタッチアウト|盗塁を試みるもアウト|盗塁失敗|本塁突入をねらうもタッチアウト|ホームスチールをねらうもタッチアウト|も飛び出しておりタッチアウト|飛び出しておりアウト)/);
      const mkc = item.text.match(/三振！スタートを切っていた([一二三])塁走者[\s\S]+〔(\S+)〕.*もアウト/);

      if (msb) {
        item.sb = "SB";
        item.cs = "";
        item.runners = [msb[2]];
        item.base = 2 + ["一", "二", "三"].indexOf(msb[1]);

        const mds = item.text.match(/([一二三])塁走者[\s\S]+〔(\S+)〕.*([一二三])塁走者[\s\S]+〔(\S+)〕.*成功/);
        if (mds) {
          item.ds = "DS";
          item.runners = mds.slice(1).filter((s) => s.includes("｜")).reverse();
          item.base = mds.slice(1).map((s) => 2 + ["一", "二", "三"].indexOf(s)).filter((i) => i > 1).sort().join("");
        }
      } else if (mcs) {
        item.sb = "";
        item.cs = "CS";
        item.runners = [mcs[2]];
        item.base = 2 + ["一", "二", "三"].indexOf(mcs[1]);
      } else if (mkc) {
        item.sb = "";
        item.cs = "CS";
        item.runners = [mkc[2]];
        item.base = 2 + ["一", "二", "三"].indexOf(mkc[1]);
      }
      item.outs = ["無", "一", "二"].indexOf(item.state.match(/(\S)死/)[1]);
      item.RoB = RoB(item.state.match(/([\d,]+)塁/)[1])
      return item;
    })
    .map((item) => Object.assign({}, gameInfo, item))
    ;

  const data = { attempts };
  data.status = Array.from(document.querySelectorAll(".bb-liveText__summary")).some((el) => el.textContent.includes("試合終了"));
  data.id = [gameInfo.home, gameInfo.road, gameInfo.gameNo].join("-");

  return data;
};

const npbUrl = today ? `https://npb.jp/games/2020/` : `https://npb.jp/games/2020/schedule_${date.split("-")[1]}_detail.html`;
const npbscr = today ? scraper_get_games_from_today : scraper_get_games_of_the_day_from_npbjp;

(async () => {
  const browser = await puppeteer.launch({
    headless: VM == "azure",
    executablePath: chromePath,
  });
  const page = await browser.newPage();
  page.setViewport({ width: 1200, height: 800 })



  if (!db.hasOwnProperty("numOfGames")) {
    await page.goto(npbUrl);
    await page.waitForSelector(".state");
    db.games = await page.evaluate(npbscr, date);
    db["numOfGames"] = db.games.length;
  }

  let targets = db.games
    .filter((obj) => obj.npbjp.status !== "Final")
    .filter((obj) => /-|試合終了|回(?:表|裏)/.test(obj.npbjp.status))
    ;

  for (let game of targets) {
    const gameUrl = game.npbjp.url;
    await page.goto(gameUrl);
    await page.waitFor(200);
    const catchers = await page.evaluate(scraper_get_catchers);
    await page.waitFor(800);

    await page.goto(gameUrl.replace("index.html", "playbyplay.html"));
    await page.waitFor(200);
    const d = await page.evaluate(scraper_get_stolenbases, catchers);
    game.npbjp.attempts = d.attempts;
    if (d.status) game.npbjp.status = "Final";
    const idx = db.games.findIndex((obj) => obj.id == game.id);
    db.games[idx] = game;
  };

  let yTargets = [];
  if (db.games.length > 0 && !db.games[0].hasOwnProperty("yahoo")) {
    await page.goto(`https://baseball.yahoo.co.jp/npb/schedule/?date=${date}`);
    await page.waitForSelector("#gm_card");
    yTargets = await page.evaluate(scraper_get_targets_from_yahoo);
  } else {
    yTargets = db.games
      .filter((obj) => obj.yahoo.status != "Final")
      .map((obj) => obj.yahoo.url)
      ;
  }

  for (let gameUrl of yTargets) {
    await page.goto(gameUrl);
    await page.waitFor(200);
    await page.waitForSelector("section.bb-liveText");
    const d = await page.evaluate(scraper_get_stolenbases_from_yahoo);
    await page.waitFor(800);

    const yahoo = { url: gameUrl, attempts: d.attempts, status: d.status };
    if (d.status) yahoo.status = "Final";

    const idx = db.games.findIndex((obj) => obj.id == d.id);

    if (idx > -1) {
      console.log([idx, d.id]);
      db.games[idx].yahoo = yahoo;
    } else {
      console.log(d);
      console.log(yahoo);
    }
  };

  await page.waitFor(1200);
  await browser.close();

  const output = JSON.stringify(db, null, 2);
  if(output !== oldValue) {
    fs.writeFileSync(dbfile, output);
  };

})();
