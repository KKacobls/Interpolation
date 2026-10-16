const sequenceInput = document.getElementById("sequenceInput");
const insertPosInput = document.getElementById("insertPos");
const insertValueInput = document.getElementById("insertValue");
const applyBtn = document.getElementById("applyBtn");
const randomBtn = document.getElementById("randomBtn");
const shareBtn = document.getElementById("shareBtn");
const shareStatus = document.getElementById("shareStatus");

const pointsText = document.getElementById("pointsText");
const formulaText = document.getElementById("formulaText");
const polyText = document.getElementById("polyText");
const valueText = document.getElementById("valueText");

const plotCanvas = document.getElementById("plot");
const plotCtx = plotCanvas.getContext("2d");
const particlesCanvas = document.getElementById("particles");
const particlesCtx = particlesCanvas.getContext("2d");

// Read parameter values from the URL before calculating the initial result.
const queryFields = [
  ["sequence", sequenceInput],
  ["position", insertPosInput],
  ["value", insertValueInput],
];

function applyURLParameters() {
  const params = new URLSearchParams(window.location.search);
  queryFields.forEach(([name, element]) => {
    if (params.has(name)) element.value = params.get(name);
  });
}

function syncURLParameters() {
  const url = new URL(window.location.href);
  queryFields.forEach(([name, element]) => {
    url.searchParams.set(name, element.value.trim());
  });
  // Replacing instead of pushing avoids filling browser history on each keystroke.
  window.history.replaceState(null, "", url.toString());
}

function parseSequence(text) {
  const values = text.split(/[,，]/).map((s) => s.trim());
  if (values.some((v) => v === "" || !Number.isFinite(Number(v)))) return null;
  return values.map(Number);
}

function buildPoints(values, insertPos, insertValue) {
  const points = [];
  const maxIndex = values.length + 1;
  const pos = Math.max(1, Math.min(maxIndex, insertPos));
  let vIndex = 0;
  for (let x = 1; x <= maxIndex; x += 1) {
    if (x === pos) {
      points.push({ x, y: insertValue, highlight: true });
    } else {
      points.push({ x, y: values[vIndex], highlight: false });
      vIndex += 1;
    }
  }
  return points;
}

function polyAdd(a, b) {
  const len = Math.max(a.length, b.length);
  const out = new Array(len).fill(0);
  for (let i = 0; i < len; i += 1) {
    out[i] = (a[i] || 0) + (b[i] || 0);
  }
  return out;
}

function polyMul(a, b) {
  const out = new Array(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i += 1) {
    for (let j = 0; j < b.length; j += 1) {
      out[i + j] += a[i] * b[j];
    }
  }
  return out;
}

function lagrangeCoefficients(points) {
  let result = [0];
  for (let i = 0; i < points.length; i += 1) {
    let basis = [1];
    let denom = 1;
    for (let j = 0; j < points.length; j += 1) {
      if (i === j) continue;
      basis = polyMul(basis, [-points[j].x, 1]);
      denom *= points[i].x - points[j].x;
    }
    basis = basis.map((c) => (c * points[i].y) / denom);
    result = polyAdd(result, basis);
  }
  return result;
}

function evalPoly(coeffs, x) {
  return coeffs.reduce((sum, c, i) => sum + c * (x ** i), 0);
}

function fmt(num, digits = 5) {
  const v = Math.abs(num) < 1e-12 ? 0 : num;
  return Number(v.toFixed(digits)).toString();
}

function polynomialToText(coeffs) {
  const terms = [];
  for (let i = coeffs.length - 1; i >= 0; i -= 1) {
    const c = coeffs[i];
    if (Math.abs(c) < 1e-10) continue;
    const sign = c >= 0 ? "+" : "-";
    const absC = Math.abs(c);
    let term = "";
    if (i === 0) {
      term = fmt(absC);
    } else if (i === 1) {
      term = `${absC === 1 ? "" : fmt(absC)}x`;
    } else {
      term = `${absC === 1 ? "" : fmt(absC)}x^${i}`;
    }
    terms.push({ sign, term });
  }
  if (!terms.length) return "f(x) = 0";
  let text = "f(x) = ";
  terms.forEach((t, idx) => {
    if (idx === 0) {
      text += t.sign === "-" ? `-${t.term}` : t.term;
    } else {
      text += ` ${t.sign} ${t.term}`;
    }
  });
  return text;
}

function lagrangeFormText(points) {
  const lines = points.map((p, i) => {
    const factors = [];
    const denoms = [];
    for (let j = 0; j < points.length; j += 1) {
      if (i === j) continue;
      factors.push(`(x - ${points[j].x})`);
      denoms.push(`(${points[i].x} - ${points[j].x})`);
    }
    return `${fmt(p.y)} * ${factors.join(" * ")} / ${denoms.join(" * ")}`;
  });
  return `f(x) = ${lines.join(" + ")}`;
}

