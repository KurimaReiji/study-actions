const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer-core");

const errHandler = (err) => console.log(err);
const chromePath = "/usr/bin/google-chrome";
const targetDir = `${process.env.GITHUB_WORKSPACE}/json/`;

const date = (new Date((new Date()).toUTCString())).toISOString().slice(0,10);
const outfile = path.resolve(__dirname, `${targetDir}/${date}.json`);

const scraper_get_targets = ()=>{
  return Array.from(document.querySelectorAll("#score_live_basic a"))
    .filter((a)=>a.href.includes("scores/2020") && a.querySelector(".state").textContent.includes("試合終了"))
    .map((a)=>`${a.href}index.html`)
    ;
};

const scraper_get_targets_from_yahoo = ()=>{
  return Array.from(document.querySelectorAll("#gm_card a")).filter((a) => a.querySelector(".bb-score__link").textContent.includes("試合終了")).map((a) => a.href.replace("index", "text"));
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
  const outfile = `npb-${location.pathname.split("/").slice(-4).join("-").replace(/(\d{4})-(\d{4})/, "$1$2").replace("playbyplay.html", "sbcs.json")}`;

  const output_json = (data, outfile) => {
    const $json = JSON.stringify(data, null, 2);
    const bb = new Blob([$json]);

    document.body.insertAdjacentHTML('beforeend', `<a id="jsDownloader">Download</a>`);

    const dl = document.getElementById("jsDownloader");
    dl.href = window.URL.createObjectURL(bb);
    dl.setAttribute("download", outfile);
    dl.click();
    document.body.removeChild(dl);
  };

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

  const data = scraper(catchers);

  //output_json(data, outfile);
  return data;
};

const scraper_get_stolenbases_from_yahoo = () => {
  const outfile = `yahoo-${location.pathname.match(/(\d+)/)[0]}-sbcs.json`;

  const output_json = (data, outfile) => {
    const $json = JSON.stringify(data, null, 2);
    const bb = new Blob([$json]);

    document.body.insertAdjacentHTML('beforeend', `<a id="jsDownloader">Download</a>`);

    const dl = document.getElementById("jsDownloader");
    dl.href = window.URL.createObjectURL(bb);
    dl.setAttribute("download", outfile);
    dl.click();
    document.body.removeChild(dl);
  };

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

  gameInfo.title.match(/ (\S+) vs. (\S+) /).slice(1, 4).map((t) => teams[t]).forEach((t, idx) => {
    gameInfo[idx == 0 ? 'home' : 'road'] = t;
  })

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

  const re_stealattempts = RegExp(/盗塁|スチール|三振！スタートを切っていた\S+走者|走者スタート！その間に/);

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
  const data = Array.from(document.querySelectorAll(".bb-liveText__head, .bb-liveText__orderedList"))
    .map(create_inning_object)
    .map(add_inning_property)
    .filter(remove_inning_object)
    .map((item) => {
      const lis = Array.from(item.element.querySelectorAll(".bb-liveText__item"))
        .filter((li) => li.querySelector(".bb-liveText__player"))
        .map((li) => {
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
          };
        })
      return lis;
    })
    .reduce((acc, cur) => acc.concat(cur))
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
      const mcs = item.text.match(/([一二三])塁走者[\s\S]+〔(\S+)〕.*(?:本塁突入を試みるもタッチアウト|盗塁を試みるもアウト|盗塁失敗)/);
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

  //output_json(data, outfile);
  return data;
};

const add_attemptId = (obj) => {
  const id = [
    obj.date, obj.home, obj.road, obj.inning, obj.sb, obj.cs, obj.outs,
  ].join("=");
  return Object.assign({ attempt: id }, obj);
};

let npbjp = [];
let yahoo = [];

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: chromePath,
  });
  const page = await browser.newPage();
  page.setViewport({ width: 1200, height: 800 })

  await page.goto(`https://npb.jp/games/2020/`);
  await page.waitForSelector(".state");
  const targets = await page.evaluate(scraper_get_targets);
  console.log(targets);

  for (let gameUrl of targets) {
    await page.goto(gameUrl);
    await page.waitFor(200);
    const catchers = await page.evaluate(scraper_get_catchers);
    await page.waitFor(800);

    await page.goto(gameUrl.replace("index.html", "playbyplay.html"));
    await page.waitFor(200);
    const d = await page.evaluate(scraper_get_stolenbases, catchers);
    npbjp = npbjp.concat(d);
  };

  await page.goto(`https://baseball.yahoo.co.jp/npb/schedule/?date=${date}`);
  await page.waitForSelector("#gm_card");
  const yTargets = await page.evaluate(scraper_get_targets_from_yahoo);

  for (let gameUrl of yTargets) {
    await page.goto(gameUrl);
    await page.waitFor(200);
    await page.waitForSelector("section.bb-liveText");
    const d = await page.evaluate(scraper_get_stolenbases_from_yahoo);
    await page.waitFor(800);
    yahoo = yahoo.concat(d);
  }

  await page.waitFor(1200);
  await browser.close();

  fs.writeFileSync(path.resolve(__dirname, `${targetDir}/npbjp.json`, JSON.stringify(npbjp, null, 2)));
  fs.writeFileSync(path.resolve(__dirname, `${targetDir}/yahoo.json`, JSON.stringify(yahoo, null, 2)));
 
  const npb = npbjp
    .map(add_attemptId)
    ;

  const yah = yahoo
    .map(add_attemptId)
    .map((obj) => {
      obj.catcher = obj.catcher.replace("Ａ．マルティネス｜1800008", "A.マルティネス｜73975136");
      return obj;
    })
    ;

  const add = [
    {
      "attempt": "2020-06-28=L=H=b4==CS=2",
      "credit": "0",
      "memo": "投球前"
    },
    {
      "attempt": "2020-07-03=S=DB=b8==CS=2",
      "credit": "0",
      "memo": "投球前"
    },
    {
      "attempt": "2020-07-04=S=DB=b7=SB==2",
      "credit": "0",
      "memo": "投手悪送球"
    },
    {
      "attempt": "2020-07-12=B=F=b2==CS=2",
      "credit": "0",
      "memo": "投球前"
    },
    {
      "attempt": "2020-07-15=B=H=t1==CS=2",
      "credit": "0",
      "memo": "投球前"
    },
    {
      "attempt": "2020-07-15=D=DB=b7=SB==2",
      "credit": "0",
      "memo": "投球前"
    },
    {
      "attempt": "2020-07-16=F=M=t9==CS=2",
      "credit": "0",
      "memo": "投球前"
    },
    {
      "attempt": "2020-07-19=C=S=t7==CS=1",
      "credit": "0",
      "memo": "投球前"
    }
  ];

  let data = [];

  try {
    data = npb
      .map((obj) => {
        const ysb = yah.find((o) => o.attempt == obj.attempt);
        if (!ysb) console.log(obj);
        if (obj.catchers.length == 1) {
          obj.catcher = obj.catchers[0];
        } else {
          obj.catcher = obj.catchers.find((c) => c.split("｜")[0] == ysb.catcher.split("｜")[0]);
        }
        obj.credit = ysb.credit;
        const o = add.find((k) => k.attempt == obj.attempt);
        if (o) {
          obj = Object.assign({}, obj, o);
        }
        return obj;
      })
      ;

  } catch (err) {
    errHandler(err);
  }
  const output = JSON.stringify(data, null, 2);
  fs.writeFileSync(outfile, output);
  console.log(data.length);
})();
