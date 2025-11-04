const OpenAI = require('openai');

// OpenAI API 클라이언트 초기화
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Netlify Functions 핸들러
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: 'Method Not Allowed' })
    };
  }

  try {
    const { context, knowledgeBase } = JSON.parse(event.body);
    
    const platformGuide = knowledgeBase.guidelines[context.platform.toLowerCase()] || knowledgeBase.guidelines.web;
    const colorGroup = Object.values(knowledgeBase.iri_colors).find(group => 
      group.keywords.includes(context.keyword)
    );
    const iriHint = colorGroup ? `IRI 색채 연구에서 '${context.keyword}' 키워드는 '${colorGroup.description}' 그룹(${colorGroup.key_colors.join(', ')})과 연관됩니다. 이를 참고하여 색상을 생성하세요.` : '';

    const systemPrompt = `당신은 전문 UI/UX 디자인 시스템 생성기입니다.
    모든 응답, 설명, 주석은 반드시 **한국어**로 작성해야 합니다.
    
    사용자 컨텍스트:
    - 플랫폼: ${context.platform}
    - 서비스 목적: ${context.service}
    - 희망 분위기: ${context.keyword}

    지식 베이스 힌트:
    - 플랫폼 가이드라인: ${JSON.stringify(platformGuide)}
    - ${iriHint}

    아래 명시된 정확한 JSON 구조로 단일 JSON 객체를 반환하세요:
    
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
      "fontPairing": {
        "headline": {
          "name": "추천 Google Font 이름 (예: Noto Sans KR)",
          "weight": "추천 굵기 (예: 700)",
          "urlQuery": "Google Font API 쿼리용 이름 (예: Noto+Sans+KR:wght@700)"
        },
        "body": {
          "name": "추천 Google Font 이름 (예: Pretendard)",
          "weight": "400",
          "urlQuery": "Pretendard"
        },
        "reasoning": "이 두 한글 폰트 조합을 추천하는 이유 (서비스 목적과 분위기 연관지어 한국어로 설명)"
      },
      "uxCopy": {
        "navigation": [
          "서비스 목적('${context.service}')에 맞는 GNB 네비게이션 메뉴 1 (예: 홈)",
          "메뉴 2 (예: 서비스 소개)",
          "메뉴 3 (예: 주요 기능)",
          "메뉴 4 (예: 마이페이지)",
          "메뉴 5 (예: 고객센터)"
        ],
        "ctaButton": "서비스 목적('${context.service}')에 맞는 메인 CTA 버튼 텍스트 (예: 시작하기)",
        "cardTitle": "샘플 카드 제목 (예: 오늘의 추천)",
        "cardBody": "샘플 카드 본문 (서비스 목적과 관련된 1줄 설명)"
      },
      "designRationale": {
        "summary": "이 디자인 시스템을 선택한 이유 요약 (한국어)",
        "colorChoice": "생성된 색상 선택 이유 (한국어)",
        "typographyChoice": "기본 타이포그래피 규칙(크기, 줄간격) 선택 이유 (한국어)"
      },
      "accessibilityReport": {
        "primaryOnWhite": {
          "description": "흰색 배경(#FFFFFF) 위의 주조색(main)",
          "contrastRatio": "WCAG 명도 대비율 계산",
          "wcagAANormal": "통과/실패 (AA 일반 텍스트)",
          "wcagAAALarge": "통과/실패 (AAA 큰 텍스트)",
          "comment": "AA 일반 기준 실패 시 간단한 개선 제안 (한국어)"
        },
        "textOnPrimary": {
          "description": "주조색(main) 배경 위의 흰색 텍스트(#FFFFFF)",
          "textColor": "#FFFFFF",
          "contrastRatio": "WCAG 명도 대비율 계산",
          "wcagAANormal": "통과/실패",
          "wcagAAALarge": "통과/실패",
          "comment": "실패 시 어두운 텍스트 사용 제안 (한국어)"
        },
        "textOnWhite": {
          "description": "흰색 배경(#FFFFFF) 위의 어두운 회색 텍스트(neutral.darkGray)",
          "textColor": "(neutral.darkGray 값)",
          "contrastRatio": "WCAG 명도 대비율 계산",
          "wcagAANormal": "통과/실패",
          "wcagAAALarge": "통과/실패",
          "comment": "기본 본문 텍스트 가독성 (한국어)"
        }
      }
    }
    `;

    // OpenAI API 호출
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo-1106",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "제 컨텍스트에 맞는 디자인 가이드를 생성해 주세요." }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 2500 // UX 카피 등 추가 정보로 인해 토큰 확장
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
      body: JSON.stringify({ message: 'AI 가이드 생성에 실패했습니다.', error: error.message })
    };
  }
};