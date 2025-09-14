// ===== CẤU HÌNH =====
const SHEET_API = 'https://script.google.com/macros/s/AKfycbzMljRGk-6Eeeu-qfUsc1xIZzwyEv04pvKBaa0j8OCbZSOyq-PXW9d50ldGHEtRnqsC4w/exec'; // URL /exec
const BANKS_FOLDER_ID = '1_-YhEHfYfF957yC6o-xyiPk06XRheKb6'; // thư mục chứa .xlsx hoặc Google Sheets
const TOTAL_QUESTIONS = 30;
const DURATION_MINUTES = 30;

// ===== TRẠNG THÁI =====
let questions = [];
let selections = {};
let currentIndex = 0;
let timer, remainingSeconds;
let submitted = false;

// ===== HỖ TRỢ =====
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]];} return a; }
function pickRandom(a,n){ const cp=a.slice(); shuffle(cp); return cp.slice(0,Math.min(n,cp.length)); }
function pad(n){ return n<10? '0'+n : ''+n; }

// Liệt kê bộ đề
async function loadBanks(){
  const sel = document.getElementById('bankSelect');
  if (!sel || !BANKS_FOLDER_ID) return null;
  try{
    const url = `${SHEET_API}?action=listBanks&folderId=${encodeURIComponent(BANKS_FOLDER_ID)}`;
    const res = await fetch(url, { cache:'no-store' });
    const data = await res.json();
    const banks = Array.isArray(data.banks) ? data.banks : [];
    if (!banks.length){ sel.innerHTML='<option value="">(Chưa có bộ đề)</option>'; return null; }
    sel.innerHTML = banks.map(b => `<option value="${b.id}" data-type="${b.type}">${b.title} ${b.type==='xlsx'?'(Excel)':''}</option>`).join('');
    return banks;
  }catch(_){
    sel.innerHTML='<option value="">(Không tải được bộ đề)</option>'; return null;
  }
}

// Tải câu hỏi theo loại file
async function loadQuestionsByBank(id, type){
  const url = type==='xlsx'
    ? `${SHEET_API}?action=questionsXlsx&fileId=${encodeURIComponent(id)}`
    : `${SHEET_API}?action=questions&sheetId=${encodeURIComponent(id)}`;
  const res = await fetch(url, { cache:'no-store' });
  const data = await res.json();
  const bank = Array.isArray(data.questions) ? data.questions : [];
  if (!bank.length) throw new Error('Không có câu hỏi trong file.');
  questions = pickRandom(bank, TOTAL_QUESTIONS);
  document.getElementById('progress').textContent = `0/${questions.length}`;
}

// ===== RENDER / TIMER (giữ y nguyên bản trước) =====
function renderQuestion(){ /* ... giữ nguyên phần render ... */ }
function startTimer(){ /* ... giữ nguyên ... */ }
function classify(s,t){ const r=s/t; if(r>=0.9) return 'Giỏi'; if(r>=0.8) return 'Khá'; if(r>=0.6) return 'Đạt yêu cầu'; return 'Chưa đạt'; }

// ===== MAIN (chỉ chạy ở quiz.html) =====
window.addEventListener('DOMContentLoaded', async () => {
  const isQuiz = document.getElementById('quizBox') && document.getElementById('startBtn'); 
  if (!isQuiz) return;

  await loadBanks();

  const startBtn = document.getElementById('startBtn');
  const startCard= document.getElementById('startCard');
  const quizBox  = document.getElementById('quizBox');
  const resultCard=document.getElementById('resultCard');

  startBtn.addEventListener('click', async () => {
    const name=document.getElementById('fullname').value.trim();
    const unit=document.getElementById('unit').value.trim();
    const position=document.getElementById('position').value.trim();
    if(!name || !unit || !position){ alert('Nhập Họ tên, Đơn vị, Chức vụ.'); return; }

    const sel = document.getElementById('bankSelect');
    const bankId = sel?.value || '';
    const bankType = sel?.selectedOptions?.[0]?.dataset?.type || 'gsheet';

    try{
      if (bankId) await loadQuestionsByBank(bankId, bankType);
      else throw new Error('Chưa chọn bộ đề.');
    }catch(e){ alert(e.message || 'Lỗi tải câu hỏi'); return; }

    startCard.hidden=true; quizBox.hidden=false;
    renderQuestion(); startTimer();
  });

  // ... giữ nguyên phần Next/Prev/Submit như bản trước ...
});

