import React, { useState } from 'react';

const tiers = [
  { name: 'SAR', prob: 1, colorClass: 'text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-pink-400 to-purple-500 drop-shadow-[0_0_10px_rgba(255,105,180,0.8)]' },
  { name: 'UR', prob: 3, colorClass: 'text-yellow-400 drop-shadow-[0_0_12px_rgba(250,204,21,0.9)]' },
  { name: 'SR', prob: 10, colorClass: 'text-slate-200 drop-shadow-[0_0_8px_rgba(226,232,240,0.6)]' },
  { name: 'AR or ACE', prob: 10, colorClass: 'text-orange-300' },
  { name: 'RRR', prob: 20, colorClass: 'text-purple-400' },
  { name: 'RR', prob: 30, colorClass: 'text-blue-400' },
  { name: 'C or U', prob: 10, colorClass: 'text-green-400' },
  { name: '프로모카드팩', prob: 1, colorClass: 'text-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.5)]' },
  { name: '꽝', prob: 15, colorClass: 'text-stone-600' }
];

const API_URL = '/api';

function App() {
  const [isDrawing, setIsDrawing] = useState(false);
  const [result, setResult] = React.useState(() => {
    const saved = sessionStorage.getItem('gachaResult');
    return saved ? JSON.parse(saved) : null;
  });

  React.useEffect(() => {
    if (result) {
      sessionStorage.setItem('gachaResult', JSON.stringify(result));
    } else {
      sessionStorage.removeItem('gachaResult');
    }
  }, [result]);

  // User state
  const [loggedInUser, setLoggedInUser] = React.useState(() => {
    const saved = sessionStorage.getItem('loggedInUser');
    return saved ? JSON.parse(saved) : null;
  });

  // Inventory state
  const [inventory, setInventory] = useState({});

  const fetchInventory = async () => {
    try {
      const res = await fetch(`${API_URL}/inventory`);
      const data = await res.json();
      setInventory(data);
    } catch (error) {
      console.error("Failed to fetch inventory:", error);
    }
  };

  React.useEffect(() => {
    fetchInventory();
  }, []);

  React.useEffect(() => {
    if (loggedInUser) {
      sessionStorage.setItem('loggedInUser', JSON.stringify(loggedInUser));
    } else {
      sessionStorage.removeItem('loggedInUser');
    }
  }, [loggedInUser]);

  // Modal states
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isMyInfoModalOpen, setIsMyInfoModalOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isInventoryModalOpen, setIsInventoryModalOpen] = useState(false);
  const [isGameInfoModalOpen, setIsGameInfoModalOpen] = useState(false);
  const [privacyAgreed, setPrivacyAgreed] = useState(false);
  const [authTab, setAuthTab] = useState('login'); // 'login' | 'signup'

  // Form states
  const [authForm, setAuthForm] = useState({ id: '', pw: '', name: '', contact: '', address: '' });
  const [adminForm, setAdminForm] = useState({ targetId: '', amount: '' });
  const [adminInventoryForm, setAdminInventoryForm] = useState({}); // To edit stock in admin modal

  // Coin Polling
  React.useEffect(() => {
    if (!loggedInUser) return;

    const pollCoins = async () => {
      try {
        const res = await fetch(`${API_URL}/user/status/${loggedInUser.id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.coins !== loggedInUser.coins) {
            setLoggedInUser(prev => ({ ...prev, coins: data.coins }));
          }
        }
      } catch (error) {
        console.error("Polling failed:", error);
      }
    };

    const interval = setInterval(pollCoins, 3000); // 3 seconds
    return () => clearInterval(interval);
  }, [loggedInUser, API_URL]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setAuthForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleDraw = async () => {
    if (isDrawing) return;

    if (!loggedInUser) {
      alert("로그인 후 이용할 수 있습니다.");
      return;
    }

    if (loggedInUser.coins <= 0) {
      alert("코인이 부족합니다. 입금 후 계좌로 충전해주세요.");
      return;
    }

    setIsDrawing(true);
    // setResult(null); // Removed: Keep previous result visible

    // Simulate drawing animation time
    setTimeout(async () => {
      const rand = Math.random() * 100;
      let cumulative = 0;
      let selectedTier = tiers[tiers.length - 1]; // Default to '꽝'

      for (const tier of tiers) {
        cumulative += tier.prob;
        if (rand <= cumulative) {
          selectedTier = tier;
          break;
        }
      }

      setResult(selectedTier);
      setIsDrawing(false);

      // Save result if logged in
      if (loggedInUser) {
        try {
          const res = await fetch(`${API_URL}/gacha`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: loggedInUser.id, gradeName: selectedTier.name })
          });
          if (res.ok) {
            const data = await res.json();
            setLoggedInUser(data.user); // Update local user state with new history and deducted coins
            fetchInventory(); // Refresh inventory after draw
          } else {
            const data = await res.json();
            alert(data.error || "뽑기 처리 중 오류가 발생했습니다.");
          }
        } catch (error) {
          console.error("Failed to save gacha result:", error);
        }
      }

    }, 1500); // 1.5 seconds of suspense
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    const endpoint = authTab === 'login' ? `${API_URL}/login` : `${API_URL}/signup`;

    if (authTab === 'signup' && !privacyAgreed) {
      alert("개인정보 수집 및 이용에 동의해야 가입이 가능합니다.");
      return;
    }

    // Trim ID for robustness
    const normalizedForm = {
      ...authForm,
      id: (authForm.id || "").trim().toLowerCase()
    };

    try {
      console.log(`Sending ${authTab} request to ${endpoint}...`);
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(normalizedForm)
      });

      const data = await res.json();

      if (!res.ok) {
        console.error(`${authTab} failed:`, data.error || 'Unknown error');
        alert(data.error || '오류가 발생했습니다.');
        return;
      }

      console.log(`${authTab} successful:`, data.message);
      alert(data.message);
      setLoggedInUser(data.user);
      setIsAuthModalOpen(false);
      setPrivacyAgreed(false);

      // Reset form
      setAuthForm({ id: '', pw: '', name: '', contact: '', address: '' });

    } catch (error) {
      console.error(`${authTab} connection error:`, error);
      alert("서버 통신 중 오류가 발생했습니다. 네트워크 상태를 확인해주세요.");
    }
  };

  const handleAdminAddCoins = async (e) => {
    e.preventDefault();
    console.log("Admin recharging coins for:", adminForm.targetId, "Amount:", adminForm.amount);
    try {
      const res = await fetch(`${API_URL}/admin/add-coins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: adminForm.targetId, amount: adminForm.amount })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        setAdminForm({ targetId: '', amount: '' });
        setIsAdminModalOpen(false);

        // If the admin recharged themselves, update their local state
        const targetId = (adminForm.targetId || "").trim().toLowerCase();
        if (loggedInUser && (loggedInUser.id || "").toLowerCase() === targetId) {
          setLoggedInUser(prev => ({ ...prev, coins: data.coins }));
        }
      } else {
        alert(data.error);
      }
    } catch (error) {
      alert("통신 중 오류가 발생했습니다.");
    }
  };

  const handleAdminUpdateInventory = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/admin/update-inventory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inventory: adminInventoryForm })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        setInventory(data.inventory);
      } else {
        alert(data.error);
      }
    } catch (error) {
      alert("통신 중 오류가 발생했습니다.");
    }
  };

  const handleLogout = () => {
    setLoggedInUser(null);
    alert('로그아웃 되었습니다.');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden">

      {/* Background decorations */}
      <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] rounded-full bg-blue-500/10 blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-red-500/10 blur-[100px] pointer-events-none"></div>

      {/* Top Header Buttons */}
      <header className="absolute top-0 left-0 w-full p-4 lg:p-6 flex justify-between items-center z-40 bg-gradient-to-b from-black/50 to-transparent">

        {/* Top Left: My Info & Coins (Only show if logged in) */}
        <div className="flex-1 flex gap-3 items-center">
          {loggedInUser && (
            <>
              <button
                onClick={() => setIsMyInfoModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 transition-colors backdrop-blur-md text-sm font-semibold"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
                내정보 ({loggedInUser.name})
              </button>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-400/10 border border-yellow-400/20 backdrop-blur-md text-sm font-bold text-yellow-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.069.34-.433.582a2.305 2.305 0 01-.567.267z" />
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                </svg>
                {loggedInUser.coins || 0} 코인
              </div>
            </>
          )}
        </div>

        {/* Floating Left: Game Info Button */}
        <div className="fixed left-6 top-1/2 transform -translate-y-1/2 flex flex-col gap-4 z-40">
          <button
            onClick={() => setIsGameInfoModalOpen(true)}
            className="group relative flex flex-col items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-[0_0_20px_rgba(16,185,129,0.4)] border border-emerald-400/30 transition-all duration-300 hover:scale-110 active:scale-95"
          >
            <div className="absolute inset-0 rounded-2xl bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-[11px] font-black text-white uppercase tracking-tighter">게임설명</span>
          </button>
        </div>

        {/* Floating Right: Inventory Button */}
        <div className="fixed right-6 top-1/2 transform -translate-y-1/2 flex flex-col gap-4 z-40">
          <button
            onClick={() => setIsInventoryModalOpen(true)}
            className="group relative flex flex-col items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 shadow-[0_0_20px_rgba(139,92,246,0.4)] border border-purple-400/30 transition-all duration-300 hover:scale-110 active:scale-95"
          >
            <div className="absolute inset-0 rounded-2xl bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <span className="text-[11px] font-black text-white uppercase tracking-tighter">카드재고</span>
          </button>
        </div>

        {/* Top Right: Account & Auth */}
        <div className="flex justify-end gap-4 flex-wrap">
          <button
            onClick={() => setIsAccountModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 transition-colors backdrop-blur-md text-sm font-semibold"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
              <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
              <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
            </svg>
            입금 계좌
          </button>

          {loggedInUser && loggedInUser.id === 'kgbdong123' && (
            <button
              onClick={() => setIsAdminModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-300 transition-colors backdrop-blur-md text-sm font-bold"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
              </svg>
              관리자
            </button>
          )}

          {loggedInUser ? (
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 transition-colors backdrop-blur-md text-sm font-semibold"
            >
              로그아웃
            </button>
          ) : (
            <button
              onClick={() => { setAuthTab('login'); setIsAuthModalOpen(true); }}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 transition-colors backdrop-blur-md text-sm font-semibold"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
              로그인 / 회원가입
            </button>
          )}
        </div>
      </header>

      <main className="z-10 flex flex-col lg:flex-row items-center lg:items-center justify-center w-full max-w-6xl px-4 mt-20 pb-12 gap-8 lg:gap-16">

        {/* Operation Hours Info */}
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 text-center z-20 w-full pointer-events-none">
          <div className="inline-block px-12 py-5 rounded-b-[2rem] bg-black border-x border-b border-yellow-400/20 shadow-[0_15px_60px_rgba(0,0,0,1)]">
            <p className="text-[#ffde00] font-black text-2xl md:text-3xl drop-shadow-[0_4px_8px_rgba(0,0,0,1)] tracking-tighter">
              🕒 뽑기 운영시간 : 오전 10시 ~ 오후 10시
            </p>
            <p className="text-gray-200 text-sm md:text-base font-extrabold mt-2 drop-shadow-md">
              <span className="text-red-500">※</span> 운영시간 내에만 입금 확인 및 코인 충전이 가능합니다.
            </p>
          </div>
        </div>

        {/* Left Sidebar: Probability Table */}
        <aside className="glass rounded-3xl p-6 w-full max-w-sm lg:w-80 shadow-2xl shrink-0 z-10">
          <div className="flex items-center justify-center gap-2 mb-6 text-[#ffde00]">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <h2 className="text-2xl font-bold tracking-wide">확률표</h2>
          </div>
          <div className="flex flex-col gap-2">
            {tiers.map((tier) => (
              <div key={tier.name} className="flex justify-between items-center p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors border border-white/5">
                <span className={`font-extrabold text-lg ${tier.colorClass}`}>{tier.name}</span>
                <span className="text-gray-300 font-mono tracking-wider">{tier.prob}%</span>
              </div>
            ))}
          </div>
        </aside>

        {/* Right Main area: The Gacha Card */}
        <section className="flex-1 w-full max-w-lg flex flex-col items-center">

          {/* Logo / Header Area */}
          <div className="mb-8 animate-float hidden lg:block">
            <div className="text-center">
              <h2 className="text-2xl md:text-3xl font-bold tracking-widest text-[#ffde00] uppercase mb-2 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
                Poketmon
              </h2>
              <div className="h-1 w-24 bg-gradient-to-r from-transparent via-[#ffde00] to-transparent mx-auto"></div>
            </div>
          </div>

          {/* Main Card */}
          <div className="glass rounded-3xl p-8 md:p-14 w-full text-center shadow-2xl relative">

            <div className="h-44 flex flex-col items-center justify-center mb-4">
              {isDrawing ? (
                <div className={`flex justify-center animate-shake`}>
                  {/* Pokeball icon placeholder */}
                  <div className={`w-32 h-32 rounded-full bg-gradient-to-br from-red-500 to-white/90 border-4 border-gray-800 flex items-center justify-center relative shadow-lg transition-transform duration-300 scale-110 shadow-red-500/50`}>
                    <div className="w-full h-1.5 bg-gray-800 absolute top-1/2 left-0 transform -translate-y-1/2"></div>
                    <div className="w-10 h-10 rounded-full bg-white border-4 border-gray-800 z-10 flex items-center justify-center">
                      <div className={`w-4 h-4 rounded-full border-2 border-gray-800 bg-red-500 animate-ping`}></div>
                    </div>
                  </div>
                </div>
              ) : result ? (
                <div className="animate-bounce-in flex flex-col items-center">
                  <div className="text-xl text-gray-400 mb-2">결과</div>
                  <div className={`text-6xl md:text-8xl font-black ${result.colorClass}`}>
                    {result.name}
                  </div>
                  {result.name === '꽝' && (
                    <div className="text-gray-400 mt-2 text-sm">다음에 다시 도전하세요...</div>
                  )}
                </div>
              ) : (
                <div className="flex justify-center">
                  {/* Default Pokeball state before any draw */}
                  <div className="w-32 h-32 rounded-full bg-gradient-to-br from-red-500 to-white/90 border-4 border-gray-800 flex items-center justify-center relative shadow-lg">
                    <div className="w-full h-1.5 bg-gray-800 absolute top-1/2 left-0 transform -translate-y-1/2"></div>
                    <div className="w-10 h-10 rounded-full bg-white border-4 border-gray-800 z-10 flex items-center justify-center">
                      <div className="w-4 h-4 rounded-full border-2 border-gray-800 bg-white"></div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <h1 className="text-3xl md:text-4xl font-extrabold mb-4 mt-2 bg-clip-text text-transparent bg-gradient-to-b from-white to-gray-400 leading-tight">
              포켓몬 뽑기
            </h1>

            <p className="text-gray-300 mb-6 text-md md:text-lg font-light h-14">
              {isDrawing
                ? "두구두구두구... 과연 결과는?!"
                : "당신의 운을 시험해 보세요!\n과연 어떤 포켓몬이 등장할까요?"}
            </p>

            {!loggedInUser ? (
              <p className="text-sm text-yellow-400/80 mb-4 font-semibold animate-pulse">
                ※ 로그인을 해야 뽑기를 진행할 수 있습니다.
              </p>
            ) : ((!isDrawing &&
              <p className="text-sm text-yellow-400/80 mb-4 font-semibold animate-pulse">
                ※ 1회 뽑기당 1코인이 차감됩니다. (보유: {loggedInUser.coins || 0} 코인)
              </p>
            ))}

            <button
              onClick={handleDraw}
              disabled={isDrawing}
              className={`relative group overflow-hidden w-full max-w-[280px] rounded-full font-bold text-xl px-12 py-4 text-gray-900 transition-all duration-300 
                ${isDrawing
                  ? 'bg-gray-400 scale-95 cursor-not-allowed opacity-80'
                  : 'bg-gradient-to-r from-[#ffde00] to-[#b3a125] hover:scale-105 active:scale-95 animate-pulse-glow hover:shadow-[0_0_20px_rgba(255,222,0,0.6)]'
                }`}
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                {!isDrawing && (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                {isDrawing ? '뽑는 중...' : '뽑기 시작'}
              </span>
              {!isDrawing && <div className="absolute inset-0 h-full w-full scale-0 rounded-full transition-all duration-300 group-hover:scale-100 group-hover:bg-white/20"></div>}
            </button>

          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="absolute bottom-6 text-gray-500 text-sm font-light">
        © {new Date().getFullYear()} Poketmon Gacha Project. All rights reserved.
      </footer>

      {/* Account Info Modal */}
      {isAccountModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-pulse-glow" style={{ animation: 'none' }}>
          <div className="glass bg-[#1a1a24] rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-white/10 animate-bounce-in relative">
            <button
              onClick={() => setIsAccountModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-yellow-400/20 text-yellow-400 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">입금 계좌 안내</h3>
              <p className="text-gray-400 text-sm">아래 계좌로 입금해 주시면 확인 후<br />포인트를 충전해 드립니다.</p>
            </div>

            <div className="bg-black/30 rounded-xl p-4 text-center border border-white/5 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
              <div className="text-sm text-yellow-500 font-semibold mb-1">카카오뱅크</div>
              <div className="text-xl font-mono tracking-wider font-bold text-white mb-1 select-all">
                3333-07-806-9337
              </div>
              <div className="text-gray-400 text-sm">예금주: 양형규</div>
            </div>

            <button
              onClick={() => setIsAccountModalOpen(false)}
              className="w-full mt-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* Auth Modal */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" style={{ animation: 'none' }}>
          <div className="glass bg-[#1a1a24] rounded-2xl p-6 md:p-8 w-full max-w-md shadow-2xl border border-white/10 animate-bounce-in relative">
            <button
              onClick={() => setIsAuthModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="flex border-b border-white/10 mb-6 mt-2">
              <button
                className={`flex-1 pb-3 text-center font-semibold transition-colors ${authTab === 'login' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-white'}`}
                onClick={() => setAuthTab('login')}
              >
                로그인
              </button>
              <button
                className={`flex-1 pb-3 text-center font-semibold transition-colors ${authTab === 'signup' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-white'}`}
                onClick={() => setAuthTab('signup')}
              >
                회원가입
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} className="flex flex-col gap-4">
              {authTab === 'login' ? (
                <>
                  <div>
                    <label className="block text-gray-400 text-sm mb-1 ml-1 text-left">아이디</label>
                    <input name="id" value={authForm.id} onChange={handleInputChange} required type="text" className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-400 transition-colors" placeholder="아이디를 입력하세요" />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-sm mb-1 ml-1 text-left">비밀번호</label>
                    <input name="pw" value={authForm.pw} onChange={handleInputChange} required type="password" className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-400 transition-colors" placeholder="비밀번호를 입력하세요" />
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="block text-gray-400 text-sm mb-1 ml-1 text-left">아이디</label>
                      <input name="id" value={authForm.id} onChange={handleInputChange} required type="text" className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-400 transition-colors" placeholder="사용할 아이디" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-gray-400 text-sm mb-1 ml-1 text-left">비밀번호</label>
                      <input name="pw" value={authForm.pw} onChange={handleInputChange} required type="password" className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-400 transition-colors" placeholder="비밀번호" />
                    </div>
                    <div className="col-span-1">
                      <label className="block text-gray-400 text-sm mb-1 ml-1 text-left">이름</label>
                      <input name="name" value={authForm.name} onChange={handleInputChange} required type="text" className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-400 transition-colors" placeholder="실명" />
                    </div>
                    <div className="col-span-1">
                      <label className="block text-gray-400 text-sm mb-1 ml-1 text-left">연락처</label>
                      <input name="contact" value={authForm.contact} onChange={handleInputChange} required type="tel" className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-400 transition-colors" placeholder="010-0000-0000" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-gray-400 text-sm mb-1 ml-1 text-left">주소</label>
                      <input name="address" value={authForm.address} onChange={handleInputChange} required type="text" className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-400 transition-colors" placeholder="기본 주소" />
                    </div>
                  </div>

                  {/* Privacy Policy Summary & Checkbox */}
                  <div className="mt-2 p-3 rounded-xl bg-black/40 border border-white/5 text-left">
                    <h4 className="text-[11px] font-bold text-gray-400 mb-2">[개인정보 수집 및 이용 안내]</h4>
                    <div className="text-[10px] text-gray-500 leading-relaxed mb-3 space-y-1">
                      <p>1. 수집항목: 아이디, 비밀번호, 이름, 연락처, 주소</p>
                      <p>2. 수집목적: 회원 식별 및 포키사이트 서비스 이용</p>
                      <p>3. 보유기간: 회원 탈퇴 시까지 (관계 법령에 따라 보존 필요 시 해당 기간까지)</p>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={privacyAgreed}
                        onChange={(e) => setPrivacyAgreed(e.target.checked)}
                        className="w-4 h-4 rounded border-white/10 bg-black/30 text-blue-500 focus:ring-0 focus:ring-offset-0"
                      />
                      <span className="text-xs text-gray-300 group-hover:text-white transition-colors select-none">개인정보 수집 및 이용에 동의합니다. (필수)</span>
                    </label>
                  </div>
                </>
              )}

              <button
                type="submit"
                className="w-full mt-4 py-3 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold transition-colors shadow-lg shadow-blue-500/20"
              >
                {authTab === 'login' ? '로그인' : '회원가입 완료'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* My Info Modal */}
      {isMyInfoModalOpen && loggedInUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" style={{ animation: 'none' }}>
          <div className="glass bg-[#1a1a24] rounded-2xl p-6 md:p-8 w-full max-w-lg shadow-2xl border border-white/10 animate-bounce-in relative max-h-[90vh] flex flex-col">
            <button
              onClick={() => setIsMyInfoModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="flex items-center gap-3 mb-6 border-b border-white/10 pb-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center text-xl font-bold text-white shadow-lg">
                {loggedInUser.name?.[0] || '?'}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">내 정보</h2>
                <p className="text-sm text-gray-400">@{loggedInUser.id}</p>
              </div>
            </div>

            <div className="overflow-y-auto pr-2 custom-scrollbar">
              <div className="bg-black/20 rounded-xl p-4 mb-6 border border-white/5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:justify-between items-start sm:items-center">
                  <span className="text-gray-400 text-sm">보유 코인</span>
                  <span className="text-yellow-400 font-bold font-mono text-lg">{loggedInUser.coins || 0}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between items-start sm:items-center">
                  <span className="text-gray-400 text-sm">가입일</span>
                  <span className="text-white font-mono">{new Date(loggedInUser.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between items-start sm:items-center">
                  <span className="text-gray-400 text-sm">연락처</span>
                  <span className="text-white font-mono">{loggedInUser.contact}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between items-start sm:items-center">
                  <span className="text-gray-400 text-sm">배송지</span>
                  <span className="text-white text-right break-all">{loggedInUser.address}</span>
                </div>
              </div>

              <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 2a4 4 0 00-4 4v1H5a1 1 0 00-.994.89l-1 9A1 1 0 004 18h12a1 1 0 00.994-1.11l-1-9A1 1 0 0015 7h-1V6a4 4 0 00-4-4zm2 5V6a2 2 0 10-4 0v1h4zm-6 3a1 1 0 112 0 1 1 0 01-2 0zm7-1a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" />
                </svg>
                나의 뽑기 기록
              </h3>

              <div className="bg-black/20 rounded-xl p-4 border border-white/5 min-h-[150px] max-h-[250px] overflow-y-auto custom-scrollbar">
                {!loggedInUser.gachaHistory || loggedInUser.gachaHistory.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-500 py-8">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p>아직 뽑기 기록이 없습니다.</p>
                    <button
                      onClick={() => setIsMyInfoModalOpen(false)}
                      className="text-blue-400 text-sm mt-2 hover:underline"
                    >
                      뽑기 시작하러 가기
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {/* Render history in reverse chronological order */}
                    {[...loggedInUser.gachaHistory].reverse().map((record, idx) => {
                      const tierData = tiers.find(t => t.name === record.grade) || { colorClass: 'text-gray-400' };
                      return (
                        <div key={idx} className="flex justify-between items-center p-3 rounded-lg bg-white/5 border border-white/5">
                          <span className={`font-bold text-lg ${tierData.colorClass}`}>{record.grade}</span>
                          <span className="text-xs text-gray-500 font-mono">
                            {new Date(record.timestamp).toLocaleString()}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Inventory Modal */}
      {isInventoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" style={{ animation: 'none' }}>
          <div className="glass bg-[#1a1a24] rounded-2xl p-6 md:p-8 w-full max-w-md shadow-2xl border border-white/10 animate-bounce-in relative">
            <button
              onClick={() => setIsInventoryModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              전체 카드 재고 현황
            </h2>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              {tiers.map(tier => (
                <div key={tier.name} className="flex justify-between items-center p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                  <span className={`font-bold text-lg ${tier.colorClass}`}>{tier.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-mono text-xl font-bold">{inventory[tier.name] ?? 0}</span>
                    <span className="text-gray-500 text-sm">개 남음</span>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setIsInventoryModalOpen(false)}
              className="w-full mt-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold transition-all duration-300"
            >
              확인
            </button>
          </div>
        </div>
      )}

      {/* Game Info Modal */}
      {isGameInfoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" style={{ animation: 'none' }}>
          <div className="glass bg-[#1a1a24] rounded-2xl p-6 md:p-8 w-full max-w-md shadow-2xl border border-white/10 animate-bounce-in relative">
            <button
              onClick={() => setIsGameInfoModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              게임 이용 안내
            </h2>

            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                <h3 className="text-emerald-400 font-bold mb-2 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  뽑기 비용 안내
                </h3>
                <p className="text-gray-300 ml-3.5">
                  코인 <span className="text-white font-bold">1개</span>당 뽑기 <span className="text-white font-bold">1회</span>가 가능합니다. 코인이 부족할 경우 관리자에게 문의하여 충전 후 이용해 주세요.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                <h3 className="text-emerald-400 font-bold mb-2 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  상품 수령 방법
                </h3>
                <div className="text-gray-300 ml-3.5 space-y-1 text-sm">
                  <p>플러스 친구(<span className="text-emerald-400 font-bold">Sentia</span>)로 아래 정보를 보내주세요:</p>
                  <ul className="list-disc list-inside text-white/90 font-medium">
                    <li>상품 획득 내역</li>
                    <li>성함</li>
                    <li>전화번호</li>
                    <li>배송지 주소</li>
                  </ul>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                <h3 className="text-emerald-400 font-bold mb-2 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  문의사항 (충전/오류)
                </h3>
                <div className="text-gray-300 ml-3.5 space-y-2">
                  <p>카카오톡 플러스친구 검색창에</p>
                  <p className="inline-block px-3 py-1 rounded-lg bg-yellow-400 text-black font-black text-lg">
                    "Sentia"
                  </p>
                  <p>검색 후 메시지를 보내주시면 친절히 안내해 드립니다.</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsGameInfoModalOpen(false)}
              className="w-full mt-8 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold transition-all duration-300 shadow-lg shadow-emerald-500/20"
            >
              확인하였습니다
            </button>
          </div>
        </div>
      )}

      {/* Admin Modal */}
      {isAdminModalOpen && loggedInUser?.id === 'kgbdong123' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" style={{ animation: 'none' }}>
          <div className="glass bg-[#1a1a24] rounded-2xl p-6 md:p-8 w-full max-w-lg shadow-2xl border border-blue-500/30 animate-bounce-in relative max-h-[90vh] flex flex-col">
            <button
              onClick={() => setIsAdminModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              관리자 제어 센터
            </h2>

            <div className="flex border-b border-white/10 mb-6">
              <button
                className={`flex-1 pb-3 text-center font-semibold transition-colors ${authTab === 'admin-coins' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-white'}`}
                onClick={() => setAuthTab('admin-coins')}
              >
                코인 지급
              </button>
              <button
                className={`flex-1 pb-3 text-center font-semibold transition-colors ${authTab === 'admin-stock' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-white'}`}
                onClick={() => {
                  setAuthTab('admin-stock');
                  setAdminInventoryForm({ ...inventory });
                }}
              >
                재고 관리
              </button>
            </div>

            <div className="overflow-y-auto pr-2 custom-scrollbar flex-1">
              {authTab === 'admin-coins' || !authTab.startsWith('admin-') ? (
                <form onSubmit={handleAdminAddCoins} className="flex flex-col gap-4">
                  <div>
                    <label className="block text-gray-400 text-sm mb-1 ml-1 text-left">지급 대상 ID</label>
                    <input
                      required
                      type="text"
                      value={adminForm.targetId}
                      onChange={(e) => setAdminForm(prev => ({ ...prev, targetId: e.target.value }))}
                      className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-400 transition-colors"
                      placeholder="아이디를 입력하세요"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-sm mb-1 ml-1 text-left">지급 코인 수</label>
                    <input
                      required
                      type="number"
                      min="1"
                      value={adminForm.amount}
                      onChange={(e) => setAdminForm(prev => ({ ...prev, amount: e.target.value }))}
                      className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-400 transition-colors"
                      placeholder="예: 10"
                    />
                  </div>
                  <button type="submit" className="w-full mt-4 py-3 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold transition-colors">
                    코인 지급 완료
                  </button>
                </form>
              ) : (
                <form onSubmit={handleAdminUpdateInventory} className="flex flex-col gap-4">
                  <div className="space-y-4">
                    {tiers.map(tier => (
                      <div key={tier.name} className="flex items-center gap-4">
                        <label className={`w-28 font-bold ${tier.colorClass}`}>{tier.name}</label>
                        <input
                          type="number"
                          min="0"
                          value={adminInventoryForm[tier.name] ?? 0}
                          onChange={(e) => setAdminInventoryForm(prev => ({ ...prev, [tier.name]: parseInt(e.target.value) || 0 }))}
                          className="flex-1 bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-400"
                        />
                      </div>
                    ))}
                  </div>
                  <button type="submit" className="w-full mt-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold transition-colors">
                    재고량 일괄 업데이트
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;
