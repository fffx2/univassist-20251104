// ============================================\n// 전역 상태 관리
// ============================================\n
let appState = {
    service: '',
    platform: 'Web', // 기본값 Web으로 설정
    mood: { soft: 50, static: 50 },
    keyword: '',
    primaryColor: '#6666FF', // 기본값 설정
    generatedResult: null,
    labColors: {
        bgColor: '#F5F5F5',
        textColor: '#333333'
    }
};

let knowledgeBase = {};
let typingTimeout;
let reportData = null;
let currentCodeTab = 'css';

// ============================================\n// 앱 초기화
// ============================================\n
document.addEventListener('DOMContentLoaded', initializeApp);

async function initializeApp() {
    try {
        const response = await fetch('./knowledge_base.json');
        if (!response.ok) throw new Error('Network response was not ok');
        knowledgeBase = await response.json();
        
        setupNavigation();
        initializeMainPage();
        initializeLabPage();
        initializeReportPage();

        // 초기 가이드라인 표시
        updateGuidelineDisplay(appState.platform);
        // 초기 키워드 렌더링
        renderIRIKeywords();
    } catch (error) {
        console.error('Failed to initialize app:', error);
        updateAIMessage("시스템 초기화 중 오류가 발생했습니다.", true);
    }
}

// ============================================\n// 1. 네비게이션 설정
// ============================================\n
function setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    const pages = document.querySelectorAll('.main-page, .lab-page, .report-page');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('data-target');

            navLinks.forEach(nav => nav.classList.remove('active'));
            link.classList.add('active');

            pages.forEach(page => {
                page.classList.remove('active');
                if (page.id === targetId) {
                    page.classList.add('active');
                }
            });

            // 리포트 탭으로 이동 시 데이터 자동 표시
            if (targetId === 'report-page' && reportData) {
                displayReportData(reportData);
            }
        });
    });
}

// ============================================\n// 2. 메인 페이지 (가이드 생성)
// ============================================\n
function initializeMainPage() {
    // 플랫폼 선택
    const platformSelector = document.getElementById('platform-selector');
    platformSelector.addEventListener('click', (e) => {
        if (e.target.classList.contains('platform-btn')) {
            platformSelector.querySelectorAll('.platform-btn').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            appState.platform = e.target.dataset.platform;
            updateGuidelineDisplay(appState.platform);
        }
    });

    // 주조 색상
    const colorPicker = document.getElementById('primary-color-picker');
    const colorHex = document.getElementById('primary-color-hex');
    colorPicker.addEventListener('input', (e) => {
        appState.primaryColor = e.target.value;
        colorHex.value = e.target.value;
    });
    colorHex.addEventListener('input', (e) => {
        if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
            appState.primaryColor = e.target.value;
            colorPicker.value = e.target.value;
        }
    });

    // 서비스 목적
    document.getElementById('service-purpose').addEventListener('input', (e) => {
        appState.service = e.target.value;
    });

    // 생성 버튼
    document.getElementById('generate-guide-btn').addEventListener('click', generateDesignGuide);
}

