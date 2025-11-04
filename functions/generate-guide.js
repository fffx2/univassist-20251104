const OpenAI = require('openai');

// OpenAI API 클라이언트 초기화
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY  // Netlify 환경변수에서 API 키 가져오기
});

// Netlify Functions 핸들러
exports.handler = async (event) => {
  // POST 요청만 허용
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: 'Method Not Allowed' })
    };
  }

  try {
    // 요청 본문에서 데이터 추출
    const { context, knowledgeBase } = JSON.parse(event.body);
    
    // Knowledge Base에서 관련 정보 추출
    // 선택된 플랫폼에 맞는 가이드라인 찾기
    const platformGuide = knowledgeBase.guidelines[context.platform.toLowerCase()] || knowledgeBase.guidelines.web;
    
    // 선택된 키워드가 속한 색상 그룹 찾기
    const colorGroup = Object.values(knowledgeBase.iri_colors).find(group => 
      group.keywords.includes(context.keyword)
    );

    // AI 프롬프트 생성
    const systemPrompt = `You are a UI/UX design expert. Generate a color palette and typography guide based on the provided context.
    Platform: ${context.platform}
    Service: ${context.service}
    Mood: ${context.keyword}
    Primary Color: ${context.primaryColor}
    
    Use the following guidelines: ${JSON.stringify(platformGuide)}
    
    Return a JSON object with:
    - colorSystem: primary (main, light, dark) and secondary (main, light, dark)
    - typography: bodySize, headlineSize, lineHeight
    - accessibility: textColorOnPrimary, contrastRatio`;

    // OpenAI API 호출
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Generate the design guide." }
      ],
      temperature: 0.7,      // 창의성 수준 (0~1)
      max_tokens: 500        // 최대 응답 토큰 수
    });

    // AI 응답 파싱
    const result = JSON.parse(completion.choices[0].message.content);

    // 성공 응답 반환
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(result)
    };
  } catch (error) {
    console.error('Error:', error);
    
    // 에러 발생 시 기본값 반환 (Fallback)
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        colorSystem: {
          primary: {
            main: context.primaryColor || '#6666ff',
            light: '#9999ff',
            dark: '#3333cc'
          },
          secondary: {
            main: '#ffb000',
            light: '#ffe0a0',
            dark: '#c78300'
          }
        },
        typography: {
          bodySize: '17pt',
          headlineSize: '34pt',
          lineHeight: '1.6'
        },
        accessibility: {
          textColorOnPrimary: '#ffffff',
          contrastRatio: '12.36:1'
        }
      })
    };
  }
};