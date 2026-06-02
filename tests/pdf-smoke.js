const puppeteer = require('puppeteer');

(async()=>{
  const browser = await puppeteer.launch({headless: true, args:['--no-sandbox','--disable-setuid-sandbox']});
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));

  await page.goto('http://localhost:8080/index.html', {waitUntil: 'networkidle2'});

  // Inject test data into localStorage
  await page.evaluate(()=>{
    localStorage.setItem('split_groups', JSON.stringify([{id:'g1', name:'Test Group'}]));
    localStorage.setItem('split_group_g1', JSON.stringify([
      {
        id: 'e1',
        name: 'Dinner',
        total: 300,
        participants: [
          { name: 'Alice', share: 100, paidAmount: 50, paid: false },
          { name: 'Bob', share: 100, paidAmount: 100, paid: true },
          { name: 'Charlie', share: 100, paidAmount: 0, paid: false }
        ],
        createdAt: new Date().toISOString()
      }
    ]));
  });

  // Load groups and expenses
  await page.evaluate(()=>{ if(window.loadSplitGroups) loadSplitGroups(); if(window.loadGroupExpenses) loadGroupExpenses('g1'); });

  // Monkeypatch html2pdf to avoid download and allow inspection of generated DOM
  await page.evaluate(()=>{
    window.__orig_html2pdf = window.html2pdf;
    window.html2pdf = function(){
      return {
        set: function(){ return { from: function(){ return { save: function(){ return new Promise(resolve=>setTimeout(resolve,3000)); } } } } }
    };
  });

  // Trigger group PDF generation
  await page.evaluate(()=>{ if(window.generateGroupReportPDF) generateGroupReportPDF('g1'); });

  // Wait for the generated container to appear
  await page.waitForSelector('#groupPdfContent', {timeout: 5000});
  const content = await page.$eval('#groupPdfContent', el => el.innerText);
  console.log('--- Group PDF Content Preview ---');
  console.log(content.slice(0,400));

  await browser.close();
  process.exit(0);
})();