// IRI 키워드 렌더링
function renderIRIKeywords() {
    const container = document.getElementById('iri-keyword-selector');
    if (!knowledgeBase.iri_colors || !container) return;

    let keywords = [];
    Object.values(knowledgeBase.iri_colors).forEach(group => {
        keywords = keywords.concat(group.keywords);
    });
    
    // 중복 제거 및 정렬
    const uniqueKeywords = [...new Set(keywords)].sort();
    
    container.innerHTML = ''; // 초기화
    uniqueKeywords.forEach(keyword => {
        const chip = document.createElement('button');
        chip.className = 'keyword-chip';
        chip.textContent = keyword;
        chip.dataset.keyword = keyword;
        chip.addEventListener('click', () => {
            container.querySelectorAll('.keyword-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            appState.keyword = keyword;
        });
        container.appendChild(chip);
    });
}

// 가이드라인 업데이트
function updateGuidelineDisplay(platform) {
    const contentEl = document.getElementById('guideline-text');
    const platformKey = platform.toLowerCase();
    const guide = knowledgeBase.guidelines[platformKey];

    if (guide) {
        contentEl.innerHTML = `
            <strong>${guide.source}</strong>
            <p>${guide.description}</p>
            <ul>
                <li><strong>주요 폰트:</strong> ${guide.font.family} (${guide.font.unit})</li>
                <li><strong>본문 크기:</strong> ${guide.defaultSize} (최소 ${guide.minimumSize})</li>
                <li><strong>줄간격:</strong> ${guide.lineHeight}</li>
                <li><strong>명도 대비:</strong> ${guide.contrast}</li>
            </ul>
        `;
    } else {
        contentEl.innerHTML = '<p>선택된 플랫폼에 대한 가이드라인 정보가 없습니다.</p>';
    }
}

// AI 메시지 업데이트
function updateAIMessage(message, isError = false) {
    const messageEl = document.getElementById('ai-message-text');
    const boxEl = document.getElementById('ai-message-box');
    const cursorEl = boxEl.querySelector('.typing-cursor');
    
    if (isError) {
        boxEl.classList.add('error');
    } else {
        boxEl.classList.remove('error');
    }

    // 타이핑 효과
    clearTimeout(typingTimeout);
    messageEl.innerHTML = '';
    cursorEl.style.display = 'inline-block';
    
    let i = 0;
    function typeWriter() {
        if (i < message.length) {
            messageEl.innerHTML += message.charAt(i);
            i++;
            typingTimeout = setTimeout(typeWriter, 30);
        } else {
            cursorEl.style.display = 'none'; // 타이핑 완료
        }
    }
    typeWriter();
}

// AI 가이드 생성 함수
async function generateDesignGuide() {
    // 1. 유효성 검사
    if (!appState.service || !appState.keyword) {
        updateAIMessage(" '서비스 목적'과 '디자인 무드'를 모두 입력(선택)해주세요!", true);
        return;
    }

    // 2. 로딩 상태 활성화
    const btn = document.getElementById('generate-guide-btn');
    const btnText = btn.querySelector('.btn-text');
    const spinner = btn.querySelector('.spinner');

    btn.disabled = true;
    btnText.classList.add('hidden');
    spinner.classList.remove('hidden');
    updateAIMessage("AI가 디자인 시스템을 생성 중입니다. 잠시만 기다려주세요...");

    // 3. API 요청
    try {
        const context = {
            service: appState.service,
            platform: appState.platform,
            keyword: appState.keyword,
            primaryColor: appState.primaryColor
        };

        const response = await fetch('/.netlify/functions/generate-guide', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ context, knowledgeBase })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.message || '서버에서 응답을 받지 못했습니다.');
        }

        const result = await response.json();
        reportData = result; // 전역 변수에 결과 저장
        appState.generatedResult = result; // 상태에도 저장

        updateAIMessage("디자인 가이드 생성이 완료되었습니다! 'AI 디자인 리포트' 탭에서 확인하세요.", false);
        
        // [수정] 리포트 페이지로 자동 이동 및 데이터 표시
        document.querySelector('.nav-link[data-target="report-page"]').click();
        displayReportData(reportData);

    } catch (error) {
        console.error('Error generating design guide:', error);
        updateAIMessage(`오류가 발생했습니다: ${error.message}`, true);
        reportData = null; // 오류 발생 시 데이터 초기화
    } finally {
        // 4. 로딩 상태 비활성화
        btn.disabled = false;
        btnText.classList.remove('hidden');
        spinner.classList.add('hidden');
    }
}


