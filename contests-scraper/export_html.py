"""Generate standalone HTML page from contest data."""
import json
from pathlib import Path

BASE_DIR = Path(__file__).parent
PUBLIC_DIR = BASE_DIR.parent / "public" / "contests"
DATA_FILE = PUBLIC_DIR / "all.json"
HTML_FILE = PUBLIC_DIR / "index.html"

data = json.load(open(DATA_FILE, encoding="utf-8"))

html = '''<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AI赛事掘金</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","Helvetica Neue",sans-serif;background:#fff;color:#1a1a1a;min-height:100vh}
.header{max-width:1400px;margin:0 auto;padding:40px 32px 8px}
.header h1{font-size:32px;font-weight:700;letter-spacing:-0.5px}
.header p{font-size:14px;color:#999;margin-top:4px}
.controls{max-width:1400px;margin:0 auto;padding:12px 32px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px}
.filters{display:flex;align-items:center;gap:8px}
.filters span{font-size:12px;color:#999}
.filters button{padding:4px 12px;border-radius:999px;border:none;font-size:12px;font-weight:500;cursor:pointer;background:#f3f3f3;color:#666;transition:.15s}
.filters button.active{background:#1a1a1a;color:#fff}
.nav{display:flex;align-items:center;gap:8px}
.nav button{width:32px;height:32px;border-radius:8px;border:none;background:transparent;cursor:pointer;font-size:14px;color:#999;display:flex;align-items:center;justify-content:center}
.nav button:hover{background:#f3f3f3}
.nav .today-btn{width:auto;padding:4px 12px;font-size:13px;color:#666;border-radius:8px}
.month-label{max-width:1400px;margin:0 auto;padding:8px 32px 12px;font-size:20px;font-weight:600}
.calendar{max-width:1400px;margin:0 auto;padding:0 32px 40px}
.weekdays{display:grid;grid-template-columns:repeat(7,1fr);border-bottom:1px solid #e5e5e5}
.weekdays div{text-align:center;font-size:12px;color:#999;font-weight:500;padding:8px 0}
.grid{display:grid;grid-template-columns:repeat(7,1fr);border-left:1px solid #f0f0f0}
.day{min-height:130px;border-right:1px solid #f0f0f0;border-bottom:1px solid #f0f0f0;padding:6px 8px;transition:.15s}
.day:hover{background:#fafafa}
.day.other-month{background:#fafafa;opacity:.4}
.day.has-contest{background:rgba(254,242,242,.3)}
.day .date-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:4px}
.day .date-num{font-size:14px;font-weight:500;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:50%}
.day .date-num.today{background:#1a1a1a;color:#fff}
.day .badge{font-size:10px;font-weight:700;color:#dc2626;background:#fef2f2;padding:1px 6px;border-radius:999px}
.contest{display:block;text-decoration:none;margin-bottom:4px;padding:4px 6px;border-radius:6px;font-size:11px;line-height:1.3;transition:.15s;cursor:pointer}
.contest:hover{opacity:.8}
.contest.big{background:#fef3c7;color:#92400e;font-weight:600;border:1px solid #fde68a}
.contest.urgent{background:#fee2e2;color:#991b1b;font-weight:500}
.contest.soon{background:#fff7ed;color:#9a3412}
.contest.normal{background:#f3f4f6;color:#4b5563}
.contest .name{font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.contest .prize{opacity:.8;margin-top:1px}
.legend{max-width:1400px;margin:0 auto;padding:0 32px 20px;display:flex;align-items:center;gap:16px;font-size:11px;color:#999}
.legend .item{display:flex;align-items:center;gap:4px}
.legend .dot{width:12px;height:12px;border-radius:3px}
.legend .dot.big{background:#fef3c7;border:1px solid #fde68a}
.legend .dot.urgent{background:#fee2e2}
.legend .dot.soon{background:#fff7ed}
.legend .dot.normal{background:#f3f4f6}
.footer{max-width:1400px;margin:0 auto;padding:0 32px 40px;text-align:center;font-size:11px;color:#ccc}
</style>
</head>
<body>
<div class="header">
<h1>AI赛事掘金</h1>
<p id="stats"></p>
</div>
<div class="controls">
<div class="filters" id="filters"></div>
<div class="nav">
<button onclick="changeMonth(-1)"><svg width="14" height="14" viewBox="0 0 14 14"><path d="M9 2L5 7l4 5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
<button class="today-btn" onclick="goToday()">今天</button>
<button onclick="changeMonth(1)"><svg width="14" height="14" viewBox="0 0 14 14"><path d="M5 2l4 5-4 5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
</div>
</div>
<div class="month-label" id="monthLabel"></div>
<div class="calendar">
<div class="weekdays"><div>周日</div><div>周一</div><div>周二</div><div>周三</div><div>周四</div><div>周五</div><div>周六</div></div>
<div class="grid" id="grid"></div>
</div>
<div class="legend">
<div class="item"><span class="dot big"></span>\\u2265$100K 大奖</div>
<div class="item"><span class="dot urgent"></span>\\u22643天</div>
<div class="item"><span class="dot soon"></span>\\u22647天</div>
<div class="item"><span class="dot normal"></span>更远</div>
<div style="margin-left:auto;color:#ddd">点击赛事跳转报名页 | 每日自动更新</div>
</div>
<div class="footer">数据来源: Kaggle \\u00b7 天池 \\u00b7 AI掘金 \\u00b7 AI搜索 | GitHub Actions 每日自动抓取</div>

<script>
const DATA=''' + json.dumps(data, ensure_ascii=False) + ''';
const WEEKDAYS=["日","一","二","三","四","五","六"];
let currentDate=new Date();
let minPrize=5000;

function parsePrize(s){if(!s)return 0;s=s.replace(/[,，]/g,"").replace(/\\s/g,"");let m=s.match(/\\$(\\d+)/);if(m)return parseInt(m[1]);m=s.match(/€(\\d+)/);if(m)return parseInt(m[1])*1.1;m=s.match(/[￥¥](\\d+)/);if(m)return parseInt(m[1])/7.2;m=s.match(/(\\d+)万/);if(m)return parseInt(m[1])*10000/7.2;if(s.includes("百万"))return 100000;return 0}

function fmt(d){return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}

function shortTitle(t){t=t.replace(/\\(赛季\\s*\\d+\\)/,"").replace(/：.*$/,"").replace(/ - .*$/,"").replace(/ · .*$/,"").trim();return t.length>20?t.slice(0,19)+"…":t}

function render(){
const filtered=DATA.contests.filter(c=>{const v=parsePrize(c.prize);return v>=minPrize||c.prize.includes("万")||c.prize.includes("百万")});
const map={};filtered.forEach(c=>{const k=c.deadline.split("T")[0];if(!map[k])map[k]=[];map[k].push(c)});

let totalPrize=0;filtered.forEach(c=>{totalPrize+=parsePrize(c.prize)});
document.getElementById("stats").textContent=filtered.length+" 场高奖金赛事 · 总奖金池约 $"+Math.round(totalPrize).toLocaleString()+" · 更新于 "+new Date(DATA.updated_at).toLocaleDateString("zh-CN");

const opts=[{l:"全部",v:0},{l:"≥$5K",v:5000},{l:"≥$10K",v:10000},{l:"≥$50K",v:50000},{l:"≥$100K",v:100000}];
document.getElementById("filters").innerHTML="<span>最低奖金筛选</span>"+opts.map(o=>'<button class="'+(o.v===minPrize?"active":"" )+'" onclick="minPrize='+o.v+';render()">'+o.l+'</button>').join("");

document.getElementById("monthLabel").textContent=currentDate.getFullYear()+"年"+(currentDate.getMonth()+1)+"月";

const todayStr=fmt(new Date());
const year=currentDate.getFullYear(),month=currentDate.getMonth();
const firstDay=new Date(year,month,1).getDay();
const daysInMonth=new Date(year,month+1,0).getDate();
const prevDays=new Date(year,month,0).getDate();
const days=[];
for(let i=firstDay-1;i>=0;i--){const d=new Date(year,month-1,prevDays-i);days.push({d,s:fmt(d),cur:false})}
for(let d=1;d<=daysInMonth;d++){const dt=new Date(year,month,d);days.push({d:dt,s:fmt(dt),cur:true})}
const rem=42-days.length;
for(let d=1;d<=rem;d++){const dt=new Date(year,month+1,d);days.push({d:dt,s:fmt(dt),cur:false})}

const now=new Date();
document.getElementById("grid").innerHTML=days.map(day=>{
const cs=map[day.s]||[];
const isToday=day.s===todayStr;
let cls="day";
if(!day.cur)cls+=" other-month";
if(cs.length)cls+=" has-contest";
const dateHtml='<span class="date-num'+(isToday?" today":"")+'">'+day.d.getDate()+'</span>';
const badge=cs.length?'<span class="badge">'+cs.length+'场</span>':"";
const items=cs.map(c=>{
const dl=new Date(c.deadline);const daysLeft=Math.ceil((dl-now)/(1e3*60*60*24));
const pv=parsePrize(c.prize);
const cls=pv>=100000?"big":daysLeft<=3?"urgent":daysLeft<=7?"soon":"normal";
return'<a class="contest '+cls+'" href="'+c.url+'" target="_blank" title="'+c.title+'\\n'+c.prize+'\\n'+c.organizer+'"><div class="name">'+shortTitle(c.title)+'</div><div class="prize">'+c.prize+'</div></a>'}).join("");
return'<div class="'+cls+'"><div class="date-row">'+dateHtml+badge+'</div>'+items+'</div>'}).join("");
}

function changeMonth(d){currentDate=new Date(currentDate.getFullYear(),currentDate.getMonth()+d,1);render()}
function goToday(){currentDate=new Date();render()}
render();
</script>
</body>
</html>'''

with open(HTML_FILE, "w", encoding="utf-8") as f:
    f.write(html)
print(f"✅ HTML exported: {HTML_FILE} ({len(html):,} bytes)")
