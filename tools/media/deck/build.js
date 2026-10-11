// Prajna pitch deck (structured pptxgenjs build: theme → layouts → sections → slides).
const path = require("path");
const pptxgen = require("pptxgenjs");
// Optional: Anthropic pptx skill helper that writes THEME colours into the theme part. Without it the deck still works
// (all slide colours are explicit hex; only title placeholders fall back to the stock black/white theme colours).
let applyTheme = async () => console.log("SKILL_DIR not set: skipping applyTheme (optional)");
if (process.env.SKILL_DIR) ({ applyTheme } = require(process.env.SKILL_DIR + "/scripts/apply_theme.js"));

const A = (p) => path.join(__dirname, "assets", p);
const SHOT = (p) => path.join(__dirname, "..", "promo", "shots", p); // produced by ../promo/capture.py
const ICON = (n, c = "w") => A(`icons/${n}_${c}.png`);
const LIVE = "prajna-w5i3.onrender.com";
const REPO = "github.com/Natural-navya/Prajna";

const THEME = {
  name: "Prajna",
  headFontFace: "Calibri",
  bodyFontFace: "Calibri",
  colors: {
    dk1: "0B1424", lt1: "FFFFFF", dk2: "1E2B45", lt2: "F4F6FB",
    accent1: "2A78D6", accent2: "4A3AA7", accent3: "F2B530", accent4: "1BAF7A", accent5: "D64545", accent6: "EB6834",
    hlink: "2A78D6", folHlink: "4A3AA7",
  },
};
const HEX = { navy: "0B1424", card: "16233B", ink2: "52607A", muted: "8A95A8", blue: "2A78D6", violet: "4A3AA7", gold: "F2B530",
              green: "1BAF7A", red: "D64545", orange: "EB6834", line: "DCE2EC", light: "F4F6FB", softblue: "C9D7EE" };

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.33 x 7.5
pres.title = "Prajna: Student Success Intelligence";
pres.author = "Team Prajna";
pres.company = "KPMG x byteXL HacXLerate 2026";
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
const C = pres.SchemeColor;

// ---------- layouts ----------
const titlePh = (color) => ({ placeholder: { options: { name: "title", type: "title", x: 0.6, y: 0.62, w: 12.1, h: 0.85, fontSize: 34, bold: true,
  color, valign: "middle", margin: 0 }, text: "" } });
pres.defineSlideMaster({ title: "Prajna Cover", background: { path: A("bg_cover.png") }, objects: [] });
pres.defineSlideMaster({ title: "Prajna Close", background: { path: A("bg_close.png") }, objects: [] });
pres.defineSlideMaster({
  title: "Prajna Dark", background: { path: A("bg_dark.png") },
  objects: [titlePh(C.background1),
    { image: { path: A("logo.png"), x: 0.6, y: 6.98, w: 0.26, h: 0.26 } },
    { text: { text: "Prajna · Student Success Intelligence", options: { x: 0.95, y: 6.96, w: 5, h: 0.3, fontSize: 10, color: HEX.softblue, margin: 0 } } }],
  slideNumber: { x: 12.2, y: 6.96, w: 0.5, h: 0.3, fontSize: 10, color: HEX.softblue, align: "right" },
});
pres.defineSlideMaster({
  title: "Prajna Light", background: { color: HEX.light },
  objects: [titlePh(C.text1),
    { image: { path: A("logo.png"), x: 0.6, y: 6.98, w: 0.26, h: 0.26 } },
    { text: { text: "Prajna · Student Success Intelligence", options: { x: 0.95, y: 6.96, w: 5, h: 0.3, fontSize: 10, color: HEX.muted, margin: 0 } } }],
  slideNumber: { x: 12.2, y: 6.96, w: 0.5, h: 0.3, fontSize: 10, color: HEX.muted, align: "right" },
});

