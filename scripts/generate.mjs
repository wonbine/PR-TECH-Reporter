// scripts/generate.mjs  (Node 20 이상)
import { writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

function briefDateKST(offsetDays=0){
  const now = new Date();
  const kst = new Date(now.getTime() + (9*60 + now.getTimezoneOffset())*60000);
  kst.setDate(kst.getDate() + offsetDays);
  return kst.toISOString().slice(0,10);
}

const BRIEF_DATE = briefDateKST(0);
const DATA_DIR = join(process.cwd(), "data");
if (!existsSync(DATA_DIR)) await mkdir(DATA_DIR, { recursive: true });

async function callOpenAI(briefDate){
  const system = `당신은 제철소 설비정비 회사의 경영기획 에디터입니다.
최근 3일(당일·전일·전전일, KST) 기사만 수집·검증·요약하고,
철강경제/포스코그룹/정비 로봇·AI정비 카테고리로 정리하세요.
요약은 불릿 2~3개 + '☞ 시사점:' 1문장(정비 관점 액션)으로.
전일 우선 정렬. 부족하면 억지로 채우지 말고 '보충' 0~2건.`;

  const user = `BRIEF_DATE: ${briefDate} (KST)
출력은 오직 JSON 한 덩어리로만:
{
  "briefDate": "YYYY-MM-DD",
  "status": "ready",
  "counts": { "selected": 0, "byCategory": { "철강경제": 0, "포스코그룹": 0, "정비 로봇·AI정비": 0, "보충": 0 } },
  "items": { "철강경제": [], "포스코그룹": [], "정비 로봇·AI정비": [], "보충": [] },
  "raw_markdown": "카테고리별 마크다운 브리핑 전체"
}`;

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ]
    })
  });

  if(!resp.ok){
    const t = await resp.text();
    throw new Error(`OpenAI API 실패: ${resp.status} ${t}`);
  }
  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content || "";

  // 모델이 JSON 텍스트로 답했다고 가정 → 파싱 시도
  try {
    return JSON.parse(content);
  } catch {
    // JSON이 아닐 경우 최소 구조로 감싸 저장
    return {
      briefDate,
      status: "ready",
      counts: { selected: 0, byCategory: { "철강경제":0, "포스코그룹":0, "정비 로봇·AI정비":0, "보충":0 } },
      items: { "철강경제": [], "포스코그룹": [], "정비 로봇·AI정비": [], "보충": [] },
      raw_markdown: content
    };
  }
}

async function main(){
  if(!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY 미설정");
  const json = await callOpenAI(BRIEF_DATE);
  const file = join(DATA_DIR, `${BRIEF_DATE}.json`);
  await writeFile(file, JSON.stringify(json, null, 2), "utf-8");
  console.log("saved:", file);
}

main().catch(e => { console.error(e); process.exit(1); });
