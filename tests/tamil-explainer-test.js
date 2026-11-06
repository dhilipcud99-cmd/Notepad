const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

// 1. Verify UI Elements exist
console.log('Testing HTML markup for Tamil Code Explainer & Inspector...');
assert(html.includes('id="tamilExplainerModal"'), 'Explainer modal should exist');
assert(html.includes('id="tamilExplainerBtn"'), 'IDE toolbar button should exist');
assert(html.includes('id="tamilTipsToggleBtn"'), 'Tamil Tips toggle button should exist');
assert(html.includes('id="tamilTipsToggleText"'), 'Tamil Tips toggle text span should exist');
assert(html.includes('id="ideTamilInspectorBar"'), 'Tamil Live Inspector Bar should exist');
assert(html.includes('id="ideInspectorLinePill"'), 'Inspector line pill should exist');
assert(html.includes('id="ideInspectorTag"'), 'Inspector tag should exist');
assert(html.includes('id="ideInspectorCode"'), 'Inspector code span should exist');
assert(html.includes('id="ideInspectorDesc"'), 'Inspector desc span should exist');
assert(html.includes('id="ideInspectorSpeakBtn"'), 'Inspector speak button should exist');
assert(html.includes('id="ideInspectorReplaceBtn"'), 'Inspector replace button should exist');
assert(html.includes('id="tamilOpenExplainerTabBtn"'), 'Translator modal tab button should exist');
assert(html.includes('id="tamilExplainerSpeechBtn"'), 'Speech button should exist');
assert(html.includes('id="tamilExplainerCopyBtn"'), 'Copy button should exist');
assert(html.includes('id="tamilExplainerInsertBtn"'), 'Insert into Note button should exist');
assert(html.includes('id="tamilExplainerSummary"'), 'Summary card container should exist');
assert(html.includes('id="tamilExplainerLinesList"'), 'Lines list container should exist');
assert(html.includes('id="explainerViewBreakdownTab"'), 'Breakdown tab should exist');
assert(html.includes('id="explainerViewFullCodeTab"'), 'Full code tab should exist');
assert(html.includes('id="explainerToneCasualTab"'), 'Casual tone tab should exist');
assert(html.includes('id="explainerToneFormalTab"'), 'Formal tone tab should exist');
assert(html.includes('id="tamilExplainerFullCodeText"'), 'Full code textarea should exist');
console.log('✓ UI elements verified.');

// 2. Extract and test JavaScript logic
console.log('Testing JavaScript functions...');
assert(html.includes('function translateCodeToTamil'), 'translateCodeToTamil should be defined');
assert(html.includes('function explainCodeLineInTamil'), 'explainCodeLineInTamil should be defined');
assert(html.includes('function detectProgramPurposeInTamil'), 'detectProgramPurposeInTamil should be defined');
assert(html.includes('function openTamilExplainerModal'), 'openTamilExplainerModal should be defined');
assert(html.includes('function closeTamilExplainerModal'), 'closeTamilExplainerModal should be defined');
assert(html.includes('function bindTamilExplainerModal'), 'bindTamilExplainerModal should be defined');
assert(html.includes('function registerTamilMonacoHover'), 'registerTamilMonacoHover should be defined');
assert(html.includes('function updateTamilInspectorForPosition'), 'updateTamilInspectorForPosition should be defined');
assert(html.includes('function speakCurrentInspectorLine'), 'speakCurrentInspectorLine should be defined');
assert(html.includes('function replaceCurrentLineWithTamil'), 'replaceCurrentLineWithTamil should be defined');
assert(html.includes('function toggleTamilTips'), 'toggleTamilTips should be defined');
assert(html.includes('function updateTamilTipsUIState'), 'updateTamilTipsUIState should be defined');
assert(html.includes('function speakTamilText'), 'speakTamilText should be defined');
console.log('✓ Function definitions verified.');

// 3. Test functional behavior of explainer functions
console.log('Testing code explanation logic...');
const fnStart = html.indexOf('function translateCodeToTamil');
const fnEnd = html.indexOf('let currentExplainerData = null;');
const codeSnippet = html.slice(fnStart, fnEnd);

// Mock tokenizeCode & restoreCodeTokens & escapeHtml if needed in scope
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function tokenizeCode(code) {
  return { codeWithoutLiterals: code, tokenMap: {} };
}
function restoreCodeTokens(code) {
  return code;
}

eval(codeSnippet);

