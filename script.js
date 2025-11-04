// ============================================\n// 전역 상태 관리
// ============================================\n
let appState = {
    service: '',
    platform: 'Web', // 기본값 Web으로 설정
    keyword: '',
    generatedResult: null, // AI 생성 결과 (색상 시스템)
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

        // [수정] 초기 가이드라인 표시는 삭제 (리포트 탭으로 이동)
        // renderIRIKeywords는 유지
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

            if (targetId === 'report-page' && reportData) {
                displayReportData(reportData);
            }
        });
    });
}

// ============================================\n// 2. 메인 페이지 (룰 기반 생성)
// ============================================\n
function initializeMainPage() {
    // 플랫폼 선택
    const platformSelector = document.getElementById('platform-selector');
    platformSelector.addEventListener('click', (e) => {
        if (e.target.classList.contains('platform-btn')) {
            platformSelector.querySelectorAll('.platform-btn').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            appState.platform = e.target.dataset.platform;
            // [삭제] updateGuidelineDisplay(appState.platform);
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
    
    const uniqueKeywords = [...new Set(keywords)].sort();
    
    container.innerHTML = '';
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

// [삭제] updateGuidelineDisplay 함수 (리포트 페이지로 로직 이동)

// AI 메시지 업데이트 (동적 표현)
function updateAIMessage(message, isError = false) {
    const messageEl = document.getElementById('ai-message-text');
    const boxEl = document.getElementById('ai-message-box');
    const cursorEl = boxEl.querySelector('.typing-cursor');
    
    if (isError) {
        boxEl.classList.add('error');
    } else {
        boxEl.classList.remove('error');
    }

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
            cursorEl.style.display = 'none';
        }
    }
    typeWriter();
}

// AI 가이드 생성 함수
async function generateDesignGuide() {
    if (!appState.service || !appState.keyword) {
        updateAIMessage(" '서비스 목적'과 '디자인 무드'를 모두 입력(선택)해주세요!", true);
        return;
    }

    const btn = document.getElementById('generate-guide-btn');
    const btnText = btn.querySelector('.btn-text');
    const spinner = btn.querySelector('.spinner');

    btn.disabled = true;
    btnText.classList.add('hidden');
    spinner.classList.remove('hidden');
    updateAIMessage("AI가 디자인 시스템을 생성 중입니다. 잠시만 기다려주세요...");

    try {
        const context = {
            service: appState.service,
            platform: appState.platform,
            keyword: appState.keyword
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
        reportData = result; 
        appState.generatedResult = result; 
        // [중요] appState에도 플랫폼 정보 저장
        appState.generatedPlatform = context.platform; 

        updateAIMessage("디자인 가이드 생성이 완료되었습니다! 'AI 디자인 리포트' 탭에서 확인하세요.", false);
        
        document.querySelector('.nav-link[data-target="report-page"]').click();
        displayReportData(reportData);

    } catch (error) {
        console.error('Error generating design guide:', error);
        updateAIMessage(`오류가 발생했습니다: ${error.message}`, true);
        reportData = null;
        appState.generatedResult = null;
    } finally {
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
    const aiLabMessageBox = document.getElementById('ai-lab-message-box');
    
    const updateLabColors = () => {
        appState.labColors.bgColor = bgHexInput.value;
        appState.labColors.textColor = textHexInput.value;
        updateLabPreview();
    };

    bgColorPicker.addEventListener('input', (e) => { bgHexInput.value = e.target.value; updateLabColors(); });
    bgHexInput.addEventListener('input', (e) => { if (isValidHex(e.target.value)) { bgColorPicker.value = e.target.value; updateLabColors(); } });

    textColorPicker.addEventListener('input', (e) => { textHexInput.value = e.target.value; updateLabColors(); });
    textHexInput.addEventListener('input', (e) => { if (isValidHex(e.target.value)) { textColorPicker.value = e.target.value; updateLabColors(); } });

    // 'AI 색상 추천' 버튼
    const aiRecommendBtn = document.getElementById('get-ai-recommendation-btn');
    aiRecommendBtn.addEventListener('click', async () => {
        const bgColor = appState.labColors.bgColor;
        const textColor = appState.labColors.textColor;

        const btnText = aiRecommendBtn.querySelector('.btn-text');
        const spinner = aiRecommendBtn.querySelector('.spinner');
        btnText.classList.add('hidden');
        spinner.classList.remove('hidden');
        aiRecommendBtn.disabled = true;

        aiLabMessageBox.innerHTML = '<p>AI가 색상 조합을 분석하고 추천하는 중입니다...</p>';
        aiLabMessageBox.className = 'ai-recommendation-box';
        aiLabMessageBox.style.display = 'block';

        try {
            const response = await fetch('/.netlify/functions/recommend-colors', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bgColor, textColor })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.message || `AI 추천 서버 오류 (404: 파일이 없거나 500: 서버 내부 오류)`);
            }

            const result = await response.json();
            
            aiLabMessageBox.innerHTML = `
                <h4>현재 조합 분석</h4>
                <p>${result.currentAnalysis.comment} (명도 대비: ${result.currentAnalysis.contrastRatio}, <strong>AA: ${result.currentAnalysis.wcagAANormal}</strong>)</p>
                <h4>AI 추천</h4>
                <p><strong>추천 텍스트 색상:</strong> 
                   <span class="color-swatch-small" style="background-color:${result.recommendations.accessibleTextColor.hex}"></span> 
                   ${result.recommendations.accessibleTextColor.hex} (${result.recommendations.accessibleTextColor.comment})</p>
                <p><strong>추천 포인트 색상:</strong> 
                   <span class="color-swatch-small" style="background-color:${result.recommendations.accentColor.hex}"></span> 
                   ${result.recommendations.accentColor.hex} (${result.recommendations.accentColor.comment})</p>
                <p class="reasoning"><strong>AI 코멘트:</strong> ${result.reasoning}</p>
            `;

        } catch (error) {
            console.error('AI Recommendation Error:', error);
            aiLabMessageBox.innerHTML = `<p>AI 추천을 가져오는 데 실패했습니다: ${error.message}</p>`;
            aiLabMessageBox.classList.add('error');
        } finally {
            btnText.classList.remove('hidden');
            spinner.classList.add('hidden');
            aiRecommendBtn.disabled = false;
        }
    });

    // 'AI 리포트 색상 불러오기' 버튼
    const loadAiColorsBtn = document.getElementById('load-ai-colors-btn');
    loadAiColorsBtn.addEventListener('click', () => {
        if (appState.generatedResult && appState.generatedResult.colorSystem) {
            const colors = appState.generatedResult.colorSystem;
            const newBgColor = colors.neutral.lightGray || '#F5F5F5';
            const newTextColor = colors.neutral.darkGray || '#333333';

            bgColorPicker.value = newBgColor;
            bgHexInput.value = newBgColor;
            textColorPicker.value = newTextColor;
            textHexInput.value = newTextColor;

            updateLabColors();

            aiLabMessageBox.innerHTML = `<p>AI 리포트의 뉴트럴 색상을 불러왔습니다. (배경: ${newBgColor}, 텍스트: ${newTextColor})</p>`;
            aiLabMessageBox.className = 'ai-recommendation-box';
            aiLabMessageBox.style.display = 'block';
        } else {
            aiLabMessageBox.innerHTML = `<p>먼저 '컬러시스템 설계' 탭에서 AI 가이드를 생성해주세요.</p>`;
            aiLabMessageBox.className = 'ai-recommendation-box error';
            aiLabMessageBox.style.display = 'block';
        }
    });

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

    previewContent.style.backgroundColor = bgColor;
    previewContent.style.color = textColor;
    previewButton.style.backgroundColor = textColor; 
    previewButton.style.color = bgColor;

    const contrast = getContrastRatio(bgColor, textColor);
    contrastRatioEl.textContent = `Contrast: ${contrast.toFixed(2)}:1`;

    updateWCAGBadge(wcagNormalEl, 'AA Normal', contrast, 4.5);
    updateWCAGBadge(wcagLargeEl, 'AA Large', contrast, 3.0);
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
    const codeTabs = document.querySelector('.code-export-tabs');
    codeTabs.addEventListener('click', (e) => {
        if (e.target.classList.contains('export-tab')) {
            codeTabs.querySelectorAll('.export-tab').forEach(tab => tab.classList.remove('active'));
            e.target.classList.add('active');
            currentCodeTab = e.target.dataset.tab;
            updateCodeOutput(reportData); 
        }
    });

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

// 구글 폰트 동적 로드 헬퍼 함수
function loadGoogleFont(fontName, weight) {
    try {
        if (fontName.toLowerCase().includes('pretendard')) return;
        const fontQuery = fontName.replace(/ /g, '+') + (weight ? `:wght@${weight}` : '');
        const linkId = `google-font-${fontName.replace(/ /g, '-')}`;
        if (document.getElementById(linkId)) return;

        const link = document.createElement('link');
        link.id = linkId;
        link.rel = 'stylesheet';
        link.href = `https://fonts.googleapis.com/css2?family=${fontQuery}&display=swap`;
        document.head.appendChild(link);
    } catch (e) {
        console.error("Failed to load Google Font:", fontName, e);
    }
}


// [수정] 리포트 데이터 표시 (UX 카피, 플랫폼 가이드라인 추가)
function displayReportData(data) {
    if (!data) {
        document.getElementById('report-placeholder').classList.remove('hidden');
        document.querySelectorAll('.report-section').forEach(s => s.classList.add('hidden'));
        return;
    }

    document.getElementById('report-placeholder').classList.add('hidden');
    document.querySelectorAll('.report-section').forEach(s => s.classList.remove('hidden'));

    // 1. 디자인 근거 (한글)
    const rationaleContainer = document.getElementById('design-rationale');
    if (data.designRationale) {
        rationaleContainer.innerHTML = `
            <p><strong>종합 요약:</strong> ${data.designRationale.summary || '-'}</p>
            <p><strong>색상 선택 이유:</strong> ${data.designRationale.colorChoice || '-'}</p>
            <p><strong>타이포그래피 선택 이유:</strong> ${data.designRationale.typographyChoice || '-'}</p>
        `;
    } // (이하 else 생략)

    // 2. 폰트 페어링
    const fontPairingContainer = document.getElementById('font-pairing-container');
    const fontPairingReasoning = document.getElementById('font-pairing-reasoning');
    if (data.fontPairing) {
        const { headline, body, reasoning } = data.fontPairing;
        loadGoogleFont(headline.name, headline.weight);
        loadGoogleFont(body.name, body.weight);
        fontPairingContainer.innerHTML = `
            <div class="font-card">
                <div class="font-label">헤드라인 (Headline)</div>
                <div class="font-preview" style="font-family: '${headline.name}', sans-serif; font-weight: ${headline.weight};">가나다라</div>
                <div class="font-info">${headline.name} (Weight: ${headline.weight})</div>
            </div>
            <div class="font-card">
                <div class="font-label">본문 (Body)</div>
                <div class="font-preview" style="font-family: '${body.name}', sans-serif; font-weight: ${body.weight}; font-size: 24px;">가나다라 마바사아 자차카타</div>
                <div class="font-info">${body.name} (Weight: ${body.weight})</div>
            </div>
        `;
        fontPairingReasoning.innerHTML = `<p><strong>AI 추천 이유:</strong> ${reasoning}</p>`;
    } // (이하 else 생략)


    // 3. 색상 시스템
    const paletteGrid = document.getElementById('palette-grid');
    paletteGrid.innerHTML = '';
    for (const [category, colors] of Object.entries(data.colorSystem)) {
        for (const [name, hex] of Object.entries(colors)) {
            const colorBox = document.createElement('div');
            colorBox.className = 'color-box';
            colorBox.innerHTML = `
                <div class="color-swatch-large" style="background-color: ${hex}"></div>
                <div class="color-info">
                    <strong>${category} - ${name}</strong>
                    <span>${hex}</span>
                </div>
            `;
            paletteGrid.appendChild(colorBox);
        }
    }

    // 4. [수정] AI UX 카피라이팅 + 컴포넌트 미리보기
    const navList = document.getElementById('nav-preview-list');
    const showcase = document.getElementById('component-showcase');
    const pColor = data.colorSystem.primary.main;
    const pText = getContrastRatio(pColor, '#FFFFFF') > 3 ? '#FFFFFF' : '#000000';

    if (data.uxCopy) {
        // 네비게이션 채우기
        navList.innerHTML = data.uxCopy.navigation
            .map(item => `<li><a href="#">${item}</a></li>`)
            .join('');
        
        // 컴포넌트 텍스트 AI가 생성한 텍스트로 채우기
        showcase.innerHTML = `
            <button class="preview-btn" style="background-color: ${pColor}; color: ${pText};">${data.uxCopy.ctaButton || 'Primary Button'}</button>
            <button class="preview-btn" style="background-color: ${data.colorSystem.secondary.main}; color: #000000;">${data.uxCopy.navigation[1] || 'Secondary'}</button>
            <div class="preview-card" style="border-top-color: ${pColor};">
                <h3>${data.uxCopy.cardTitle || 'Card Title'}</h3>
                <p>${data.uxCopy.cardBody || 'This is a card component.'}</p>
            </div>
        `;
    } else {
        // (폴백) uxCopy가 없을 경우
        navList.innerHTML = "<li>네비게이션 생성 실패</li>";
        showcase.innerHTML = `
            <button class="preview-btn" style="background-color: ${pColor}; color: ${pText};">Primary Button</button>
            <div class="preview-card" style="border-top-color: ${pColor};"><h3>Card Title</h3><p>Card body text.</p></div>
        `;
    }
    
    // 5. [신규] 플랫폼 가이드라인
    const guidelineReportEl = document.getElementById('guideline-content-report');
    const platformKey = appState.generatedPlatform ? appState.generatedPlatform.toLowerCase() : 'web';
    const guide = knowledgeBase.guidelines[platformKey];
    if (guide) {
        guidelineReportEl.innerHTML = `
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
        guidelineReportEl.innerHTML = '<p>플랫폼 가이드라인 정보를 불러오지 못했습니다.</p>';
    }


    // 6. 기본 타이포그래피
    const typoRules = document.getElementById('typography-rules');
    typoRules.innerHTML = `
        <div class="typo-demo" style="font-family: ${data.typography.fontFamily};">
            <h1 style="font-size: ${data.typography.headlineSize}; line-height: ${data.typography.lineHeight};">기본 헤드라인: ${data.typography.headlineSize}</h1>
            <p style="font-size: ${data.typography.bodySize}; line-height: ${data.typography.lineHeight};">기본 본문: ${data.typography.bodySize}. (줄간격: ${data.typography.lineHeight})</p>
        </div>
        <p class="description" style="margin-top: 15px;">* 이 규칙은 플랫폼 표준이며, 위의 AI 추천 폰트 페어링을 적용하여 사용할 수 있습니다.</p>
    `;

    // 7. 접근성 분석 리포트 (한글)
    const analysisContainer = document.getElementById('accessibility-analysis');
    analysisContainer.innerHTML = ''; 
    if (data.accessibilityReport) {
        for (const [key, report] of Object.entries(data.accessibilityReport)) {
            const passFailAAN = report.wcagAANormal.toLowerCase();
            const passFailAAAL = report.wcagAAALarge.toLowerCase();
            analysisContainer.innerHTML += `
                <div class="analysis-card">
                    <h4>${report.description}</h4>
                    ${report.textColor ? `<p><strong>대상:</strong> <span class="color-swatch-small" style="background-color:${report.textColor}"></span> ${report.textColor}</p>` : ''}
                    <p><strong>명도 대비:</strong> ${report.contrastRatio}</p>
                    <div class="wcag-status">
                        <span class="status-tag ${passFailAAN}">AA (Normal): ${report.wcagAANormal}</span>
                        <span class="status-tag ${passFailAAAL}">AAA (Large): ${report.wcagAAALarge}</span>
                    </div>
                    <p class="comment">${report.comment}</p>
                </div>
            `;
        }
    } // (이하 else 생략)

    // 8. 코드 내보내기
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
            code += `\n  /* 기본 타이포그래피 */\n`;
            code += `  --font-family-base: "${typography.fontFamily}";\n`;
            code += `  --font-size-body: ${typography.bodySize};\n`;
            code += `  --font-size-headline: ${typography.headlineSize};\n`;
            code += `  --line-height-base: ${typography.lineHeight};\n`;
            
            if(data.fontPairing) {
                code += `\n  /* AI 추천 폰트 */\n`;
                code += `  --font-family-headline: "${data.fontPairing.headline.name}", sans-serif;\n`;
                code += `  --font-family-body: "${data.fontPairing.body.name}", sans-serif;\n`;
            }
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
            if(data.fontPairing) {
                code += `\n// AI 추천 폰트\n`;
                code += `$font-family-headline: "${data.fontPairing.headline.name}", sans-serif;\n`;
                code += `$font-family-body: "${data.fontPairing.body.name}", sans-serif;\n`;
            }
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
            code += `      },\n      fontFamily: {\n`;
            code += `        base: ["${typography.fontFamily}", "sans-serif"],\n`;
            if(data.fontPairing) {
                code += `        headline: ["${data.fontPairing.headline.name}", "sans-serif"],\n`;
                code += `        body: ["${data.fontPairing.body.name}", "sans-serif"],\n`;
            }
            code += `      },\n      fontSize: {\n`;
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