// ---------- helpers ----------
const shadow = () => ({ type: "outer", color: "0B1424", opacity: 0.14, blur: 10, offset: 3, angle: 90 });
const darkShadow = () => ({ type: "outer", color: "000000", opacity: 0.45, blur: 16, offset: 6, angle: 90 });
function eyebrow(s, text, dark) {
  s.addText(text.toUpperCase(), { x: 0.6, y: 0.3, w: 8, h: 0.32, fontSize: 12, bold: true, charSpacing: 3,
    color: dark ? "86B6EF" : HEX.blue, margin: 0, isTextBox: true, objectName: "Eyebrow" });
}
function card(s, x, y, w, h, opts = {}) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.12, fill: { color: opts.fill || "FFFFFF", transparency: opts.transparency || 0 },
    line: { color: opts.line || (opts.dark ? "2A3A58" : HEX.line), width: 0.75 }, shadow: opts.noShadow ? undefined : (opts.dark ? darkShadow() : shadow()),
    objectName: opts.name || "Card" });
}
function iconCircle(s, icon, x, y, d, color) {
  s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color }, line: { color, width: 0 }, objectName: `Icon bg ${icon}` });
  const p = d * 0.27;
  s.addImage({ path: ICON(icon), x: x + p, y: y + p, w: d - 2 * p, h: d - 2 * p, altText: icon, objectName: `Icon ${icon}` });
}
function framedShot(s, file, x, y, w, h, label) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x - 0.07, y: y - 0.07, w: w + 0.14, h: h + 0.14, rectRadius: 0.1, fill: { color: "0F1B2D" },
    line: { color: "33456A", width: 0.75 }, shadow: darkShadow(), objectName: `Frame ${file}` });
  s.addImage({ path: SHOT(file), x, y, w, h, altText: label || file, objectName: `Screenshot ${file}` });
  if (label) {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x + 0.15, y: y + h - 0.5, w: label.length * 0.085 + 0.35, h: 0.34, rectRadius: 0.17,
      fill: { color: HEX.navy, transparency: 8 }, line: { color: HEX.navy, width: 0 }, objectName: `Label ${label}` });
    s.addText(label, { x: x + 0.15, y: y + h - 0.5, w: label.length * 0.085 + 0.35, h: 0.34, fontSize: 11, bold: true, color: "FFFFFF",
      align: "center", valign: "middle", margin: 0, isTextBox: true, objectName: `Label text ${label}` });
  }
}
function phone(s, file, x, y, w) {
  const h = w * (844 / 390);
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x - 0.09, y: y - 0.09, w: w + 0.18, h: h + 0.18, rectRadius: 0.25, fill: { color: "0B0F18" },
    line: { color: "3A4660", width: 1 }, shadow: darkShadow(), objectName: `Phone ${file}` });
  s.addImage({ path: SHOT(file), x, y, w, h, altText: `Phone screenshot ${file}`, objectName: `Phone screen ${file}` });
}

// ================= 1. COVER =================
pres.addSection({ title: "Why" });
let s = pres.addSlide({ masterName: "Prajna Cover", sectionTitle: "Why" });
s.addImage({ path: A("logo.png"), x: 0.75, y: 1.0, w: 1.05, h: 1.05, altText: "Prajna logo", objectName: "Logo" });
s.addText("KPMG × BYTEXL · HACXLERATE 2026", { x: 0.75, y: 2.35, w: 6.4, h: 0.35, fontSize: 13, bold: true, charSpacing: 3, color: "86B6EF", margin: 0, isTextBox: true });
s.addText("Prajna", { x: 0.75, y: 2.7, w: 6.4, h: 1.3, fontSize: 80, bold: true, color: "FFFFFF", margin: 0, isTextBox: true, objectName: "Cover title" });
s.addText([{ text: "Student Success Intelligence", options: { bold: true, color: "FFFFFF", breakLine: true } },
           { text: "Know which students need help, why, and what to do next.", options: { color: "C9D3E1" } }],
          { x: 0.75, y: 4.05, w: 6.3, h: 1.0, fontSize: 20, margin: 0, isTextBox: true, paraSpaceAfter: 4 });
s.addText([{ text: "[Team name]", options: { bold: true, color: "FFFFFF", breakLine: true } },
           { text: "[Member 1] · [Member 2] · [Member 3] · [Member 4]", options: { color: "9FB0C8" } }],
          { x: 0.75, y: 5.35, w: 6.3, h: 0.7, fontSize: 14, margin: 0, isTextBox: true, objectName: "Team" });
s.addImage({ path: ICON("Globe"), x: 0.75, y: 6.47, w: 0.26, h: 0.26, altText: "Live link" });
s.addText(LIVE, { x: 1.1, y: 6.42, w: 3.2, h: 0.36, fontSize: 13, color: "FFFFFF", margin: 0, isTextBox: true, hyperlink: { url: `https://${LIVE}` } });
s.addImage({ path: ICON("Github"), x: 4.3, y: 6.47, w: 0.26, h: 0.26, altText: "GitHub" });
s.addText(REPO, { x: 4.65, y: 6.42, w: 3.6, h: 0.36, fontSize: 13, color: "FFFFFF", margin: 0, isTextBox: true, hyperlink: { url: `https://${REPO}` } });
framedShot(s, "overview.png", 7.45, 1.25, 5.3, 3.31);
phone(s, "phone_student.png", 11.35, 3.25, 1.5);
s.addNotes("Colleges already collect plenty of data about students. What they lack is a way to turn it into decisions. Prajna, which means wisdom or insight, tells a principal, a head of department, a mentor, a placement officer and the student exactly who needs help, why, and what to do next. Replace the team placeholders before presenting.");

