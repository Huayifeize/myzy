// ===================== 全局固定参数 =====================
let tradeConfig = {
  distBase: 19000,
  distOffset: 0.05,
  carbonConduct: 0.6,
  avgFuturesPrice: 7532,
  carbonQuotaPrice: 85,
  freeCarbonRatio: 0.25,
  optionFee: 12,

  demandMap: { cold:1.0, normal:1.3, hot:1.8 },
  maintainMap: { none:0, ordinary:0.03, large:0.09, national:0.15 },

  productL: { oilFactor:0.029, basisFactor:0.0005 },
  productPP: { oilFactor:0.041, basisFactor:0.0003 }
};

// 固定唯一仓库：北京房山区燕山东流水工业区7号
const STORE_LL = {
  lat: 39.7685,
  lng: 115.9327
};

// 读取本地缓存的配置
if(localStorage.getItem("tradeConfig")){
  tradeConfig = JSON.parse(localStorage.getItem("tradeConfig"));
}

// ===================== 球面直线距离计算(km) =====================
function getLineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}

// ===================== 每日企业行情数据 =====================
function getDailyData(){
  let def = {
    todayFutures:7600,
    lastFutures:7550,
    spotPrice:7700,
    currDemand:1000,
    lastDemand:950,
    marketFactor:0.2,
    carbonIntensity:1.8,
    demandType:"normal",
    maintainType:"none"
  };
  let d = localStorage.getItem("dailyData");
  return d ? JSON.parse(d) : def;
}

// ===================== 公共工具 =====================
function safeDiv(a,b){ return b==0 ? 0 : a/b; }
function limitMarket(v){
  let a = Math.abs(v);
  if(a<0.05)a=0.05; if(a>0.5)a=0.5;
  return v>=0?a:-a;
}

// ===================== 核心测算公式【已按你要求修改】 =====================
// 交通影响因子 = (直线距离 - 1230) / 12300
function calculate(lineDist, productType){
  let d = getDailyData();
  let c = tradeConfig;

  // 1.期货浮动比率 强制绝对值恒正
  let futuresFloatRate = Math.abs(safeDiv(d.todayFutures - d.lastFutures, d.lastFutures) * 100);

  // 2.【全新修改】交通影响因子 = (距离 - 1230) / 12300
  let traffic = (lineDist - 1230) / 24600;

  // 3.基差
  let basis = d.spotPrice - d.todayFutures;

  // 4.下游需求影响因子
  let demandCoeff = c.demandMap[d.demandType];
  let downDemand = demandCoeff * safeDiv(d.currDemand - d.lastDemand, d.currDemand) * 100;

  // 5.市场影响因子区间限制
  let market = limitMarket(d.marketFactor);

  // 产品系数
  let oil = productType === "L" ? c.productL.oilFactor : c.productPP.oilFactor;
  let basisF = productType === "L" ? c.productL.basisFactor : c.productPP.basisFactor;

  // 检修度
  let maintain = c.maintainMap[d.maintainType];

  // 6.碳配额影响
  let carbon = c.carbonQuotaPrice * d.carbonIntensity * (1 - c.freeCarbonRatio) * c.carbonConduct;

  // 7.推荐点价价格
  let pointPrice = c.avgFuturesPrice
    * (1 + traffic)
    * (1 + oil)
    * (1 + market)
    * (1 + downDemand / 100)
    * (1 - maintain)
    + carbon;

  // 8.行权价格
  let exercise = pointPrice - basis + c.optionFee;

  // 9.仅保留平仓下限
  let closeMin = pointPrice * (1 + basisF) * (1 - futuresFloatRate / 100);

  return {
    "期货浮动比率": futuresFloatRate.toFixed(2) + " %",
    "交通影响因子": traffic.toFixed(4),
    "基差": basis.toFixed(2),
    "下游需求影响因子": downDemand.toFixed(2) + " %",
    "市场影响因子": market.toFixed(4),
    "碳配额影响": carbon.toFixed(2),
    "推荐点价价格": pointPrice.toFixed(2),
    "行权价格": exercise.toFixed(2),
    "推荐平仓价格下限": closeMin.toFixed(2)
  };
}