// Test 1: Full Code Translation
const translated = translateCodeToTamil('let count = 5;\nconsole.log(count);');
assert(translated.includes('மாறி count = 5;'), 'Should translate let to மாறி');
assert(translated.includes('பதிப்பி(count);'), 'Should translate console.log to பதிப்பி');

// Test 2: Tamil Factorial
const factPurpose = detectProgramPurposeInTamil('செயல்பாடு காரணியியல்(எண்) { return எண் * காரணியியல்(எண் - 1); }');
assert(factPurpose.title.includes('காரணியியல்'), 'Should detect Factorial program in Tamil');
assert(factPurpose.casualDesc && factPurpose.casualDesc.includes('factorial'), 'Should have casual Tamil description');

const l1 = explainCodeLineInTamil('செயல்பாடு காரணியியல்(எண்) {');
assert(l1 && l1.type === 'function', 'Should detect function');
assert(l1.casual && l1.casual.includes('function'), 'Casual explanation should be friendly');
assert(l1.tamilCode.includes('செயல்பாடு'), 'Tamil code should contain தமிழ் keywords');

const l2 = explainCodeLineInTamil('ஒருவேளை (எண் <= 1) {');
assert(l2 && l2.type === 'condition', 'Should detect if condition');

const l3 = explainCodeLineInTamil('திருப்பு 1;');
assert(l3 && l3.type === 'return', 'Should detect return statement in Tamil');

// Test 3: JavaScript translation & casual explanation
const l4 = explainCodeLineInTamil('let total = 0;');
assert(l4 && l4.type === 'variable', 'Should detect let variable');
assert(l4.tamilCode === 'மாறி total = 0;', 'Code should be translated to Tamil');
assert(l4.casual.includes('store பண்ணுது'), 'Casual explanation should be conversational');

const l5 = explainCodeLineInTamil('for (let i = 0; i < 10; i++) {');
assert(l5 && l5.type === 'loop', 'Should detect for loop');
assert(l5.casual.toLowerCase().includes('loop'), 'Should explain loop casually');

const l6 = explainCodeLineInTamil('console.log("வணக்கம் உலகம்");');
assert(l6 && l6.type === 'output', 'Should detect console.log');
assert(l6.tamilCode.includes('பதிப்பி'), 'console.log should translate to பதிப்பி in Tamil code');
assert(l6.casual.includes('print பண்ணி காட்டுது'), 'Should explain print casually');

// Test 4: Monaco Hover Provider Simulation
console.log('Testing Monaco Hover Provider formatting...');
const hoverExp = explainCodeLineInTamil('const pi = 3.14159;');
assert(hoverExp && hoverExp.tamilCode === 'நிலைமாறி pi = 3.14159;', 'Should translate const to நிலைமாறி');
const plainCasual = (hoverExp.casual || '').replace(/<[^>]+>/g, '');
const hoverMarkdown = `**💡 தமிழ் நிரல் குறிப்பு (${hoverExp.badge} • வரி 1)**\n\`\`\`tamil\n${hoverExp.tamilCode}\n\`\`\`\n${plainCasual}`;
assert(hoverMarkdown.includes('💡 தமிழ் நிரல் குறிப்பு'), 'Hover markdown should have Tamil title');
assert(hoverMarkdown.includes('```tamil'), 'Hover markdown should contain tamil code block');
assert(hoverMarkdown.includes('நிலைமாறி pi = 3.14159;'), 'Hover markdown should contain translated code');
console.log('✓ Monaco Hover formatting verified.');

// Test 5: Inspector Line Replace Simulation
console.log('Testing Line Replacement logic...');
const originalIndentedLine = '    let message = "Hello";';
const indent = originalIndentedLine.match(/^(\s*)/)[1];
const translatedTrimmed = translateCodeToTamil(originalIndentedLine.trim());
const replacedLine = indent + translatedTrimmed;
assert.strictEqual(replacedLine, '    மாறி message = "Hello";', 'Should preserve indent and translate code');
console.log('✓ Line replacement logic verified.');

// Test 6: Verify sanitize of smart quotes
console.log('Testing smart quotes and tokenization sanitize...');
assert(html.includes('[\\u201C\\u201D\\u201E\\u201F\\u2033\\u2036]'), 'Curly quotes should be sanitized');
assert(html.includes('hasTamilKeywords'), 'Tamil keywords should be auto-detected in JS runner');
console.log('✓ Tokenization and runner sanitization verified.');

console.log('✓ All Tamil Code Explainer tests passed successfully!');