// ================= 2. PROBLEM =================
s = pres.addSlide({ masterName: "Prajna Light", sectionTitle: "Why" });
eyebrow(s, "The campus problem");
s.addText("Colleges have the data, not the decisions", { placeholder: "title" });
const probs = [
  ["Unlink", HEX.blue, "7", "disconnected systems", "ERP, biometric attendance, LMS, clubs, placement cell, skill tests and feedback. Each uses a different student ID."],
  ["Clock", HEX.red, "Too late", "found after results", "Below-75% attendance and backlogs surface after results; toppers fail coding rounds in final year."],
  ["ListChecks", HEX.violet, "No loop", "insight without action", "Mentors get spreadsheets, not \"these 5 students, this week, about this\". Nobody measures whether help worked."],
];
probs.forEach(([ic, col, big, head, body], i) => {
  const x = 0.6 + i * 4.1, y = 1.95;
  card(s, x, y, 3.85, 4.55, { name: `Problem ${i + 1}` });
  iconCircle(s, ic, x + 0.35, y + 0.35, 0.75, col);
  s.addText(big, { x: x + 0.35, y: y + 1.3, w: 3.2, h: 0.9, fontSize: 44, bold: true, color: col, margin: 0, isTextBox: true });
  s.addText(head, { x: x + 0.35, y: y + 2.2, w: 3.2, h: 0.45, fontSize: 18, bold: true, color: HEX.navy, margin: 0, isTextBox: true });
  s.addText(body, { x: x + 0.35, y: y + 2.75, w: 3.2, h: 1.5, fontSize: 14, color: HEX.ink2, margin: 0, valign: "top", isTextBox: true });
});
s.addNotes("The brief asks us to move beyond a dashboard. Data sits in seven systems that don't share an ID, so detention and backlogs appear only after results, and even when someone spots a risk nothing tracks the follow-up. These are the three gaps Prajna closes.");

// ================= 3. APPROACH =================
pres.addSection({ title: "How" });
s = pres.addSlide({ masterName: "Prajna Dark", sectionTitle: "How" });
eyebrow(s, "Our approach", true);
s.addText("From scattered data to a tracked decision", { placeholder: "title" });
const steps = [["Merge", "Integrate", "7 sources into one Student 360"], ["Gauge", "Score", "Success Score 0–100, 6 domains"],
  ["ShieldAlert", "Predict", "Academic and placement risk"], ["Lightbulb", "Explain", "Top reasons behind every flag"],
  ["Zap", "Act", "Assign interventions, one or 280 at once"], ["Activity", "Measure", "Score at start vs now, weekly"]];
const stepCol = [HEX.blue, HEX.blue, HEX.violet, HEX.violet, HEX.green, HEX.green];
steps.forEach(([ic, name, desc], i) => {
  const x = 0.6 + i * 2.06, y = 2.05;
  card(s, x, y, 1.86, 3.2, { fill: HEX.card, dark: true, name: `Step ${name}` });
  iconCircle(s, ic, x + 0.3, y + 0.3, 0.7, stepCol[i]);
  s.addText(`0${i + 1}`, { x: x + 1.15, y: y + 0.38, w: 0.55, h: 0.35, fontSize: 13, bold: true, color: "F2B530", margin: 0, isTextBox: true });
  s.addText(name, { x: x + 0.3, y: y + 1.2, w: 1.45, h: 0.5, fontSize: 20, bold: true, color: "FFFFFF", margin: 0, isTextBox: true });
  s.addText(desc, { x: x + 0.3, y: y + 1.75, w: 1.4, h: 1.25, fontSize: 13, color: "C9D3E1", margin: 0, valign: "top", isTextBox: true });
});
s.addText([{ text: "Every screen answers three questions: ", options: { color: "C9D3E1" } },
           { text: "Who needs help? Why? What should I do?", options: { color: "FFFFFF", bold: true } }],
          { x: 0.6, y: 5.65, w: 12.1, h: 0.5, fontSize: 18, margin: 0, isTextBox: true });
