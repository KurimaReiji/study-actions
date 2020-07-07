const puppeteer = require("puppeteer-core");

const errHandler = (err) => console.log(err);
const browserPath = "/usr/bin/google-chrome";
const date = `${process.env.TODAY}`;
const targetDir = `${process.env.GITHUB_WORKSPACE}/json/`;

const scraper_get_targets = () => {
  return Array.from(document.querySelectorAll("#gm_card a")).filter((a) => a.querySelector(".bb-score__link").textContent.includes("試合終了")).map((a) => a.href.replace("index", "text"));
};

const scraper = () => {
  const pathname = location.pathname.split("/").slice(-2).join("_");

  const outfile = `yahoo_${pathname}.json`;

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

  const inning_header = (header) => {
    const data = ["inning", "detail"]
      .map((item) => {
        return {
          item,
          el: header.querySelector(`.bb-liveText__${item}`),
        };
      })
      .filter((obj) => obj.el)
      .map((obj) => {
        return {
          item: obj.item,
          text: obj.el.textContent.trim(),
        }
      })
      .reduce((acc, cur) => {
        acc[cur.item] = cur.text;
        return acc;
      }, {})
      ;
    data.id = header.id;
    return data;
  };

  const get_data = (lis) => {
    return lis.map((li) => {
      const data = ["order", "player", "state", "summary"].map((item) => {
        return {
          item,
          elements: Array.from(li.querySelectorAll(`.bb-liveText__${item}`)),
        }
      })
        .filter((obj) => obj.elements.length > 0)
        .map((obj) => {
          return {
            item: obj.item,
            elements: obj.elements.map((el) => el.textContent.split("\n").map((line) => line.trim()).filter((s) => s).join(" ")),
          }
        })
        .reduce((acc, cur) => {
          acc[cur.item] = cur.elements;
          return acc;
        }, {})
        ;


      return data;
    });
  };

  const history = Array.from(document.querySelectorAll("section.bb-liveText"))
    .map((sec) => {
      const header = inning_header(sec.querySelector("header"));
      const plays = get_data(Array.from(sec.querySelectorAll(".bb-liveText__item")));
      return {
        header,
        plays,
      }
    })
    ;

  const retrievedAt = (() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 540);
    return d.toISOString().slice(0, 19);
  })();

  const data = {
    url: location.href,
    title: document.querySelector(".bb-head01__title").textContent.split("\n").map((s) => s.trim()).filter((s) => s).join(" "),
    retrievedAt,
    history
  };

  output_json(data, outfile);
  return data;
};


(async () => {

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: browserPath,
  });
  const page = await browser.newPage();
  page.setViewport({ width: 1200, height: 800 });
  await page._client.send('Page.setDownloadBehavior',
    {
      behavior: 'allow',
      downloadPath: targetDir,
    }
  );
  await page.goto(`https://baseball.yahoo.co.jp/npb/schedule/?date=${date}`);
  await page.waitForSelector("#gm_card", { timeout: 5000 });
  const targets = await page.evaluate(scraper_get_targets);

  for (let target of targets) {
    await page.goto(target);
    await page.waitForSelector("section.bb-liveText", { timeout: 5000 });
    await page.evaluate(scraper);
  };

  await page.waitFor(1200);
  await browser.close();
})();