function drawPlot(points, coeffs) {
  const ctx = plotCtx;
  const w = plotCanvas.width;
  const h = plotCanvas.height;
  const pad = 48;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);

  const minX = Math.min(...xs) - 0.6;
  const maxX = Math.max(...xs) + 0.6;
  const extraY = Math.max(1, (Math.max(...ys) - Math.min(...ys)) * 0.2);
  const minY = Math.min(...ys) - extraY;
  const maxY = Math.max(...ys) + extraY;

  const tx = (x) => pad + ((x - minX) / (maxX - minX)) * (w - 2 * pad);
  const ty = (y) => h - pad - ((y - minY) / (maxY - minY)) * (h - 2 * pad);

  ctx.clearRect(0, 0, w, h);

  ctx.strokeStyle = "rgba(124, 172, 255, 0.35)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 8; i += 1) {
    const y = pad + ((h - 2 * pad) * i) / 8;
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(w - pad, y);
    ctx.stroke();
  }

  ctx.beginPath();
  const sample = 220;
  for (let i = 0; i <= sample; i += 1) {
    const x = minX + ((maxX - minX) * i) / sample;
    const y = evalPoly(coeffs, x);
    const px = tx(x);
    const py = ty(y);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.strokeStyle = "#7bf7ff";
  ctx.lineWidth = 2.2;
  ctx.shadowColor = "rgba(66, 255, 246, 0.65)";
  ctx.shadowBlur = 12;
  ctx.stroke();
  ctx.shadowBlur = 0;

  points.forEach((p) => {
    ctx.beginPath();
    ctx.arc(tx(p.x), ty(p.y), p.highlight ? 7 : 5.2, 0, Math.PI * 2);
    ctx.fillStyle = p.highlight ? "#ff65d4" : "#ffd66d";
    ctx.shadowColor = p.highlight ? "rgba(255, 88, 213, 0.8)" : "rgba(255, 210, 96, 0.65)";
    ctx.shadowBlur = 16;
    ctx.fill();
    ctx.shadowBlur = 0;
  });

  ctx.fillStyle = "rgba(218, 238, 255, 0.9)";
  ctx.font = "14px Noto Sans TC";
  ctx.fillText("x", w - pad + 12, h - pad + 4);
  ctx.fillText("y", pad - 16, pad - 10);
}

function update() {
  const seq = parseSequence(sequenceInput.value);
  if (!seq || seq.length < 2) {
    pointsText.textContent = "請至少輸入兩個有效數字，並使用逗號分隔（例如：1,3,5）。";
    formulaText.textContent = "";
    polyText.textContent = "";
    valueText.textContent = "";
    plotCtx.clearRect(0, 0, plotCanvas.width, plotCanvas.height);
    return;
  }
  const insertPos = Number(insertPosInput.value);
  const insertValue = Number(insertValueInput.value);
  if (!Number.isInteger(insertPos) || insertPos < 1 || insertPos > seq.length + 1 ||
      insertValueInput.value.trim() === "" || !Number.isFinite(insertValue)) {
    pointsText.textContent = `插入位置必須是 1～${seq.length + 1} 的整數，插入值必須是有效數字。`;
    formulaText.textContent = "";
    polyText.textContent = "";
    valueText.textContent = "";
    plotCtx.clearRect(0, 0, plotCanvas.width, plotCanvas.height);
    return;
  }

  const points = buildPoints(seq, Math.round(insertPos), insertValue);
  const coeffs = lagrangeCoefficients(points);
  const insertedX = points.find((p) => p.highlight).x;
  const yAtInsert = evalPoly(coeffs, insertedX);

  pointsText.textContent = `點集：${points.map((p) => `(${p.x}, ${fmt(p.y)})`).join(" , ")}`;
  formulaText.textContent = lagrangeFormText(points);
  polyText.textContent = polynomialToText(coeffs);
  valueText.textContent = `驗算：f(${insertedX}) = ${fmt(yAtInsert)}（目標值 ${fmt(insertValue)}）`;
  drawPlot(points, coeffs);
}

applyBtn.addEventListener("click", update);
randomBtn.addEventListener("click", () => {
  const r = Math.floor(Math.random() * 301) - 150;
  insertValueInput.value = String(r);
  update();
  syncURLParameters();
  shareStatus.textContent = "";
});

[sequenceInput, insertPosInput, insertValueInput].forEach((el) => {
  el.addEventListener("input", () => {
    update();
    syncURLParameters();
    shareStatus.textContent = "";
  });
});

shareBtn.addEventListener("click", async () => {
  syncURLParameters();
  try {
    await navigator.clipboard.writeText(window.location.href);
    shareStatus.textContent = "已複製包含目前參數的連結！";
  } catch (error) {
    shareStatus.textContent = "無法自動複製，請直接複製瀏覽器網址列的連結。";
  }
});

function initParticles() {
  const dots = Array.from({ length: 70 }, () => ({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    vx: (Math.random() - 0.5) * 0.45,
    vy: (Math.random() - 0.5) * 0.45,
    r: Math.random() * 1.6 + 0.7,
  }));

  function resize() {
    particlesCanvas.width = window.innerWidth;
    particlesCanvas.height = window.innerHeight;
  }

  function frame() {
    particlesCtx.clearRect(0, 0, particlesCanvas.width, particlesCanvas.height);
    for (const d of dots) {
      d.x += d.vx;
      d.y += d.vy;
      if (d.x < 0 || d.x > particlesCanvas.width) d.vx *= -1;
      if (d.y < 0 || d.y > particlesCanvas.height) d.vy *= -1;
      particlesCtx.beginPath();
      particlesCtx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      particlesCtx.fillStyle = "rgba(143, 233, 255, 0.55)";
      particlesCtx.fill();
    }
    requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener("resize", resize);
  frame();
}

applyURLParameters();
initParticles();
update();