s.addNotes("This is the whole product in one line. The first four steps answer who needs help and why; the last two turn that into tracked action, which is what most dashboards miss.");

// ================= 4. DATA INTEGRATION =================
s = pres.addSlide({ masterName: "Prajna Light", sectionTitle: "How" });
eyebrow(s, "Data integration · 30% of the rubric");
s.addText("Seven messy sources, one clean Student 360", { placeholder: "title" });
const stats4 = [["118,692", "raw rows ingested", HEX.blue], ["6,126", "student IDs reconciled", HEX.violet], ["1,021", "duplicate rows removed", HEX.green], ["2,536", "messy values repaired", HEX.orange]];
stats4.forEach(([n, l, col], i) => {
  const x = 0.6 + (i % 2) * 3.0, y = 1.85 + Math.floor(i / 2) * 1.75;
  card(s, x, y, 2.8, 1.55, { name: `Stat ${l}` });
  s.addText(n, { x: x + 0.3, y: y + 0.22, w: 2.3, h: 0.7, fontSize: 32, bold: true, color: col, margin: 0, isTextBox: true });
  s.addText(l, { x: x + 0.3, y: y + 0.92, w: 2.3, h: 0.4, fontSize: 14, color: HEX.ink2, margin: 0, isTextBox: true });
});
s.addText([{ text: "Three keys, one ID: ", options: { bold: true, color: HEX.navy } },
           { text: "student ID variants, roll numbers and LMS emails all map to one student. Bad values are repaired or quarantined, never silently dropped.", options: { color: HEX.ink2 } }],
          { x: 0.6, y: 5.45, w: 5.8, h: 1.0, fontSize: 14, margin: 0, valign: "top", isTextBox: true });
s.addChart(pres.charts.BAR, [{ name: "Rows ingested", labels: ["Attendance", "Academic", "LMS", "Engagement", "Placement", "ERP master", "Skills", "Feedback"],
  values: [72740, 24100, 14400, 2476, 1368, 1208, 1200, 1200] }], {
  x: 6.85, y: 1.75, w: 5.85, h: 4.85, barDir: "bar", showTitle: true, title: "Rows ingested per source", titleFontSize: 14, titleColor: HEX.navy, titleFontFace: "+mn-lt",
  chartColors: [HEX.blue], showValue: true, dataLabelPosition: "outEnd", dataLabelFontSize: 11, dataLabelColor: HEX.ink2, dataLabelFormatCode: "#,##0", dataLabelFontFace: "+mn-lt",
  catAxisLabelColor: HEX.ink2, catAxisLabelFontSize: 12, catAxisLabelFontFace: "+mn-lt", catAxisOrientation: "maxMin", catAxisLineShow: false,
  valAxisHidden: true, valGridLine: { style: "none" }, catGridLine: { style: "none" }, showLegend: false, barGapWidthPct: 45,
});
s.addNotes("Integration is 30 percent of the score, so we made it visible. The pipeline reconciles three different keys into one canonical student ID, removes duplicate uploads, and repairs or quarantines bad values. The Data Integration page shows these counts for every source.");

// ================= 5. SUCCESS SCORE =================
s = pres.addSlide({ masterName: "Prajna Light", sectionTitle: "How" });
eyebrow(s, "Student Success Score");
s.addText("A transparent, explainable score out of 100", { placeholder: "title" });
s.addChart(pres.charts.DOUGHNUT, [{ name: "Weight", labels: ["Academic", "Placement", "Attendance", "Learning (LMS)", "Skills", "Engagement"], values: [30, 20, 15, 15, 10, 10] }], {
  x: 0.6, y: 1.7, w: 5.6, h: 4.9, holeSize: 58, chartColors: [HEX.blue, HEX.violet, HEX.green, "5598E7", HEX.orange, HEX.gold],
  showPercent: true, showValue: false, showLegend: true, legendPos: "r", legendFontSize: 13, legendColor: HEX.ink2, legendFontFace: "+mn-lt",
  dataLabelColor: "FFFFFF", dataLabelFontSize: 12, dataLabelFontBold: true, dataLabelFontFace: "+mn-lt", showTitle: true, title: "Domain weights",
  titleFontSize: 14, titleColor: HEX.navy, titleFontFace: "+mn-lt",
});
s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 6.6, y: 1.8, w: 6.1, h: 0.95, rectRadius: 0.12, fill: { color: HEX.navy }, line: { color: HEX.navy, width: 0 }, objectName: "Formula" });
s.addText([{ text: "Score  =  Σ  weight × domain score", options: { bold: true, color: "FFFFFF" } }, { text: "    (0–100)", options: { color: HEX.softblue } }],
          { x: 6.85, y: 1.8, w: 5.7, h: 0.95, fontSize: 20, valign: "middle", margin: 0, isTextBox: true });