// ============================================\n// 3. 유니버설 컬러시스템 실험실
// ============================================\n
function initializeLabPage() {
    const bgColorPicker = document.getElementById('lab-bg-color');
    const bgHexInput = document.getElementById('lab-bg-hex');
    const textColorPicker = document.getElementById('lab-text-color');
    const textHexInput = document.getElementById('lab-text-hex');
    
    // 색상 변경 이벤트 통합 핸들러
    const updateLabColors = () => {
        appState.labColors.bgColor = bgHexInput.value;
        appState.labColors.textColor = textHexInput.value;
        updateLabPreview();
    };

    // 배경색
    bgColorPicker.addEventListener('input', (e) => { bgHexInput.value = e.target.value; updateLabColors(); });
    bgHexInput.addEventListener('input', (e) => { if (isValidHex(e.target.value)) { bgColorPicker.value = e.target.value; updateLabColors(); } });

    // 텍스트색
    textColorPicker.addEventListener('input', (e) => { textHexInput.value = e.target.value; updateLabColors(); });
    textHexInput.addEventListener('input', (e) => { if (isValidHex(e.target.value)) { textColorPicker.value = e.target.value; updateLabColors(); } });

    // [신규] AI 추천 버튼 이벤트 리스너 (Idea 2)
    const aiRecommendBtn = document.getElementById('get-ai-recommendation-btn');
    const aiRecommendOutput = document.getElementById('ai-color-recommendations');
    
    aiRecommendBtn.addEventListener('click', async () => {
        const bgColor = appState.labColors.bgColor;
        const textColor = appState.labColors.textColor;

        // 로딩 상태
        aiRecommendBtn.querySelector('.btn-text').classList.add('hidden');
        aiRecommendBtn.querySelector('.spinner').classList.remove('hidden');
        aiRecommendBtn.disabled = true;
        aiRecommendOutput.innerHTML = '<p>AI가 색상 조합을 분석하고 추천하는 중입니다...</p>';
        aiRecommendOutput.classList.remove('error');

        try {
            const response = await fetch('/.netlify/functions/recommend-colors', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bgColor, textColor })
            });

            if (!response.ok) {
                throw new Error(`AI 추천 서버 오류: ${response.statusText}`);
            }

            const result = await response.json();
            
            // 결과 표시
            aiRecommendOutput.innerHTML = `
                <h4>현재 조합 분석</h4>
                <p>${result.currentAnalysis.comment} (명도 대비: ${result.currentAnalysis.contrastRatio}, <strong>AA: ${result.currentAnalysis.wcagAANormal}</strong>)</p>
                <h4>AI 추천</h4>
                <p><strong>추천 텍스트 색상:</strong> 
                   <span class="color-swatch" style="background-color:${result.recommendations.accessibleTextColor.hex}"></span> 
                   ${result.recommendations.accessibleTextColor.hex} (${result.recommendations.accessibleTextColor.comment})</p>
                <p><strong>추천 포인트 색상:</strong> 
                   <span class="color-swatch" style="background-color:${result.recommendations.accentColor.hex}"></span> 
                   ${result.recommendations.accentColor.hex} (${result.recommendations.accentColor.comment})</p>
                <p class="reasoning"><strong>AI 코멘트:</strong> ${result.reasoning}</p>
            `;

        } catch (error) {
            console.error('AI Recommendation Error:', error);
            aiRecommendOutput.innerHTML = `<p>AI 추천을 가져오는 데 실패했습니다: ${error.message}</p>`;
            aiRecommendOutput.classList.add('error');
        } finally {
            // 로딩 상태 해제
            aiRecommendBtn.querySelector('.btn-text').classList.remove('hidden');
            aiRecommendBtn.querySelector('.spinner').classList.add('hidden');
            aiRecommendBtn.disabled = false;
        }
    });

    // 초기 프리뷰 업데이트
    updateLabPreview();
}

// 랩 프리뷰 업데이트
function updateLabPreview() {
    const { bgColor, textColor } = appState.labColors;
    const previewContent = document.getElementById('preview-content');
    const previewButton = document.getElementById('preview-button');
    const contrastRatioEl = document.getElementById('contrast-ratio');
    const wcagNormalEl = document.getElementById('wcag-badge-normal');
    const wcagLargeEl = document.getElementById('wcag-badge-large');

    // 배경 및 텍스트 색상 적용
    previewContent.style.backgroundColor = bgColor;
    previewContent.style.color = textColor;
    previewButton.style.backgroundColor = textColor; // 버튼은 반전 시켜보기
    previewButton.style.color = bgColor;

    // 명도 대비 계산
    const contrast = getContrastRatio(bgColor, textColor);
    contrastRatioEl.textContent = `Contrast: ${contrast.toFixed(2)}:1`;

    // WCAG 배지 업데이트
    updateWCAGBadge(wcagNormalEl, 'AA Normal', contrast, 4.5);
    updateWCAGBadge(wcagLargeEl, 'AA Large', contrast, 3.0);

    // TODO: IRI 감성 분석 로직 (현재는 비어있음)
    // updateIRIAnalysis(bgColor, textColor);
}

function updateWCAGBadge(element, prefix, contrast, threshold) {
    if (contrast >= threshold) {
        element.textContent = `${prefix}: Pass`;
        element.classList.add('pass');
        element.classList.remove('fail');
    } else {
        element.textContent = `${prefix}: Fail`;
        element.classList.add('fail');
        element.classList.remove('pass');
    }
}

