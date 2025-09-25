// scripts/generate.js
import fs from "node:fs";
import path from "node:path";
import fetch from "node-fetch";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";

dayjs.extend(utc);
dayjs.extend(timezone);

const KST = 'Asia/Seoul';
const BRIEF_DATE = dayjs().tz(KST).format('YYYY-MM-DD'); // 오늘(KST)

// 저장 폴더 준비
const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

async function callOpenAI(briefDate) {
  const system = `당신은 제철소 설비정비 회사의 경영기획 에디터입니다.
최근 3일(당일·전일·전전일, KST) 기사만 수집·검증·요약하고,
철강경제/포스코그룹/정비 로봇·AI정비 카테고리로 정리해 주세요.
링크는 가능한 원문(HTTP 200 & 제목 일치)에 한해 사용하십시오.
각 기사 요약은 불릿 2~3개 + '☞ 시사점:' 1문장(정비 관점 액션)으로.
부족하면 억지로 채우지 말고 '보충' 0~2건만 허용. 전일 우선 정렬.`;

  const user = `BRIEF_DATE: ${briefDate} (KST 기준)
- 수집 기간: BRIEF_DATE 기준 당일·전일·전전일
- 소스: 매일경제/한국경제/조선·중앙·동아(경제), 부족 시 전자신문·로봇신문·정부보도자료 등
- 포항/광양/포스코 키워드 우선
- 최종 결과는 마크다운(카테고리별)로만 출력`;

  const resp = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-5.1",           // 최신 가용 모델로 교체 가능
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ]
      // 필요 시 Structured Output(JSON)로 받아 파싱 후 저장하도록 확장 가능
    })
  });

  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`OpenAI error: ${resp.status} ${t}`);
  }
  const data = await resp.json();
  const text =
    data.output_text ??
    data.choices?.[0]?.message?.content ??
    "";

  return text.trim();
}

async function main() {
  const md = await callOpenAI(BRIEF_DATE);

  // 간단 버전: 마크다운 원문 그대로 저장(프런트에서 raw_markdown 보여주거나 추후 파서 추가)
  const json = {
    briefDate: BRIEF_DATE,
    status: "ready",
    raw_markdown: md
  };

  const file = path.join(DATA_DIR, `${BRIEF_DATE}.json`);
  fs.writeFileSync(file, JSON.stringify(json, null, 2), "utf-8");
  console.log("saved:", file);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