const bands = [["Thriving", "≥ 75", HEX.green], ["On track", "60–74", HEX.blue], ["Watch", "45–59", HEX.gold], ["At risk", "< 45", HEX.red]];
bands.forEach(([b, r, col], i) => {
  const x = 6.6 + i * 1.55;
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 3.0, w: 1.43, h: 0.85, rectRadius: 0.12, fill: { color: col }, line: { color: col, width: 0 }, objectName: `Band ${b}` });
  s.addText([{ text: b, options: { bold: true, breakLine: true } }, { text: r }], { x, y: 3.0, w: 1.43, h: 0.85, fontSize: 13, color: b === "Watch" ? HEX.navy : "FFFFFF",
    align: "center", valign: "middle", margin: 0, isTextBox: true });
});
s.addText([
  { text: "23 indicators scaled to fixed policy ranges, so 70 means the same in every department", options: { bullet: true, breakLine: true } },
  { text: "Missing data is filled from the cohort median and flagged as low confidence", options: { bullet: true, breakLine: true } },
  { text: "Years 1–2 shift 10 points from placement to academics; admins can re-weight", options: { bullet: true, breakLine: true } },
  { text: "Gender, category and home state are never inputs", options: { bullet: true } },
], { x: 6.6, y: 4.15, w: 6.1, h: 2.4, fontSize: 14, color: HEX.ink2, paraSpaceAfter: 8, margin: 0, valign: "top", isTextBox: true });
s.addNotes("The Success Score is deliberately not a black box. Every indicator is scaled against a fixed, policy-based range, each domain averages its indicators, and the score is the weighted sum. Admins can change the weights and re-score all students in seconds.");

// ================= 6. RISK =================
s = pres.addSlide({ masterName: "Prajna Dark", sectionTitle: "How" });
eyebrow(s, "Risk identification · explainable AI", true);
s.addText("Two risks, predicted early, always with a reason", { placeholder: "title" });
const risks = [["BookOpen", HEX.blue, "Academic risk", "AUC 0.87 ± 0.06", "New backlog or SGPA below 6 next semester. Rules always flag: attendance below 75%, 3+ backlogs."],
               ["Briefcase", HEX.violet, "Placement risk", "AUC 0.81 ± 0.03", "Not placement-ready by the season. Rule: final year with coding score below 30."]];
risks.forEach(([ic, col, name, auc, desc], i) => {
  const y = 1.85 + i * 2.05;
  card(s, 0.6, y, 5.6, 1.85, { fill: HEX.card, dark: true, name });
  iconCircle(s, ic, 0.9, y + 0.3, 0.7, col);
  s.addText(name, { x: 1.8, y: y + 0.25, w: 2.4, h: 0.45, fontSize: 18, bold: true, color: "FFFFFF", margin: 0, isTextBox: true });
  s.addText(auc, { x: 4.0, y: y + 0.25, w: 2.0, h: 0.45, fontSize: 16, bold: true, color: "F2B530", align: "right", margin: 0, isTextBox: true });
  s.addText(desc, { x: 1.8, y: y + 0.78, w: 4.2, h: 0.95, fontSize: 13, color: "C9D3E1", margin: 0, valign: "top", isTextBox: true });
});
s.addText("Logistic regression on 23 indicators + 4-week trends · 5-fold cross-validation · retrained on every data load · per-student drivers are exact contributions",
          { x: 0.6, y: 6.05, w: 5.6, h: 0.65, fontSize: 11, color: HEX.softblue, margin: 0, valign: "top", isTextBox: true });
framedShot(s, "student360.png", 6.75, 1.9, 5.95, 3.72, "Student 360: score, risk and reasons");
s.addNotes("The score says where a student stands; risk says where they are heading. Because the model is linear, each driver is an exact contribution, not an approximation. Outcome labels are synthetic, so the AUC shows that the method works.");