function isValidHex(hex) {
    return /^#[0-9A-F]{6}$/i.test(hex);
}

// ============================================\n// 4. AI 리포트 페이지
// ============================================\n
function initializeReportPage() {
    // 코드 내보내기 탭
    const codeTabs = document.querySelector('.code-export-tabs');
    codeTabs.addEventListener('click', (e) => {
        if (e.target.classList.contains('export-tab')) {
            codeTabs.querySelectorAll('.export-tab').forEach(tab => tab.classList.remove('active'));
            e.target.classList.add('active');
            currentCodeTab = e.target.dataset.tab;
            updateCodeOutput(reportData); // 코드 내용 변경
        }
    });

    // 코드 복사 버튼
    document.getElementById('copy-code-btn').addEventListener('click', () => {
        const code = document.getElementById('code-output').textContent;
        navigator.clipboard.writeText(code).then(() => {
            const btn = document.getElementById('copy-code-btn');
            btn.textContent = '✅ Copied!';
            btn.classList.add('copied');
            setTimeout(() => {
                btn.textContent = '📋 Copy to Clipboard';
                btn.classList.remove('copied');
            }, 2000);
        });
    });
}

// [수정] 리포트 데이터 표시 (Idea 1a, 1b)
function displayReportData(data) {
    if (!data) {
        document.getElementById('report-placeholder').classList.remove('hidden');
        document.querySelectorAll('.report-section').forEach(s => s.classList.add('hidden'));
        return;
    }

    document.getElementById('report-placeholder').classList.add('hidden');
    document.querySelectorAll('.report-section').forEach(s => s.classList.remove('hidden'));

    // 1. [신규] 디자인 근거 (Rationale)
    const rationaleContainer = document.getElementById('design-rationale');
    if (data.designRationale) {
        rationaleContainer.innerHTML = `
            <p><strong>종합 요약:</strong> ${data.designRationale.summary || '-'}</p>
            <p><strong>색상 선택 이유:</strong> ${data.designRationale.colorChoice || '-'}</p>
            <p><strong>타이포그래피 선택 이유:</strong> ${data.designRationale.typographyChoice || '-'}</p>
        `;
    } else {
        rationaleContainer.innerHTML = '<p>디자인 근거를 생성하지 못했습니다.</p>';
    }

    // 2. 색상 시스템
    const paletteGrid = document.getElementById('palette-grid');
    paletteGrid.innerHTML = '';
    for (const [category, colors] of Object.entries(data.colorSystem)) {
        for (const [name, hex] of Object.entries(colors)) {
            const colorBox = document.createElement('div');
            colorBox.className = 'color-box';
            colorBox.innerHTML = `
                <div class="color-swatch" style="background-color: ${hex}"></div>
                <div class="color-info">
                    <strong>${category} - ${name}</strong>
                    <span>${hex}</span>
                </div>
            `;
            paletteGrid.appendChild(colorBox);
        }
    }

    // 3. 타이포그래피
    const typoRules = document.getElementById('typography-rules');
    typoRules.innerHTML = `
        <div class="typo-demo" style="font-family: ${data.typography.fontFamily};">
            <h1 style="font-size: ${data.typography.headlineSize}; line-height: ${data.typography.lineHeight};">Headline: ${data.typography.headlineSize}</h1>
            <p style="font-size: ${data.typography.bodySize}; line-height: ${data.typography.lineHeight};">Body: ${data.typography.bodySize}. (Line Height: ${data.typography.lineHeight})</p>
        </div>
    `;

    // 4. 컴포넌트 미리보기 (스타일 동적 적용)
    const showcase = document.getElementById('component-showcase');
    const pColor = data.colorSystem.primary.main;
    const pText = getContrastRatio(pColor, '#FFFFFF') > 3 ? '#FFFFFF' : '#000000';
    showcase.innerHTML = `
        <button class="preview-btn" style="background-color: ${pColor}; color: ${pText};">Primary Button</button>
        <button class="preview-btn" style="background-color: ${data.colorSystem.secondary.main}; color: #000000;">Secondary Button</button>
        <div class="preview-card" style="border-top-color: ${pColor};">
            <h3>Card Title</h3>
            <p>This is a card component using the generated neutral colors.</p>
        </div>
    `;

    // 5. [신규] 접근성 분석 리포트
    const analysisContainer = document.getElementById('accessibility-analysis');
    analysisContainer.innerHTML = ''; // 초기화
    if (data.accessibilityReport) {
        for (const [key, report] of Object.entries(data.accessibilityReport)) {
            const passFailAAN = report.wcagAANormal.toLowerCase();
            const passFailAAAL = report.wcagAAALarge.toLowerCase();
            
            analysisContainer.innerHTML += `
                <div class="analysis-card">
                    <h4>${report.description}</h4>
                    ${report.textColor ? `<p><strong>대상:</strong> <span class="color-swatch" style="background-color:${report.textColor}"></span> ${report.textColor}</p>` : ''}
                    <p><strong>명도 대비:</strong> ${report.contrastRatio}</p>
                    <div class="wcag-status">
                        <span class="status-tag ${passFailAAN}">AA (Normal): ${report.wcagAANormal}</span>
                        <span class="status-tag ${passFailAAAL}">AAA (Large): ${report.wcagAAALarge}</span>
                    </div>
                    <p class="comment">${report.comment}</p>
                </div>
            `;
        }
    } else {
        analysisContainer.innerHTML = '<p>접근성 분석 리포트를 생성하지 못했습니다.</p>';
    }

    // 6. 코드 내보내기
    updateCodeOutput(data);
}

