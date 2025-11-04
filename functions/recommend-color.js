const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: 'Method Not Allowed' })
    };
  }

  try {
    const { bgColor, textColor } = JSON.parse(event.body);

    // [수정] AI 프롬프트를 한글 응답으로 변경
    const systemPrompt = `당신은 UI 색상 디자인 어시스턴트입니다. 사용자가 색상 조합을 테스트하고 있습니다.
    모든 분석, 주석, 이유는 반드시 **한국어**로 작성해야 합니다.

    사용자 현재 선택:
    - 배경색: ${bgColor}
    - 텍스트색: ${textColor}
    
    이를 바탕으로 다음 정보를 제공하세요:
    1.  현재 조합의 명도 대비율 및 WCAG AA (일반 텍스트) 준수 여부 분석.
    2.  현재 텍스트 색상이 실패할 경우, 주어진 배경에 더 나은 텍스트 색상 추천.
    3.  현재 배경과 잘 어울리는 "포인트" 또는 "CTA" 색상 추천.
    
    다음 구조의 유효한 JSON 객체를 반환하세요:
    
    {
      "currentAnalysis": {
        "contrastRatio": "WCAG 명도 대비율 계산",
        "wcagAANormal": "통과/실패",
        "comment": "현재 조합에 대한 간략한 분석 (한국어)"
      },
      "recommendations": {
        "accessibleTextColor": {
          "hex": "#...",
          "comment": "배경색 대비 WCAG AA를 통과하는 텍스트 색상 (한국어)"
        },
        "accentColor": {
          "hex": "#...",
          "comment": "배경색과 보완되는 포인트 색상 (한국어)"
        }
      },
      "reasoning": "이 추천에 대한 간략한 자연어 설명 (한국어)"
    }
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo-1106",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "현재 색상 조합을 분석하고 추천해 주세요." }
      ],
      response_format: { type: "json_object" },
      temperature: 0.8,
      max_tokens: 500
    });

    const result = JSON.parse(completion.choices[0].message.content);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result)
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'AI 추천을 가져오는 데 실패했습니다.', error: error.message })
    };
  }
};