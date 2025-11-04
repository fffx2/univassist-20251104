// ============================================\n// 전역 상태 관리
// ============================================\n
let appState = {
    service: '',
    platform: 'Web', 
    keyword: '',
    generatedResult: null, // AI가 생성한 초안 데이터 (Tab 1 -> Tab 2)
    labColors: {
        bgColor: '#F5F5F5',
        textColor: '#333333',
        primaryColor: '#6666FF'
    }
};

let knowledgeBase = {};
let typingTimeout;
let reportData = null; // 사용자가 '확정'한 최종 리포트 데이터 (Tab 2 -> Tab 3)
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
            pages.forEach(page => page.classList.remove('active'));
            
            link.classList.add('active');
            document.getElementById(targetId).classList.add('active');

            if (targetId === 'lab-page') {
                loadAiDraftToLab(); 
            } else if (targetId === 'report-page') {
                displayReportData(reportData);
            }
        });
    });
}

// 탭을 프로그래매틱하게 변경하는 헬퍼 함수
function navigateToTab(targetId) {
    document.querySelector(`.nav-link[data-target="${targetId}"]`).click();
}


// ============================================\n// 2. 메인 페이지 (AI 초안 생성)
// ============================================\n
function initializeMainPage() {
    const platformSelector = document.getElementById('platform-selector');
    platformSelector.addEventListener('click', (e) => {
        if (e.target.classList.contains('platform-btn')) {
            platformSelector.querySelectorAll('.platform-btn').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            appState.platform = e.target.dataset.platform;
        }
    });

    document.getElementById('service-purpose').addEventListener('input', (e) => {
        appState.service = e.target.value;
    });

    document.getElementById('generate-guide-btn').addEventListener('click', generateDesignGuide);

    document.getElementById('go-to-lab-btn').addEventListener('click', () => {
        navigateToTab('lab-page');
    });
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

// AI 메시지 업데이트
function updateAIMessage(message, isError = false) {
    const messageEl = document.getElementById('ai-message-text');
    const boxEl = document.getElementById('ai-message-box');
    const cursorEl = boxEl.querySelector('.typing-cursor');
    
    boxEl.classList.toggle('error', isError);

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

// AI 가이드 '초안' 생성 함수
async function generateDesignGuide() {
    if (!appState.service || !appState.keyword) {
        updateAIMessage(" '서비스 목적'과 '디자인 무드'를 모두 입력(선택)해주세요!", true);
        return;
    }

    const btn = document.getElementById('generate-guide-btn');
    const btnText = btn.querySelector('.btn-text');
    const spinner = btn.querySelector('.spinner');
    const draftPreview = document.getElementById('ai-draft-preview');

    btn.disabled = true;
    btnText.classList.add('hidden');
    spinner.classList.remove('hidden');
    draftPreview.classList.add('hidden'); 
    updateAIMessage("AI가 디자인 시스템 초안을 생성 중입니다. 잠시만 기다려주세요...");

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
        
        appState.generatedResult = result; 
        reportData = null; 

        updateAIMessage("AI 초안 생성이 완료되었습니다! 2단계 탭에서 색상을 검증하세요.", false);
        showAiDraftPreview(result.colorSystem);
        
        setTimeout(() => {
            navigateToTab('lab-page');
        }, 1000);

    } catch (error) {
        console.error('Error generating design guide:', error);
        updateAIMessage(`오류가 발생했습니다: ${error.message}`, true);
        appState.generatedResult = null;
    } finally {
        btn.disabled = false;
        btnText.classList.remove('hidden');
        spinner.classList.add('hidden');
    }
}

// (Tab 1) AI 초안 미리보기 표시
function showAiDraftPreview(colorSystem) {
    const draftPreview = document.getElementById('ai-draft-preview');
    
    const primary = colorSystem.primary.main;
    const secondary = colorSystem.secondary.main;
    const text = colorSystem.neutral.darkGray;
    
    document.getElementById('draft-primary-swatch').style.backgroundColor = primary;
    document.getElementById('draft-primary-hex').textContent = primary;
    
    document.getElementById('draft-secondary-swatch').style.backgroundColor = secondary;
    document.getElementById('draft-secondary-hex').textContent = secondary;
    
    document.getElementById('draft-text-swatch').style.backgroundColor = text;
    document.getElementById('draft-text-hex').textContent = text;
    
    draftPreview.classList.remove('hidden');
}


// ============================================\n// 3. 유니버설 컬러시스템 실험실 (검증)
// ============================================\n

// 랩 페이지 DOM 요소 캐시
const labElements = {};

function initializeLabPage() {
    // 랩 컨트롤 요소
    labElements.bgColorPicker = document.getElementById('lab-bg-color');
    labElements.bgHexInput = document.getElementById('lab-bg-hex');
    labElements.textColorPicker = document.getElementById('lab-text-color');
    labElements.textHexInput = document.getElementById('lab-text-hex');
    labElements.primaryColorPicker = document.getElementById('lab-primary-color');
    labElements.primaryHexInput = document.getElementById('lab-primary-hex');
    labElements.aiLabMessageBox = document.getElementById('ai-lab-message-box');
    
    // 일반 프리뷰 요소
    labElements.previewContentNormal = document.getElementById('preview-content-normal');
    labElements.previewButtonNormal = document.getElementById('preview-button-normal');
    labElements.contrastRatioEl = document.getElementById('contrast-ratio');
    labElements.wcagNormalEl = document.getElementById('wcag-badge-normal');
    labElements.wcagLargeEl = document.getElementById('wcag-badge-large');
    
    // [수정] 1-Grid CVD 시뮬레이션 프리뷰 요소
    labElements.previewContentCvd = document.getElementById('preview-content-cvd');
    labElements.previewButtonCvd = document.getElementById('preview-button-cvd');

    // 랩 컨트롤 이벤트 리스너
    const setupColorInput = (picker, hexInput, stateKey) => {
        picker.addEventListener('input', (e) => {
            hexInput.value = e.target.value;
            appState.labColors[stateKey] = e.target.value;
            updateLabPreview();
        });
        hexInput.addEventListener('input', (e) => {
            if (isValidHex(e.target.value)) {
                picker.value = e.target.value;
                appState.labColors[stateKey] = e.target.value;
                updateLabPreview();
            }
        });
    };

    setupColorInput(labElements.bgColorPicker, labElements.bgHexInput, 'bgColor');
    setupColorInput(labElements.textColorPicker, labElements.textHexInput, 'textColor');
    setupColorInput(labElements.primaryColorPicker, labElements.primaryHexInput, 'primaryColor');

    // 'AI 실시간 추천' 버튼
    document.getElementById('get-ai-recommendation-btn').addEventListener('click', getAiLabRecommendation);

    // '리포트 확정' 버튼
    document.getElementById('confirm-and-generate-report-btn').addEventListener('click', confirmAndGenerateReport);
}

// (Tab 2) AI 초안 색상을 랩으로 로드
function loadAiDraftToLab() {
    if (!appState.generatedResult) {
        return; 
    }

    const colors = appState.generatedResult.colorSystem;
    const newBgColor = colors.neutral.lightGray || '#F5F5F5';
    const newTextColor = colors.neutral.darkGray || '#333333';
    const newPrimaryColor = colors.primary.main || '#6666FF';

    // 값 설정
    labElements.bgColorPicker.value = newBgColor;
    labElements.bgHexInput.value = newBgColor;
    labElements.textColorPicker.value = newTextColor;
    labElements.textHexInput.value = newTextColor;
    labElements.primaryColorPicker.value = newPrimaryColor;
    labElements.primaryHexInput.value = newPrimaryColor;

    // 상태 업데이트
    appState.labColors = {
        bgColor: newBgColor,
        textColor: newTextColor,
        primaryColor: newPrimaryColor
    };
    
    // 프리뷰 갱신
    updateLabPreview();

    // 메시지 표시
    labElements.aiLabMessageBox.innerHTML = `<p>AI가 생성한 초안 색상을 불러왔습니다. 검증 후 리포트를 확정해주세요.</p>`;
    labElements.aiLabMessageBox.className = 'ai-recommendation-box';
    labElements.aiLabMessageBox.style.display = 'block';
}

// '리포트 확정' 로직
function confirmAndGenerateReport() {
    if (!appState.generatedResult) {
        labElements.aiLabMessageBox.innerHTML = `<p>오류: 먼저 1단계에서 AI 초안을 생성해야 합니다.</p>`;
        labElements.aiLabMessageBox.className = 'ai-recommendation-box error';
        labElements.aiLabMessageBox.style.display = 'block';
        return;
    }

    reportData = JSON.parse(JSON.stringify(appState.generatedResult));

    reportData.colorSystem.primary.main = appState.labColors.primaryColor;
    reportData.colorSystem.neutral.lightGray = appState.labColors.bgColor;
    reportData.colorSystem.neutral.darkGray = appState.labColors.textColor;
    
    navigateToTab('report-page');
}


// (Tab 2) 'AI 실시간 추천'
async function getAiLabRecommendation() {
    const aiRecommendBtn = document.getElementById('get-ai-recommendation-btn');
    const aiLabMessageBox = labElements.aiLabMessageBox;
    
    const bgColor = appState.labColors.bgColor;
    const textColor = appState.labColors.textColor;

    const btnText = aiRecommendBtn.querySelector('.btn-text');
    const spinner = aiRecommendBtn.querySelector('.spinner');
    btnText.classList.add('hidden');
    spinner.classList.remove('hidden');
    aiRecommendBtn.disabled = true;

    aiLabMessageBox.innerHTML = '<p>AI가 현재 색상 조합을 분석하고 추천하는 중입니다...</p>';
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
            throw new Error(errData.message || `AI 추천 서버 오류`);
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
}


// [수정] 랩 프리뷰 + 1-CVD 시뮬레이션 업데이트
function updateLabPreview() {
    const { bgColor, textColor, primaryColor } = appState.labColors;

    // 1. 일반 시야
    labElements.previewContentNormal.style.backgroundColor = bgColor;
    labElements.previewContentNormal.style.color = textColor;
    labElements.previewButtonNormal.style.backgroundColor = primaryColor;
    const primaryBtnTextColor = getContrastRatio(primaryColor, '#FFFFFF') > 3 ? '#FFFFFF' : '#000000';
    labElements.previewButtonNormal.style.color = primaryBtnTextColor;
    
    // WCAG 계산
    const contrast = getContrastRatio(bgColor, textColor);
    labElements.contrastRatioEl.textContent = `Contrast: ${contrast.toFixed(2)}:1`;
    updateWCAGBadge(labElements.wcagNormalEl, 'AA Normal', contrast, 4.5);
    updateWCAGBadge(labElements.wcagLargeEl, 'AA Large', contrast, 3.0);

    // 2. [수정] CVD 시뮬레이션 (제2색각-Deuteranopia 하나만)
    updateCvdSimulation('deuteranopia', labElements.previewContentCvd, labElements.previewButtonCvd);
}

// CVD 시뮬레이션 헬퍼
function updateCvdSimulation(type, contentEl, buttonEl) {
    const { bgColor, textColor, primaryColor } = appState.labColors;

    const simBg = cvdSimulate(bgColor, type);
    const simText = cvdSimulate(textColor, type);
    const simPrimary = cvdSimulate(primaryColor, type);
    
    contentEl.style.backgroundColor = simBg;
    contentEl.style.color = simText;
    buttonEl.style.backgroundColor = simPrimary;
    
    const simBtnTextColor = getContrastRatio(simPrimary, '#FFFFFF') > 3 ? '#FFFFFF' : '#000000';
    buttonEl.style.color = simBtnTextColor; 
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

// ============================================\n// 4. AI 리포트 페이지 (확정본 표시)
// ============================================\n
function initializeReportPage() {
    // 코드 내보내기 탭
    const codeTabs = document.querySelector('.code-export-tabs');
    codeTabs.addEventListener('click', (e) => {
        if (e.target.classList.contains('export-tab')) {
            codeTabs.querySelectorAll('.export-tab').forEach(tab => tab.classList.remove('active'));
            e.target.classList.add('active');
            currentCodeTab = e.target.dataset.tab;
            updateCodeOutput(reportData); 
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

// 구글 폰트 동적 로드 헬퍼
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


// 리포트 데이터 표시 (확정된 reportData 사용)
function displayReportData(data) {
    const placeholder = document.getElementById('report-placeholder');
    const sections = document.querySelectorAll('.report-section');

    if (!data) {
        placeholder.classList.remove('hidden');
        sections.forEach(s => s.classList.add('hidden'));
        return;
    }

    placeholder.classList.add('hidden');
    sections.forEach(s => s.classList.remove('hidden'));

    // [신규] 리포트 부제목 동적 생성
    const subtitleEl = document.getElementById('report-subtitle');
    if (appState.service) {
        subtitleEl.textContent = `'${appState.service}'을(를) 위한 최종 디자인 시스템 가이드입니다.`;
    } else {
        subtitleEl.textContent = '최종 검증된 디자인 시스템 가이드입니다.';
    }

    // 1. 폰트 페어링 (순서 변경)
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
    }

    // 2. 디자인 근거 (순서 변경)
    const rationaleContainer = document.getElementById('design-rationale');
    if (data.designRationale) {
        rationaleContainer.innerHTML = `
            <p><strong>종합 요약:</strong> ${data.designRationale.summary || '-'}</p>
            <p><strong>색상 선택 이유:</strong> ${data.designRationale.colorChoice || '-'}</p>
            <p><strong>타이포그래피 선택 이유:</strong> ${data.designRationale.typographyChoice || '-'}</p>
        `;
    }

    // 3. 최종 확정된 색상 시스템
    const paletteGrid = document.getElementById('palette-grid');
    paletteGrid.innerHTML = '';
    const finalColors = data.colorSystem;
    
    for (const [category, colors] of Object.entries(finalColors)) {
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

    // 4. AI UX 카피라이팅 + 컴포넌트 (검증된 색상 적용)
    const navList = document.getElementById('nav-preview-list');
    const showcase = document.getElementById('component-showcase');
    const pColor = finalColors.primary.main; // 확정된 주조색
    const pText = getContrastRatio(pColor, '#FFFFFF') > 3 ? '#FFFFFF' : '#000000';

    if (data.uxCopy) {
        navList.innerHTML = data.uxCopy.navigation.map(item => `<li><a href="#">${item}</a></li>`).join('');
        showcase.innerHTML = `
            <button class="preview-btn" style="background-color: ${pColor}; color: ${pText};">${data.uxCopy.ctaButton || 'Primary Button'}</button>
            <button class="preview-btn" style="background-color: ${finalColors.secondary.main}; color: #000000;">${data.uxCopy.navigation[1] || 'Secondary'}</button>
            <div class="preview-card" style="border-top-color: ${pColor};">
                <h3>${data.uxCopy.cardTitle || 'Card Title'}</h3>
                <p>${data.uxCopy.cardBody || 'This is a card component.'}</p>
            </div>
        `;
    }
    
    // 5. 기본 타이포그래피 (순서 변경)
    const typoRules = document.getElementById('typography-rules');
    typoRules.innerHTML = `
        <div class="typo-demo" style="font-family: ${data.typography.fontFamily};">
            <h1 style="font-size: ${data.typography.headlineSize}; line-height: ${data.typography.lineHeight};">기본 헤드라인: ${data.typography.headlineSize}</h1>
            <p style="font-size: ${data.typography.bodySize}; line-height: ${data.typography.lineHeight};">기본 본문: ${data.typography.bodySize}. (줄간격: ${data.typography.lineHeight})</p>
        </div>
        <p class="description" style="margin-top: 15px;">* 이 규칙은 플랫폼 표준이며, 위의 AI 추천 폰트 페어링을 적용하여 사용할 수 있습니다.</p>
    `;
    
    // 6. 플랫폼 가이드라인 (순서 변경)
    const guidelineReportEl = document.getElementById('guideline-content-report');
    const platformKey = appState.platform.toLowerCase(); // (Tab 1)에서 설정한 값
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

    // 7. 코드 내보내기 (순서 변경)
    updateCodeOutput(data); // data는 이미 확정된 reportData임

    // 8. 접근성 분석 리포트 (한글)
    const analysisContainer = document.getElementById('accessibility-analysis');
    analysisContainer.innerHTML = ''; 
    if (data.accessibilityReport) {
        analysisContainer.innerHTML += `<p class="description" style="margin-bottom: 15px;">* 이 분석은 AI 초안 기준입니다. (Tab 2)에서 색상을 수정한 경우, 명도 대비가 달라졌을 수 있습니다.</p>`;
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
    } 
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

// ============================================\n// [복원] CVD (색각 이상) 시뮬레이션
// ============================================\n

// 시뮬레이션 매트릭스
const CVD_SIMULATION_MATRIX = {
    // 제1색각 (적색맹)
    protanopia: [
        0.567, 0.433, 0,
        0.558, 0.442, 0,
        0,     0.242, 0.758
    ],
    // 제2색각 (녹색맹)
    deuteranopia: [
        0.625, 0.375, 0,
        0.7,   0.3,   0,
        0,     0.3,   0.7
    ],
    // 제3색각 (청색맹)
    tritanopia: [
        0.95,  0.05,  0,
        0,     0.433, 0.567,
        0,     0.475, 0.525
    ],
    // 전색맹 (흑백)
    achromatopsia: [
        0.299, 0.587, 0.114,
        0.299, 0.587, 0.114,
        0.299, 0.587, 0.114
    ]
};

// HEX -> RGB (0-255) 변환
function hexToRgbValues(hex) {
    const result = hexToRgb(hex);
    if (!result) return [0, 0, 0];
    return [result.r, result.g, result.b];
}

// RGB (0-255) -> HEX 변환
function rgbToHex(r, g, b) {
    const toHex = (c) => {
        c = Math.round(c); 
        c = Math.max(0, Math.min(255, c)); 
        const hex = c.toString(16);
        return hex.length === 1 ? "0" + hex : hex;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// CVD 시뮬레이션 함수 (sRGB -> LMS -> simLMS -> sRGB)
function cvdSimulate(hex, type) {
    const matrix = CVD_SIMULATION_MATRIX[type];
    if (!matrix) return hex;

    const [r, g, b] = hexToRgbValues(hex);

    const r_lin = Math.pow(r / 255, 2.2);
    const g_lin = Math.pow(g / 255, 2.2);
    const b_lin = Math.pow(b / 255, 2.2);

    const l = (r_lin * 0.7328) + (g_lin * 0.4296) + (b_lin * -0.1624);
    const m = (r_lin * 0.7036) + (g_lin * 1.6975) + (b_lin * 0.0061);
    const s = (r_lin * 0.0030) + (g_lin * 0.0136) + (b_lin * 0.9834);

    const l_sim = (l * matrix[0]) + (m * matrix[1]) + (s * matrix[2]);
    const m_sim = (l * matrix[3]) + (m * matrix[4]) + (s * matrix[5]);
    const s_sim = (l * matrix[6]) + (m * matrix[7]) + (s * matrix[8]);

    const r_sim_lin = (l_sim * 1.0961)  + (m_sim * -0.2789) + (s_sim * 0.1828);
    const g_sim_lin = (l_sim * -0.4543) + (m_sim * 0.4720)  + (s_sim * -0.0177);
    const b_sim_lin = (l_sim * -0.0096) + (m_sim * -0.0057) + (s_sim * 1.0153);

    const r_sim = Math.pow(Math.max(0, r_sim_lin), 1 / 2.2) * 255;
    const g_sim = Math.pow(Math.max(0, g_sim_lin), 1 / 2.2) * 255;
    const b_sim = Math.pow(Math.max(0, b_sim_lin), 1 / 2.2) * 255;

    return rgbToHex(r_sim, g_sim, b_sim);
}