// ================= 7. INSIGHTS =================
pres.addSection({ title: "Results" });
s = pres.addSlide({ masterName: "Prajna Light", sectionTitle: "Results" });
eyebrow(s, "What the combined data revealed");
s.addText("Insights no single system could show", { placeholder: "title" });
const ins = [["TrendingDown", HEX.red, "61", "students sliding: −10 points in 4 weeks; 59% also reported low satisfaction"],
  ["Laptop", HEX.red, "5.2×", "higher academic risk when LMS assignment completion is below 50%"],
  ["AlertTriangle", HEX.orange, "48%", "below 40% in Software Testing (IT) vs a 15% average: a subject hotspot"],
  ["CalendarX", HEX.orange, "127", "students below the 75% attendance rule, caught mid-term"],
  ["GraduationCap", HEX.blue, "280", "academic stars who are not placement-ready: one bootcamp lifts the group"],
  ["Trophy", HEX.green, "63 vs 54", "average score with 4+ clubs or events vs none"]];
ins.forEach(([ic, col, big, text], i) => {
  const x = 0.6 + (i % 3) * 4.1, y = 1.85 + Math.floor(i / 3) * 2.45;
  card(s, x, y, 3.85, 2.2, { name: `Insight ${big}` });
  iconCircle(s, ic, x + 0.3, y + 0.3, 0.6, col);
  s.addText(big, { x: x + 1.05, y: y + 0.28, w: 2.6, h: 0.65, fontSize: 30, bold: true, color: HEX.navy, margin: 0, isTextBox: true });
  s.addText(text, { x: x + 0.3, y: y + 1.05, w: 3.3, h: 1.0, fontSize: 14, color: HEX.ink2, margin: 0, valign: "top", isTextBox: true });
});
s.addNotes("These come from the AI insights feed on the Overview, generated by cross-checking all sources. The sliding finding is the one dashboards miss: some of these students still look fine on today's score. All figures are from our synthetic demo dataset of 1,200 students.");

// ================= 8. SEGMENTS =================
s = pres.addSlide({ masterName: "Prajna Light", sectionTitle: "Results" });
eyebrow(s, "Segmentation · bonus criterion");
s.addText("Six segments, each with a playbook to act on", { placeholder: "title" });
const segs = [["Academic Star, Placement-Unready", 280, "DSA bootcamp, mock interviews, certifications"], ["Multi-domain Risk", 250, "Intensive case management, weekly mentor meetings"],
  ["Campus-Active, Placement-Unready", 206, "Channel club energy into placement prep"], ["Engaged but Struggling", 170, "Remedial classes and time-management coaching"],
  ["Silent Disengager", 160, "Mentor outreach within a week, counselling"], ["All-rounders", 134, "Peer mentors, stretch goals"]];
s.addChart(pres.charts.BAR, [{ name: "Students", labels: segs.map((x) => x[0]), values: segs.map((x) => x[1]) }], {
  x: 0.6, y: 1.75, w: 6.2, h: 4.85, barDir: "bar", showTitle: true, title: "Students per segment (K-Means, k = 6)", titleFontSize: 14, titleColor: HEX.navy, titleFontFace: "+mn-lt",
  chartColors: [HEX.violet], showValue: true, dataLabelPosition: "outEnd", dataLabelFontSize: 11, dataLabelColor: HEX.ink2, dataLabelFontFace: "+mn-lt",
  catAxisLabelColor: HEX.ink2, catAxisLabelFontSize: 11, catAxisLabelFontFace: "+mn-lt", catAxisOrientation: "maxMin", catAxisLineShow: false,
  valAxisHidden: true, valGridLine: { style: "none" }, catGridLine: { style: "none" }, showLegend: false, barGapWidthPct: 45,
});
segs.forEach(([name, , play], i) => {
  const y = 1.8 + i * 0.8;
  card(s, 7.2, y, 5.5, 0.68, { name: `Playbook ${name}`, noShadow: true });
  s.addText([{ text: name, options: { bold: true, color: HEX.navy, breakLine: true } }, { text: play, options: { color: HEX.ink2 } }],
            { x: 7.45, y, w: 5.1, h: 0.68, fontSize: 12, valign: "middle", margin: 0, isTextBox: true });
});
s.addNotes("Segments turn 1,200 individual cases into six decisions. Clustering finds the groups on standardised domain scores; matching each centroid to a relative prototype gives them stable names. One click assigns a group's playbook to every member.");

