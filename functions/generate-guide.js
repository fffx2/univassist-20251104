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
    
    // 관련 지식 추출
    const platformGuide = knowledgeBase.guidelines[context.platform.toLowerCase()] || knowledgeBase.guidelines.web;
    const colorGroup = Object.values(knowledgeBase.iri_colors).find(group => 
      group.keywords.includes(context.keyword)
    );
    const iriHint = colorGroup ? `IRI 색채 연구에서 '${context.keyword}' 키워드는 '${colorGroup.description}' 그룹(${colorGroup.key_colors.join(', ')})과 연관됩니다. 이를 참고하세요.` : '';

    // AI 시스템 프롬프트 (대폭 수정)
    const systemPrompt = `You are an expert UI/UX design system generator.
    Your task is to create a comprehensive design system guide based on user context and provided knowledge.
    
    User Context:
    - Platform: ${context.platform}
    - Service Purpose: ${context.service}
    - Desired Mood: ${context.keyword}
    - User's Primary Color: ${context.primaryColor}

    Knowledge Base Hints:
    - Platform Guidelines: ${JSON.stringify(platformGuide)}
    - ${iriHint}

    Please return a single, valid JSON object with the following precise structure:
    
    {
      "colorSystem": {
        "primary": { "main": "#...", "light": "#...", "dark": "#..." },
        "secondary": { "main": "#...", "light": "#...", "dark": "#..." },
        "neutral": { "white": "#FFFFFF", "lightGray": "#F5F5F5", "gray": "#9E9E9E", "darkGray": "#424242", "black": "#212121" }
      },
      "typography": {
        "bodySize": "${platformGuide.defaultSize || '16px'}",
        "headlineSize": "${platformGuide.typeScale?.headline || '24px'}",
        "lineHeight": "${platformGuide.lineHeight || 1.6}",
        "fontFamily": "${platformGuide.font.family}, sans-serif"
      },
      "designRationale": {
        "summary": "A brief explanation of why this design system was chosen, linking the service ('${context.service}') and mood ('${context.keyword}') to the choices.",
        "colorChoice": "Specific reason for the primary and secondary color choices, considering the mood and user's primary color.",
        "typographyChoice": "Specific reason for the font size and line height based on the platform ('${context.platform}')."
      },
      "accessibilityReport": {
        "primaryOnWhite": {
          "description": "Primary color (main) on a white background (#FFFFFF).",
          "contrastRatio": "Calculate WCAG contrast ratio.",
          "wcagAANormal": "Pass/Fail (AA for normal text)",
          "wcagAAALarge": "Pass/Fail (AAA for large text)",
          "comment": "Brief recommendation if it fails AA Normal."
        },
        "textOnPrimary": {
          "description": "White text (#FFFFFF) on the primary color (main).",
          "textColor": "#FFFFFF",
          "contrastRatio": "Calculate WCAG contrast ratio.",
          "wcagAANormal": "Pass/Fail (AA for normal text)",
          "wcagAAALarge": "Pass/Fail (AAA for large text)",
          "comment": "If this fails, suggest 'dark' text instead."
        },
        "textOnWhite": {
          "description": "Dark Gray text (neutral.darkGray) on a white background (#FFFFFF).",
          "textColor": "(Use the neutral.darkGray value you generated)",
          "contrastRatio": "Calculate WCAG contrast ratio.",
          "wcagAANormal": "Pass/Fail (AA for normal text)",
          "wcagAAALarge": "Pass/Fail (AAA for large text)",
          "comment": "This should always pass."
        }
      }
    }
    `;

    // OpenAI API 호출
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo-1106", // 1106 or newer model supporting JSON mode
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Generate the design guide based on my context." }
      ],
      response_format: { type: "json_object" }, // JSON 모드 활성화
      temperature: 0.7,
      max_tokens: 1500 
    });

    // AI 응답 파싱
    const result = JSON.parse(completion.choices[0].message.content);

    // 성공 응답 반환
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result)
    };
  } catch (error) {
    console.error('Error:', error);
    
    // 에러 응답
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Failed to generate AI guide', error: error.message })
    };
  }
};