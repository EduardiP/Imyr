:root { --bg:#0e1116; --card:#161b22; --line:#2a313c; --txt:#e6edf3; --mut:#8b949e; --acc:#d4a24e; --good:#3fb950; --err:#f85149; }
* { box-sizing:border-box; }
body { margin:0; background:var(--bg); color:var(--txt); font:16px/1.6 system-ui,Segoe UI,Roboto,sans-serif; }

.topbar { display:flex; align-items:center; justify-content:space-between; padding:14px 20px; border-bottom:1px solid var(--line); position:sticky; top:0; background:rgba(14,17,22,.9); backdrop-filter:blur(6px); z-index:20; }
.topbar .side { flex:1; display:flex; align-items:center; gap:8px; }
.topbar .side.right { justify-content:flex-end; }
.topbar .logo { font-weight:700; letter-spacing:.1em; color:var(--acc); font-size:18px; flex:0 0 auto; }
.btn { padding:8px 14px; border-radius:8px; font-size:14px; cursor:pointer; border:1px solid var(--line); background:transparent; color:var(--txt); }
.btn.cta { background:var(--acc); color:#1a1205; border-color:var(--acc); font-weight:600; }
.btn.ghost { color:var(--mut); }
.btn:disabled { opacity:.5; }

.wrap { max-width:560px; margin:0 auto; padding:40px 20px 80px; }
.wrap.wide { max-width:680px; }
.view { display:none; } .view.on { display:block; }

.hero { text-align:center; }
.hero h1 { font-size:40px; margin:0; letter-spacing:.08em; color:var(--acc); }
.hero p { color:var(--mut); margin:10px 0 26px; font-size:16px; }

.card { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:22px; }
label { display:block; font-size:13px; color:var(--mut); margin:12px 0 4px; }
input, textarea, select { width:100%; padding:10px 12px; background:#0e1116; border:1px solid var(--line); border-radius:8px; color:var(--txt); font-size:14px; font-family:inherit; }
textarea { resize:vertical; min-height:80px; }
button.primary { width:100%; margin-top:18px; padding:11px; background:var(--acc); color:#1a1205; border:none; border-radius:9px; font-weight:600; font-size:15px; cursor:pointer; }
button.primary:disabled { opacity:.5; }
.msg { margin-top:12px; font-size:13px; min-height:18px; }
.msg.err { color:var(--err); } .msg.ok { color:var(--good); }
.hide { display:none !important; }

.menu { position:relative; }
.menuBox { position:absolute; right:0; top:42px; background:var(--card); border:1px solid var(--line); border-radius:10px; padding:6px; min-width:160px; z-index:30; display:flex; flex-direction:column; }
.menuBox button { text-align:left; background:none; border:none; color:var(--txt); padding:9px 12px; border-radius:7px; cursor:pointer; font-size:14px; }
.menuBox button:hover { background:#0e1116; }
.small { font-size:13px; color:var(--mut); }
.rowbtn { display:flex; gap:8px; margin-top:10px; }
.rowbtn .btn { flex:1; text-align:center; }

.backdrop { position:fixed; inset:0; background:rgba(0,0,0,.55); display:flex; align-items:center; justify-content:center; padding:20px; z-index:40; }
.modal { width:100%; max-width:420px; }
.modal .x { float:right; background:none; border:none; color:var(--mut); font-size:20px; cursor:pointer; }
.tabs { display:flex; gap:8px; margin:6px 0 18px; }
.tab { flex:1; text-align:center; padding:8px; border-radius:8px; cursor:pointer; color:var(--mut); font-size:14px; border:1px solid transparent; }
.tab.active { background:#0e1116; color:var(--txt); border-color:var(--line); }

.hstep { display:flex; justify-content:space-between; margin:6px auto 26px; }
.hstep .st { flex:1; text-align:center; position:relative; }
.hstep .st .dot { width:30px; height:30px; border-radius:50%; background:var(--card); border:2px solid var(--line); color:var(--mut); display:flex; align-items:center; justify-content:center; margin:0 auto 6px; font-size:13px; font-weight:600; position:relative; z-index:2; }
.hstep .st.done .dot { background:var(--acc); border-color:var(--acc); color:#1a1205; }
.hstep .st.cur .dot { border-color:var(--acc); color:var(--acc); }
.hstep .st .lbl { font-size:12px; color:var(--mut); }
.hstep .st.done .lbl, .hstep .st.cur .lbl { color:var(--txt); }
.hstep .st:not(:last-child)::after { content:''; position:absolute; top:15px; left:50%; width:100%; height:2px; background:var(--line); z-index:1; }
.hstep .st.done:not(:last-child)::after { background:var(--acc); }

.vstep { display:flex; flex-direction:column; }
.vs { display:flex; gap:12px; align-items:center; padding:11px 10px; border-radius:9px; }
.vs .vd { width:26px; height:26px; border-radius:50%; border:2px solid var(--line); display:flex; align-items:center; justify-content:center; font-size:12px; flex:0 0 auto; color:var(--mut); }
.vs.done .vd { background:var(--acc); border-color:var(--acc); color:#1a1205; }
.vs.cur .vd { border-color:var(--acc); color:var(--acc); }
.vs .vl { font-size:14px; }
.vs.locked { opacity:.45; }
.vs.click { cursor:pointer; }
.vs.click:hover { background:#0e1116; }
.vs.locked .vl { color:var(--mut); }

.status { margin-top:12px; padding:12px 14px; border-radius:10px; border:1px solid var(--line); background:#0e1116; font-size:14px; color:var(--mut); }
.status.wait { border-color:#4a3d1e; color:var(--acc); }
.kod { width:100%; min-height:60px; font-family:monospace; font-size:12.5px; background:#0e1116; border:1px solid var(--line); border-radius:8px; color:var(--acc); padding:12px; resize:vertical; }
.chk { display:flex; gap:10px; align-items:flex-start; margin-top:12px; font-size:13px; cursor:pointer; }
.chk input { width:auto; margin-top:3px; }
.spin { display:inline-block; width:15px; height:15px; border:2px solid var(--line); border-top-color:var(--acc); border-radius:50%; animation:sp .8s linear infinite; vertical-align:middle; }
@keyframes sp { to { transform:rotate(360deg); } }
h2.h { font-size:20px; margin:0 0 4px; }

.appwrap { display:flex; align-items:stretch; min-height:calc(100vh - 58px); }
.sidebar { width:250px; flex:0 0 auto; border-right:1px solid var(--line); padding:20px 14px; }
.main { flex:1; padding:26px 30px; min-width:0; }
.pcard { padding:4px 8px 16px; border-bottom:1px solid var(--line); margin-bottom:12px; }
.pname { font-size:17px; font-weight:600; }
.pmail { font-size:12px; color:var(--mut); }
.pcat { font-size:12px; color:var(--acc); margin-top:4px; }
.snav button { display:block; width:100%; text-align:left; background:none; border:none; color:var(--txt); padding:10px; border-radius:8px; cursor:pointer; font-size:14px; margin-bottom:2px; }
.snav button:hover { background:#0e1116; }
.snav button.active { background:#0e1116; color:var(--acc); }
@media (max-width:700px){ .appwrap{ flex-direction:column; } .sidebar{ width:auto; border-right:none; border-bottom:1px solid var(--line); } }