// ================= 9. PRODUCT =================
s = pres.addSlide({ masterName: "Prajna Dark", sectionTitle: "Results" });
eyebrow(s, "The product", true);
s.addText("Built for action, not just reporting", { placeholder: "title" });
framedShot(s, "overview.png", 0.67, 1.85, 6.5, 4.06, "Overview + Action Center");
framedShot(s, "whatif.png", 7.65, 1.85, 5.0, 3.13 * 0.62, "What-if + one-click actions");
framedShot(s, "copilot.png", 7.65, 4.0 , 5.0, 3.13 * 0.62, "AI Copilot in plain English");
s.addText("Live now · " + LIVE, { x: 0.67, y: 6.2, w: 6.5, h: 0.4, fontSize: 13, bold: true, color: "F2B530", margin: 0, isTextBox: true, hyperlink: { url: `https://${LIVE}` } });
s.addNotes("The overview sums up the institution in one sentence and an Action Center turns findings into four decisions for the week. The what-if simulator finds the target, one click assigns the intervention, and the AI Copilot answers plain-English questions within each user's permissions.");

// ================= 10. ROLES & DEVICES =================
pres.addSection({ title: "Scale" });
s = pres.addSlide({ masterName: "Prajna Light", sectionTitle: "Scale" });
eyebrow(s, "Built for the whole campus");
s.addText("Every role, every device", { placeholder: "title" });
const roles = [["Building2", HEX.blue, "Principal / Admin", "Whole institution; edits score weights, uploads data"], ["Users", HEX.violet, "Head of Department", "Only their department"],
  ["UserCheck", HEX.green, "Faculty Mentor", "Only their mentees, with AI meeting briefs"], ["Briefcase", HEX.orange, "Placement Officer", "Placement readiness across the institution"],
  ["GraduationCap", HEX.gold, "Student", "Own progress, goal simulator, AI study tips"]];
roles.forEach(([ic, col, r, d], i) => {
  const y = 1.85 + i * 0.95;
  iconCircle(s, ic, 0.6, y, 0.62, col);
  s.addText([{ text: r, options: { bold: true, color: HEX.navy, breakLine: true } }, { text: d, options: { color: HEX.ink2 } }],
            { x: 1.42, y: y - 0.05, w: 5.2, h: 0.72, fontSize: 14, valign: "middle", margin: 0, isTextBox: true });
});
phone(s, "phone_login.png", 7.75, 1.75, 2.1);
phone(s, "phone_student.png", 10.3, 1.75, 2.1);
s.addText("Server-side role scoping: students get 403 on every staff view", { x: 0.6, y: 6.6 - 0.05, w: 6.2, h: 0.35, fontSize: 12, italic: true, color: HEX.muted, margin: 0, isTextBox: true });
s.addNotes("Five roles, each seeing only what they should. Scoping is enforced on the server, not just hidden in the interface. The interface works on phones, tablets and laptops, in light and dark mode.");

// ================= 11. ARCHITECTURE & RESPONSIBLE AI =================
s = pres.addSlide({ masterName: "Prajna Dark", sectionTitle: "Scale" });
eyebrow(s, "Architecture · responsible AI", true);
s.addText("Production-shaped, responsible by design", { placeholder: "title" });
const arch = [["Database", "7 campus sources", "CSV today; Moodle / ERP connectors next"], ["Merge", "Pipeline", "Validate · reconcile IDs · de-duplicate · weekly snapshots"],
  ["Brain", "Intelligence", "Score · 2 risk models · segments · insights · what-if"], ["Server", "FastAPI + PostgreSQL", "Role-scoped API · Supabase · Docker on Render"],
  ["Smartphone", "React app", "Any device · AI Copilot via Groq → OpenRouter → Gemini"]];
arch.forEach(([ic, name, desc], i) => {
  const y = 1.75 + i * 0.98;
  card(s, 0.6, y, 6.0, 0.82, { fill: HEX.card, dark: true, name: `Arch ${name}`, noShadow: true });
  iconCircle(s, ic, 0.78, y + 0.13, 0.56, i < 2 ? HEX.blue : i < 3 ? HEX.violet : HEX.green);
  s.addText([{ text: name, options: { bold: true, color: "FFFFFF", breakLine: true } }, { text: desc, options: { color: "C9D3E1" } }],
            { x: 1.55, y, w: 4.9, h: 0.82, fontSize: 13, valign: "middle", margin: 0, isTextBox: true });
});
const resp = ["Server-side role scoping on every endpoint, including the AI's tools", "Gender and category never used by models; four-fifths parity monitored",
  "The AI sees student IDs and numbers only, never names", "Audit log of profile views, uploads and weight changes", "Aligned with India's DPDP Act 2023"];
