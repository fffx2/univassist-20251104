// functions/ai-font-recommend.js
// Netlify Functions로 API 키를 안전하게 숨김

exports.handler = async (event, context) => {
  // CORS 설정
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // OPTIONS 요청 처리 (CORS preflight)
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // POST 요청만 처리
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { service, keyword, mood } = JSON.parse(event.body);

    // AI 프롬프트 생성
    const prompt = `당신은 전문 타이포그래피 디자이너입니다. 다음 조건에 맞는 Google Fonts 조합을 추천해주세요:

서비스 목적: ${service}
핵심 키워드: ${keyword}
무드: Soft/Hard = ${mood.soft}/100, Static/Dynamic = ${mood.static}/100

다음 형식으로 JSON만 응답해주세요 (다른 설명 없이):
{
  "heading": "폰트명",
  "body": "폰트명",
  "korean": "한글폰트명",
  "reasoning": "추천 이유 (한글로 2-3문장)"
}

조건:
1. 실제 Google Fonts에 존재하는 폰트만 추천
2. heading은 serif 계열, body는 sans-serif 계열
3. korean은 Noto Sans KR, Nanum Gothic 등 한글 폰트`;

    // Claude API 호출 (환경 변수에서 키 가져오기)
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY, // 환경 변수!
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: prompt
        }]
      })
    });

    if (!response.ok) {
      throw new Error(`API 호출 실패: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.content[0].text;
    
    // JSON 파싱
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const fontRec = JSON.parse(jsonMatch[0]);
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(fontRec)
      };
    } else {
      throw new Error('JSON 파싱 실패');
    }

  } catch (error) {
    console.error('AI API 오류:', error);
    
    // 에러 시 기본 폰트 반환
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        heading: 'Playfair Display',
        body: 'Inter',
        korean: 'Noto Sans KR',
        reasoning: 'AI 서버 오류로 기본 폰트를 제공합니다.'
      })
    };
  }
};