// 코드 출력 업데이트
function updateCodeOutput(data) {
    const codeOutput = document.getElementById('code-output');
    if (!data) {
        codeOutput.textContent = "/* AI 가이드를 생성하면 코드가 여기에 표시됩니다. */";
        return;
    }

    const { colorSystem, typography } = data;
    let code = '';

    switch (currentCodeTab) {
        case 'css':
            code = ':root {\n';
            for (const [category, colors] of Object.entries(colorSystem)) {
                for (const [name, hex] of Object.entries(colors)) {
                    code += `  --color-${category}-${name}: ${hex};\n`;
                }
            }
            code += `\n  --font-family-base: "${typography.fontFamily}";\n`;
            code += `  --font-size-body: ${typography.bodySize};\n`;
            code += `  --font-size-headline: ${typography.headlineSize};\n`;
            code += `  --line-height-base: ${typography.lineHeight};\n`;
            code += '}';
            break;

        case 'scss':
            code = '// Color System\n';
            code += '$colors: (\n';
            for (const [category, colors] of Object.entries(colorSystem)) {
                code += `  ${category}: (\n`;
                for (const [name, hex] of Object.entries(colors)) {
                    code += `    ${name}: ${hex},\n`;
                }
                code += `  ),\n`;
            }
            code += ');\n\n';
            code += '// Typography\n';
            code += `$font-family-base: "${typography.fontFamily}";\n`;
            code += `$font-size-body: ${typography.bodySize};\n`;
            code += `$font-size-headline: ${typography.headlineSize};\n`;
            code += `$line-height-base: ${typography.lineHeight};\n`;
            break;

        case 'tailwind':
            code = `// tailwind.config.js\nmodule.exports = {\n  theme: {\n    extend: {\n      colors: {\n`;
            for (const [category, colors] of Object.entries(colorSystem)) {
                code += `        ${category}: {\n`;
                for (const [name, hex] of Object.entries(colors)) {
                    code += `          ${name}: '${hex}',\n`;
                }
                code += `        },\n`;
            }
            code += `      },\n      fontFamily: {\n        base: ["${typography.fontFamily}", "sans-serif"],\n      },\n      fontSize: {\n`;
            code += `        'body': '${typography.bodySize}',\n`;
            code += `        'headline': '${typography.headlineSize}',\n`;
            code += `      },\n      lineHeight: {\n        'base': ${typography.lineHeight},\n      }\n    },\n  },\n  plugins: [],\n};`;
            break;
    }
    codeOutput.textContent = code;
}


// ============================================\n// 유틸리티 함수 (명도 대비)
// ============================================\n
function getContrastRatio(hex1, hex2) {
    const lum1 = getLuminance(hex1);
    const lum2 = getLuminance(hex2);
    return (Math.max(lum1, lum2) + 0.05) / (Math.min(lum1, lum2) + 0.05);
}

function getLuminance(hex) {
    const rgb = hexToRgb(hex);
    if (!rgb) return 0;
    const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(c => {
        c /= 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function hexToRgb(hex) {
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}