card(s, 7.05, 1.75, 5.65, 4.75, { fill: HEX.card, dark: true, name: "Responsible AI" });
s.addText("Responsible AI", { x: 7.4, y: 1.95, w: 5, h: 0.45, fontSize: 18, bold: true, color: "FFFFFF", margin: 0, isTextBox: true });
resp.forEach((t, i) => {
  const y = 2.6 + i * 0.75;
  s.addImage({ path: ICON("CheckCircle2"), x: 7.4, y: y + 0.04, w: 0.3, h: 0.3, altText: "Check" });
  s.addText(t, { x: 7.85, y, w: 4.6, h: 0.65, fontSize: 13, color: "C9D3E1", margin: 0, valign: "top", isTextBox: true });
});
s.addNotes("The API is stateless and the database is managed Postgres, so it scales by adding containers. Responsible AI is built in: role scoping everywhere, protected attributes excluded, and the language model only ever sees IDs and numbers.");

// ================= 12. CLOSE =================
s = pres.addSlide({ masterName: "Prajna Close", sectionTitle: "Scale" });
s.addImage({ path: A("logo.png"), x: 0.75, y: 0.75, w: 0.85, h: 0.85, altText: "Prajna logo" });
s.addText("IMPACT AND NEXT STEPS", { x: 0.75, y: 1.85, w: 8, h: 0.35, fontSize: 13, bold: true, charSpacing: 3, color: "86B6EF", margin: 0, isTextBox: true });
s.addText("Catch students weeks earlier, and prove the help worked", { x: 0.75, y: 2.2, w: 11.5, h: 1.4, fontSize: 40, bold: true, color: "FFFFFF", margin: 0, isTextBox: true, valign: "top" });
card(s, 0.75, 4.0, 5.75, 2.55, { fill: HEX.card, dark: true, transparency: 15, name: "Roadmap" });
s.addText("Roadmap", { x: 1.05, y: 4.2, w: 5, h: 0.4, fontSize: 18, bold: true, color: "FFFFFF", margin: 0, isTextBox: true });
s.addText([{ text: "Live connectors for Moodle and the ERP", options: { bullet: true, breakLine: true } }, { text: "NAAC / NBA student-progression exports", options: { bullet: true, breakLine: true } },
           { text: "Weekly mentor digests on email and WhatsApp", options: { bullet: true, breakLine: true } }, { text: "Student nudges and RAG over college regulations", options: { bullet: true } }],
          { x: 1.05, y: 4.7, w: 5.3, h: 1.7, fontSize: 14, color: "C9D3E1", paraSpaceAfter: 6, margin: 0, valign: "top", isTextBox: true });
card(s, 6.85, 4.0, 5.75, 2.55, { fill: HEX.card, dark: true, transparency: 15, name: "Try it" });
s.addText("Try it now", { x: 7.15, y: 4.2, w: 5, h: 0.4, fontSize: 18, bold: true, color: "FFFFFF", margin: 0, isTextBox: true });
s.addImage({ path: ICON("Globe"), x: 7.15, y: 4.8, w: 0.28, h: 0.28, altText: "Live link" });
s.addText(LIVE, { x: 7.55, y: 4.75, w: 4.9, h: 0.38, fontSize: 14, color: "FFFFFF", margin: 0, isTextBox: true, hyperlink: { url: `https://${LIVE}` } });
s.addImage({ path: ICON("Github"), x: 7.15, y: 5.3, w: 0.28, h: 0.28, altText: "GitHub" });
s.addText(REPO, { x: 7.55, y: 5.25, w: 4.9, h: 0.38, fontSize: 14, color: "FFFFFF", margin: 0, isTextBox: true, hyperlink: { url: `https://${REPO}` } });
s.addImage({ path: ICON("KeyRound"), x: 7.15, y: 5.8, w: 0.28, h: 0.28, altText: "Demo login" });
s.addText([{ text: "admin@prajna.demo · student@prajna.demo", options: { color: "FFFFFF", breakLine: true } }, { text: "Password: Prajna@2026 (one-click roles on the login page)", options: { color: HEX.softblue } }],
          { x: 7.55, y: 5.75, w: 4.95, h: 0.7, fontSize: 12, margin: 0, valign: "top", isTextBox: true });
s.addNotes("Close on impact: problems surface mid-term instead of at results, every flag comes with a reason and an owner, and the tracker shows whether help worked. Then share the links; evaluators can use the one-click demo roles. Thank the judges and invite questions.");

(async () => {
  const out = path.join(__dirname, "Prajna_Pitch_Deck.pptx");
  await pres.writeFile({ fileName: out });
  await applyTheme(out, THEME);
  console.log("wrote", out);
})();
