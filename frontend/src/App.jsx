import { useEffect, useState, useRef } from "react";
import React from "react";
import API from "./api";

// ─── Auth helpers ─────────────────────────────────────────────────
const getUser = () => { try { return JSON.parse(localStorage.getItem("isp_user")||"null"); } catch { return null; } };
const saveUser = (u) => u ? localStorage.setItem("isp_user", JSON.stringify(u)) : localStorage.removeItem("isp_user");

// ─── Role permissions ──────────────────────────────────────────────
const CAN = {
  editLinks:      ["ADMIN","NOC"],
  addLinks:       ["ADMIN","NOC"],
  changeReq:      ["ADMIN","NOC","PARTNER","KAM"],
  usageUpdate:    ["ADMIN","NOC"],
  billingApprove: ["ACCOUNTS","ADMIN"],
  adminConfirm:   ["ADMIN"],
  managePOPs:     ["ADMIN","NOC"],
  manageUsers:    ["ADMIN"],
};
const can = (role, action) => CAN[action]?.includes(role) ?? false;

// Columns hidden per role
const HIDDEN_COLS = {
  NOC:      ["link_id"],
  ACCOUNTS: [],
  KAM:      ["link_id","vlan","commissioning_date","max_usage","capacity_gap"],
  PARTNER:  ["link_id","owner","vlan","commissioning_date","max_usage","capacity_gap"],
  ADMIN:    [],
};

// ─── constants ───────────────────────────────────────────────────
const EMPTY_LINK = { owner:"AKN", link_id:"", type:"", aggregation:"", to_location:"", quantity_mbps:"", commissioning_date:"", status:"ACTIVE", notes:"", vlan:"" };
const EMPTY_POP  = { operator:"AKN", pop_id:"", name:"", type:"", lat:"", lng:"", notes:"" };

// ─── root ─────────────────────────────────────────────────────────
export default function App() {
  const [user, setUserState] = useState(getUser);
  const handleLogin  = (u) => { saveUser(u); setUserState(u); };
  const handleLogout = ()  => { saveUser(null); setUserState(null); };
  if (!user) return <LoginPage onLogin={handleLogin} />;
  return <MainApp user={user} onLogout={handleLogout} />;
}

function MainApp({ user, onLogout }) {
  const role = user.role;
  const [page, setPage]         = useState("dashboard");
  const [openMenu, setOpenMenu] = useState("network");
  const [sidebarOpen, setSidebarOpen] = useState(false); // mobile sidebar state
  const [links,    setLinks]    = useState([]);
  const [pops,     setPops]     = useState([]);
  const [utils,    setUtils]    = useState([]);
  const [requests, setRequests] = useState([]);
  const [kams,     setKams]     = useState([]);
  const [partners, setPartners] = useState([]);
  const [pendingLinkAction, setPendingLinkAction] = useState(null); // {linkId, action:'usage'|'upgrade'|'downgrade'}

  // helper: trigger from dashboard → opens modal on Links page
  const openLinkAction = (link, action) => {
    setPendingLinkAction({ linkId: link.id, action });
    setPage("links");
  };

  // Auto-logout after 30 min
  useEffect(() => {
    let t;
    const reset = () => {
      clearTimeout(t);
      t = setTimeout(() => {
        alert("Session expired due to inactivity. Please log in again.");
        onLogout();
      }, 30*60*1000);
    };
    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click"];
    events.forEach(e => window.addEventListener(e, reset));
    reset();
    return () => {
      clearTimeout(t);
      events.forEach(e => window.removeEventListener(e, reset));
    };
  }, []);

  useEffect(() => { fetchLinks(); fetchPops(); fetchUtils(); fetchRequests(); fetchKams(); fetchPartners(); }, []);

  const fetchLinks    = async () => { try { const r = await API.get("/links/");       setLinks(r.data); } catch(e) { if(e.response?.status===401) onLogout(); } };
  const fetchPops     = async () => { try { const r = await API.get("/pops/");        setPops(r.data);  } catch(e) {} };
  const fetchUtils    = async () => { try { const r = await API.get("/utilization/"); setUtils(r.data); } catch(e) {} };
  const fetchRequests = async () => { try { const r = await API.get("/requests/");   setRequests(r.data); } catch(e) {} };
  const fetchKams     = async () => { try { const r = await API.get("/kams/");        setKams(r.data); } catch(e) {} };
  const fetchPartners = async () => { try { const r = await API.get("/partners/");   setPartners(r.data); } catch(e) {} };

  const navItems = [
    { id:"dashboard", label:"Dashboard", icon:"▣" },
    { id:"network",   label:"Network",   icon:"◎", children:[
      { id:"links",    label:"Links" },
      ...(can(role,"managePOPs") ? [{ id:"pops", label:"POPs" }] : []),
      { id:"requests", label:"Requests" },
    ]},
    ...(can(role,"manageUsers") ? [
      { id:"management", label:"Management", icon:"◉", children:[
        { id:"users",         label:"Users"    },
        { id:"kams",          label:"KAMs"     },
        { id:"partners_page", label:"Partners" },
      ]},
    ] : []),
    { id:"settings", label:"Settings", icon:"◈" },
  ];

  const navigateTo = (id) => {
    setPage(id);
    setSidebarOpen(false); // close sidebar on mobile after nav
  };

  const pageTitle = page==="dashboard" ? "Dashboard"
    : page==="links"         ? "Network › Links"
    : page==="pops"          ? "Network › POPs"
    : page==="requests"      ? "Network › Requests"
    : page==="users"         ? "Management › Users"
    : page==="kams"          ? "Management › KAMs"
    : page==="partners_page" ? "Management › Partners"
    : page.charAt(0).toUpperCase()+page.slice(1);

  return (
    <>
      <style>{CSS}</style>
      <div className="layout">

        {/* Mobile overlay backdrop */}
        {sidebarOpen && (
          <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
        )}

        <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
          <div className="brand">
            <div className="brand-logo">◈</div>
            <div>
              <div className="brand-name">ISP Panel</div>
              <div className="brand-sub">Network Ops</div>
            </div>
            {/* Close button inside sidebar on mobile */}
            <button className="sidebar-close-btn" onClick={() => setSidebarOpen(false)}>✕</button>
          </div>
          <nav className="nav">
            {navItems.map(item => (
              <div key={item.id}>
                <div
                  className={`nav-item ${page === item.id ? "nav-on" : ""}`}
                  onClick={() => {
                    if (item.children) setOpenMenu(openMenu === item.id ? null : item.id);
                    else navigateTo(item.id);
                  }}
                >
                  <span className="nav-ico">{item.icon}</span>
                  <span>{item.label}</span>
                  {item.children && <span className="nav-arr">{openMenu===item.id?"▾":"▸"}</span>}
                </div>
                {item.children && openMenu===item.id && (
                  <div className="nav-sub">
                    {item.children.map(c => (
                      <div key={c.id} className={`nav-child ${page===c.id?"nav-child-on":""}`} onClick={() => navigateTo(c.id)}>
                        {c.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>
          <div className="sidebar-foot">
            <div className="online-pill"><span className="dot"></span>Online</div>
            <div className="foot-org">AKN Network</div>
          </div>
        </aside>

        <div className="main">
          <div className="topbar">
            {/* Hamburger button — mobile only */}
            <button className="hamburger" onClick={() => setSidebarOpen(true)}>
              <span></span><span></span><span></span>
            </button>
            <div className="topbar-title">{pageTitle}</div>
            <div className="topbar-r">
              <span className="date-chip">{new Date().toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</span>
              <span className="role-badge" style={{background:
                role==="ADMIN"?"#eef2ff":role==="NOC"?"#f0fdf4":role==="ACCOUNTS"?"#fffbeb":role==="PARTNER"?"#f5f3ff":"#f8fafc",
                color:role==="ADMIN"?"#4f46e5":role==="NOC"?"#16a34a":role==="ACCOUNTS"?"#b45309":role==="PARTNER"?"#7c3aed":"#64748b"
              }} title={user.username ? `Logged in as ${user.username}` : ""}>{role}</span>
              {user.username && user.username.toLowerCase() !== role.toLowerCase() && (
                <span className="topbar-username">{user.username}</span>
              )}
              <button onClick={onLogout} className="logout-btn">Logout</button>
            </div>
          </div>
          <div className="content">
            {page==="dashboard" && <Dashboard links={links} pops={pops} utils={utils} setPage={setPage} openLinkAction={openLinkAction} />}
            {page==="links"     && <LinksPage  links={links} fetchLinks={fetchLinks} pops={pops} utils={utils} fetchUtils={fetchUtils} requests={requests} fetchRequests={fetchRequests} partners={partners} user={user} role={role}  hiddenCols={HIDDEN_COLS[role]||[]} pendingLinkAction={pendingLinkAction} clearPendingLinkAction={()=>setPendingLinkAction(null)} />}
            {page==="pops"      && can(role,"managePOPs") && <POPsPage pops={pops} fetchPops={fetchPops} />}
            {page==="requests"       && <RequestsPage requests={requests} links={links} fetchRequests={fetchRequests} fetchLinks={fetchLinks} user={user} />}
            {page==="users"          && can(role,"manageUsers") && <UsersPage />}
            {page==="kams"           && can(role,"manageUsers") && <KAMsPage kams={kams} fetchKams={fetchKams} />}
            {page==="partners_page"  && can(role,"manageUsers") && <PartnersPage partners={partners} kams={kams} fetchPartners={fetchPartners} />}
          </div>
        </div>

      </div>
    </>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────
function Dashboard({ links, pops, utils, setPage, openLinkAction }) {
  const total     = links.length;
  const active    = links.filter(l=>l.status?.toUpperCase()==="ACTIVE").length;
  const pending   = links.filter(l=>l.status?.toUpperCase()==="PENDING").length;
  const cancelled = links.filter(l=>l.status?.toUpperCase()==="CANCELLED").length;

  const stats = [
    { label:"Total Links", value:total,     color:"#6366f1", light:"#eef2ff", border:"#c7d2fe", filter:"ALL" },
    { label:"Active",      value:active,    color:"#16a34a", light:"#f0fdf4", border:"#bbf7d0", filter:"ACTIVE" },
    { label:"Pending",     value:pending,   color:"#d97706", light:"#fffbeb", border:"#fde68a", filter:"PENDING" },
    { label:"Cancelled",   value:cancelled, color:"#dc2626", light:"#fef2f2", border:"#fecaca", filter:"CANCELLED" },
  ];

  // ─── Capacity calculations ────────────────────────────────────
  // Only count ACTIVE links for capacity
  const activeLinks = links.filter(l => l.status?.toUpperCase() === "ACTIVE");

  const sumMbps = (arr) => arr.reduce((s, l) => s + (Number(l.quantity_mbps) || 0), 0);

  const fmtMbps = (mbps) => {
    if (!mbps) return "0 Mbps";
    if (mbps >= 1000) return `${(mbps/1000).toFixed(2)} Gbps`;
    return `${mbps} Mbps`;
  };

  const totalCap = sumMbps(activeLinks);
  const aknLinks = activeLinks.filter(l => l.owner?.toUpperCase() === "AKN");
  const btlLinks = activeLinks.filter(l => l.owner?.toUpperCase() === "BTL");

  // Group by link type for each owner
  const byType = (arr) => {
    const groups = {};
    arr.forEach(l => {
      const t = l.type || "Other";
      if (!groups[t]) groups[t] = { count: 0, mbps: 0 };
      groups[t].count += 1;
      groups[t].mbps  += Number(l.quantity_mbps) || 0;
    });
    return Object.entries(groups).sort((a,b) => b[1].mbps - a[1].mbps);
  };

  const aknByType = byType(aknLinks);
  const btlByType = byType(btlLinks);
  const aknTotal  = sumMbps(aknLinks);
  const btlTotal  = sumMbps(btlLinks);

  return (
    <div className="dash">
      <div className="stat-row">
        {stats.map(s => (
          <button
            key={s.label}
            type="button"
            className="stat-card stat-btn"
            onClick={()=>setPage("links")}
            style={{"--ac":s.color,"--lc":s.light,"--bc":s.border}}
            title={`Go to ${s.label}`}>
            <div className="stat-top">
              <div className="stat-icon-sm" style={{background:s.light,border:`1px solid ${s.border}`}}>
                <span style={{color:s.color}}>◈</span>
              </div>
              <div className="stat-label">{s.label}</div>
            </div>
            <div className="stat-bottom">
              <div className="stat-val" style={{color:s.color}}>{s.value}</div>
              <span className="stat-pct" style={{color:s.color}}>{total?Math.round(s.value/total*100):0}%</span>
            </div>
            <div className="stat-bar"><div className="stat-fill" style={{width:total?`${Math.round(s.value/total*100)}%`:"0%",background:s.color}}></div></div>
          </button>
        ))}
      </div>

      <div className="dash-bottom-3col">
        {/* SEGMENT 1: MAP */}
        <div className="map-card">
          <div className="card-head">
            <span className="card-title">POP Locations</span>
            <button className="btn-sm" onClick={()=>setPage("pops")}>Manage POPs →</button>
          </div>
          <div className="map-wrap">
            <POPMap pops={pops} />
          </div>
          <div className="map-legend">
            <div className="legend-item"><div className="legend-diamond" style={{background:"#2563eb"}}></div><span>AKN Aggregation</span></div>
            <div className="legend-item"><div className="legend-circle" style={{background:"#2563eb"}}></div><span>AKN POP</span></div>
            <div className="legend-item"><div className="legend-diamond" style={{background:"#16a34a"}}></div><span>BTL Aggregation</span></div>
            <div className="legend-item"><div className="legend-circle" style={{background:"#16a34a"}}></div><span>BTL POP</span></div>
          </div>
          {pops.length===0 && (
            <div className="map-empty">No POPs added yet.</div>
          )}
        </div>

        {/* SEGMENT 2: LINK CAPACITY */}
        <div className="capacity-card">
          <div className="card-head">
            <span className="card-title">Link Capacity</span>
            <span style={{fontSize:11,color:"#94a3b8",fontWeight:500}}>Active Only</span>
          </div>
          <div className="cap-scroll">
            {/* Total */}
            <div className="cap-total-box">
              <div style={{fontSize:11,color:"#64748b",fontWeight:600,letterSpacing:.4,textTransform:"uppercase",marginBottom:4}}>Total Capacity</div>
              <div style={{fontSize:24,fontWeight:700,color:"#4f46e5",fontFamily:"'IBM Plex Mono',monospace",lineHeight:1}}>{fmtMbps(totalCap)}</div>
              <div style={{fontSize:11,color:"#94a3b8",marginTop:4}}>{activeLinks.length} active link{activeLinks.length!==1?"s":""}</div>
            </div>

            {/* AKN section */}
            <div className="cap-owner-box" style={{borderColor:"#bfdbfe"}}>
              <div className="cap-owner-head">
                <span className="cap-owner-tag" style={{background:"#dbeafe",color:"#2563eb"}}>AKN</span>
                <span className="cap-owner-total" style={{color:"#2563eb"}}>{fmtMbps(aknTotal)}</span>
              </div>
              <div className="cap-owner-sub">{aknLinks.length} link{aknLinks.length!==1?"s":""} • {totalCap?Math.round(aknTotal/totalCap*100):0}% of total</div>
              {aknByType.length === 0 ? (
                <div className="cap-empty">No active AKN links</div>
              ) : aknByType.map(([type, d]) => {
                const pct = aknTotal ? Math.round(d.mbps / aknTotal * 100) : 0;
                return (
                  <div key={type} className="cap-type-row">
                    <div className="cap-type-line">
                      <span className="cap-type-name">{type}</span>
                      <span className="cap-type-val">{fmtMbps(d.mbps)} <span style={{color:"#94a3b8",fontWeight:500}}>({d.count})</span></span>
                    </div>
                    <div className="cap-bar"><div className="cap-bar-fill" style={{width:`${pct}%`,background:"#2563eb"}}></div></div>
                  </div>
                );
              })}
            </div>

            {/* BTL section */}
            <div className="cap-owner-box" style={{borderColor:"#bbf7d0"}}>
              <div className="cap-owner-head">
                <span className="cap-owner-tag" style={{background:"#dcfce7",color:"#16a34a"}}>BTL</span>
                <span className="cap-owner-total" style={{color:"#16a34a"}}>{fmtMbps(btlTotal)}</span>
              </div>
              <div className="cap-owner-sub">{btlLinks.length} link{btlLinks.length!==1?"s":""} • {totalCap?Math.round(btlTotal/totalCap*100):0}% of total</div>
              {btlByType.length === 0 ? (
                <div className="cap-empty">No active BTL links</div>
              ) : btlByType.map(([type, d]) => {
                const pct = btlTotal ? Math.round(d.mbps / btlTotal * 100) : 0;
                return (
                  <div key={type} className="cap-type-row">
                    <div className="cap-type-line">
                      <span className="cap-type-name">{type}</span>
                      <span className="cap-type-val">{fmtMbps(d.mbps)} <span style={{color:"#94a3b8",fontWeight:500}}>({d.count})</span></span>
                    </div>
                    <div className="cap-bar"><div className="cap-bar-fill" style={{width:`${pct}%`,background:"#16a34a"}}></div></div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* SEGMENT 3: LINKS NEED ATTENTION */}
        <LinksNeedAttention links={links} utils={utils} setPage={setPage} openLinkAction={openLinkAction} />
      </div>
    </div>
  );
}

// ─── Links Need Attention ─────────────────────────────────────────
const DAYS_STALE_THRESHOLD = 10;
const UNDER_THRESHOLD = 80;
const OVER_THRESHOLD  = 95;

function LinksNeedAttention({ links, utils, setPage, openLinkAction }) {
  const [tab, setTab] = useState("stale");

  const utilMap = React.useMemo(
    () => Object.fromEntries((utils||[]).map(u => [u.link_id, u])),
    [utils]
  );

  const { stale, under, over } = React.useMemo(() => {
    const now = Date.now();
    const stale = [], under = [], over = [];

    links.forEach(l => {
      if (l.status?.toUpperCase() !== "ACTIVE") return;

      const u = utilMap[l.id];
      const lastUpdate = u?.updated_at ? new Date(u.updated_at).getTime() : null;
      const daysSince = lastUpdate ? Math.floor((now - lastUpdate) / 86400000) : 9999;

      if (daysSince >= DAYS_STALE_THRESHOLD) {
        stale.push({ ...l, daysSince, updatedAt: u?.updated_at });
        return;
      }

      const cap = Number(l.quantity_mbps);
      const usage = Number(u?.max_util_mbps);
      if (!cap || isNaN(usage)) return;

      const pct = (usage / cap) * 100;
      if (pct > OVER_THRESHOLD)      over.push({ ...l, usagePct: pct, usage, cap });
      else if (pct < UNDER_THRESHOLD) under.push({ ...l, usagePct: pct, usage, cap });
    });

    stale.sort((a,b) => b.daysSince - a.daysSince);
    over.sort((a,b) => b.usagePct - a.usagePct);
    under.sort((a,b) => a.usagePct - b.usagePct);
    return { stale, under, over };
  }, [links, utilMap]);

  const tabs = {
    stale: { items: stale },
    over:  { items: over  },
    under: { items: under },
  };
  const activeItems = tabs[tab].items;
  const totalAttention = stale.length + under.length + over.length;

  const fmt = d => d ? new Date(d).toLocaleDateString("en-GB", {day:"numeric", month:"short"}) : "never";

  return (
    <div className="attn-card">
      <div className="attn-head">
        <div>
          <div className="attn-title">Links need attention</div>
          <div className="attn-sub">{totalAttention} total · action required</div>
        </div>
        <button className="attn-viewall" onClick={()=>setPage("links")}>View all →</button>
      </div>

      <div className="attn-stats">
        <div
          className={`attn-stat attn-stat-stale ${tab==="stale"?"attn-stat-active":""}`}
          onClick={()=>setTab("stale")}>
          <div className="attn-stat-num attn-num-stale">{stale.length}</div>
          <div className="attn-stat-lbl attn-lbl-stale">Stale usage</div>
        </div>
        <div
          className={`attn-stat attn-stat-over ${tab==="over"?"attn-stat-active":""}`}
          onClick={()=>setTab("over")}>
          <div className="attn-stat-num attn-num-over">{over.length}</div>
          <div className="attn-stat-lbl attn-lbl-over">Over {OVER_THRESHOLD}%</div>
        </div>
        <div
          className={`attn-stat attn-stat-under ${tab==="under"?"attn-stat-active":""}`}
          onClick={()=>setTab("under")}>
          <div className="attn-stat-num attn-num-under">{under.length}</div>
          <div className="attn-stat-lbl attn-lbl-under">Under {UNDER_THRESHOLD}%</div>
        </div>
      </div>

      <div className="attn-list">
        {activeItems.length === 0 ? (
          <div className="attn-empty">Nothing here — all good</div>
        ) : activeItems.slice(0, 5).map(l => {
          const u = utilMap[l.id];
          const lastUpd = u?.updated_at ? new Date(u.updated_at).getTime() : null;
          const daysSinceUpd = lastUpd ? Math.floor((Date.now() - lastUpd) / 86400000) : null;
          const updText = daysSinceUpd === null
            ? "Never updated"
            : daysSinceUpd === 0
              ? "Updated today"
              : `${daysSinceUpd}d ago`;

          let chipClass, chipText, actionLabel, actionType;
          if (tab === "stale") {
            chipClass   = "attn-chip-stale";
            chipText    = l.daysSince >= 9999 ? "Never" : `${l.daysSince}d`;
            actionLabel = "Update";
            actionType  = "usage";
          } else if (tab === "over") {
            chipClass   = "attn-chip-over";
            chipText    = `${Math.round(l.usagePct)}%`;
            actionLabel = "Upgrade";
            actionType  = "upgrade";
          } else {
            chipClass   = "attn-chip-under";
            chipText    = `${Math.round(l.usagePct)}%`;
            actionLabel = "Downgrade";
            actionType  = "downgrade";
          }
          const statusLine = updText;

          const route = `${l.aggregation || "—"} → ${l.to_location || "—"}`;

          return (
            <div key={l.id} className="attn-row">
              <div className="attn-row-info">
                <div className="attn-row-route">{route}</div>
                {l.notes && <div className="attn-row-note">{l.notes}</div>}
                <div className="attn-row-status">
                  <span className={`attn-chip ${chipClass}`}>{chipText}</span>
                  <span className="attn-row-statustxt">{statusLine}</span>
                </div>
              </div>
              <button className="attn-row-btn" onClick={()=>openLinkAction ? openLinkAction(l, actionType) : setPage("links")}>{actionLabel}</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Map ──────────────────────────────────────────────────────────
function POPMap({ pops }) {
  const mapRef = useRef(null);
  const instanceRef = useRef(null);

  useEffect(() => {
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css"; link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    const init = () => {
      const L = window.L;
      if (!L || !mapRef.current) return;

      if (instanceRef.current) {
        instanceRef.current.remove();
        instanceRef.current = null;
      }

      const map = L.map(mapRef.current);
      instanceRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors"
      }).addTo(map);

      map.setView([23.7000, 90.3563], 7);
      map.setMaxBounds([[19.5, 87.0], [27.5, 93.5]]);
      map.setMaxZoom(18);

      const withCoords = pops.filter(p => p.lat != null && p.lat !== "" && p.lng != null && p.lng !== "");

      const markers = [];
      
      withCoords.forEach(p => {
        const isAgg = p.type?.toLowerCase() === "aggregation";
        const isAKN = p.operator?.toUpperCase() === "AKN";
        const bgColor = isAKN ? "#2563eb" : "#16a34a";
      
        const iconHtml = isAgg
          ? `<div style="width:16px;height:16px;background:${bgColor};border:2.5px solid #fff;border-radius:3px;transform:rotate(45deg);box-shadow:0 2px 8px rgba(0,0,0,.4);"></div>`
          : `<div style="width:18px;height:18px;background:${bgColor};border:2.5px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,.4);"></div>`;
      
        const icon = L.divIcon({
          html: `<div style="width:22px;height:22px;display:flex;align-items:center;justify-content:center;">${iconHtml}</div>`,
          className: "",
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        });
      
        const m = L.marker([Number(p.lat), Number(p.lng)], { icon }).addTo(map);
        markers.push(m); // ✅ important
      
        m.bindPopup(`...same popup...`);
      });
      
      // ✅ AUTO FIT MAP
      if (markers.length > 0) {
        const group = L.featureGroup(markers);
        map.fitBounds(group.getBounds(), { padding: [30, 30] });
      }


    };

    if (window.L) {
      init();
    } else {
      let script = document.getElementById("leaflet-js");
      if (!script) {
        script = document.createElement("script");
        script.id = "leaflet-js";
        script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
        document.head.appendChild(script);
      }
      script.addEventListener("load", init);
    }

    return () => {
      if (instanceRef.current) {
        instanceRef.current.remove();
        instanceRef.current = null;
      }
    };
  }, [pops]);

  return <div ref={mapRef} style={{height:"100%",width:"100%"}} />;
}

// ─── Links Page ───────────────────────────────────────────────────
function LinksPage({ links, fetchLinks, pops, utils, fetchUtils, requests, fetchRequests, partners, user, role, hiddenCols=[], pendingLinkAction, clearPendingLinkAction }) {
  const [filter, setFilter]             = useState("ALL");
  const [showForm, setShowForm]         = useState(false);
  const [editingLink, setEditingLink]   = useState(null);
  const [originalLink, setOriginalLink] = useState(null);
  const [form, setForm]                 = useState(EMPTY_LINK);
  const [showExport, setShowExport]     = useState(false);
  const [search, setSearch]             = useState("");
  const [utilModal, setUtilModal]       = useState(null);
  const [reqModal,  setReqModal]        = useState(null);
  const [reqInitialType, setReqInitialType] = useState("UPGRADE");
  const [sortCol, setSortCol]           = useState(null);
  const [sortDir, setSortDir]           = useState("asc");

  // Handle pending action from Dashboard (open Usage / Upgrade / Downgrade modal)
  useEffect(() => {
    if (!pendingLinkAction || !links.length) return;
    const link = links.find(l => l.id === pendingLinkAction.linkId);
    if (!link) return;
    if (pendingLinkAction.action === "usage") {
      setUtilModal(link);
    } else if (pendingLinkAction.action === "upgrade") {
      setReqInitialType("UPGRADE");
      setReqModal(link);
    } else if (pendingLinkAction.action === "downgrade") {
      setReqInitialType("DOWNGRADE");
      setReqModal(link);
    }
    clearPendingLinkAction?.();
  }, [pendingLinkAction, links]);

  const hide = (col) => hiddenCols.includes(col);
  const aggPOPs = pops.filter(p => p.type?.toLowerCase() === "aggregation");
  const utilMap = Object.fromEntries(utils.map(u => [u.link_id, u]));

  const daysSince = (dateStr) => {
    if (!dateStr) return null;
    const diff = Date.now() - new Date(dateStr).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  const handleChange = e => setForm({...form, [e.target.name]: e.target.value});

  const handleSubmit = async e => {
    e.preventDefault();
    try {
      await API.post("/links/", {
        ...form,
        quantity_mbps: form.quantity_mbps ? Number(form.quantity_mbps) : null,
        commissioning_date: form.commissioning_date || null,
      });
      fetchLinks(); setShowForm(false); setForm(EMPTY_LINK);
    } catch(err) { console.error(err); }
  };

  const handleUpdate = async () => {
    try {
      await API.put(`/links/${editingLink.id}`, {
        ...editingLink,
        quantity_mbps: editingLink.quantity_mbps ? Number(editingLink.quantity_mbps) : null,
        commissioning_date: editingLink.commissioning_date || null,
      });
      setEditingLink(null); setOriginalLink(null); fetchLinks();
    } catch(err) { console.error(err); }
  };

  const filtered = (() => {
    let rows = links.filter(l => {
      const matchFilter = filter==="ALL" || l.status?.toUpperCase()===filter;
      const q = search.toLowerCase().trim();
      const matchSearch = !q || [l.link_id,l.owner,l.type,l.aggregation,l.to_location,l.vlan,l.notes,l.status]
        .some(v => v && String(v).toLowerCase().includes(q));
      return matchFilter && matchSearch;
    });
    if (sortCol) {
      rows = [...rows].sort((a, b) => {
        let av, bv;
        if (sortCol === "max_usage") {
          av = utilMap[a.id]?.max_util_mbps ?? -1;
          bv = utilMap[b.id]?.max_util_mbps ?? -1;
        } else if (sortCol === "capacity_gap") {
          av = (a.quantity_mbps && utilMap[a.id]) ? a.quantity_mbps - utilMap[a.id].max_util_mbps : null;
          bv = (b.quantity_mbps && utilMap[b.id]) ? b.quantity_mbps - utilMap[b.id].max_util_mbps : null;
          av = av ?? 9999; bv = bv ?? 9999;
        } else if (sortCol === "last_updated") {
          av = utilMap[a.id]?.updated_at ? new Date(utilMap[a.id].updated_at).getTime() : 0;
          bv = utilMap[b.id]?.updated_at ? new Date(utilMap[b.id].updated_at).getTime() : 0;
        } else {
          av = a[sortCol] ?? "";
          bv = b[sortCol] ?? "";
        }
        if (av < bv) return sortDir === "asc" ? -1 : 1;
        if (av > bv) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
    }
    return rows;
  })();

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  };

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return <span style={{opacity:.3,marginLeft:3}}>⇅</span>;
    return <span style={{marginLeft:3,color:"#6366f1"}}>{sortDir==="asc"?"↑":"↓"}</span>;
  };

  return (
    <div className="page-col">
      <div className="toolbar">
        <div className="tabs">
          {["ALL","ACTIVE","PENDING","CANCELLED"].map(f=>(
            <button key={f} className={`tab ${filter===f?"tab-on":""}`} onClick={()=>setFilter(f)}>{f}</button>
          ))}
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <div className="search-wrap">
            <span className="search-icon">⌕</span>
            <input className="search-input" placeholder="Search links…" value={search} onChange={e=>setSearch(e.target.value)} />
            {search && <button className="search-clear" onClick={()=>setSearch("")}>✕</button>}
          </div>
          <button className="btn-export" onClick={()=>setShowExport(true)}>↓ Export</button>
          {can(role,"addLinks") && <button className="btn-add" onClick={()=>{setShowForm(!showForm);setEditingLink(null);}}>
            {showForm?"✕ Close":"+ Add Link"}
          </button>}
        </div>
      </div>

      {showExport && <ExportModal
        data={filtered.map(l => ({
          ...l,
          max_usage:          utilMap[l.id]?.max_util_mbps ?? null,
          capacity_gap:       (l.quantity_mbps && utilMap[l.id]) ? (l.quantity_mbps - utilMap[l.id].max_util_mbps).toFixed(1) : null,
          last_usage_updated: utilMap[l.id]?.updated_at ? new Date(utilMap[l.id].updated_at).toLocaleDateString("en-GB") : null,
          usage_updated_by:   utilMap[l.id]?.updated_by ?? null,
        }))}
        allCols={LINK_COLS} title="Links"
        filterField="status" filterOptions={["ACTIVE","PENDING","CANCELLED","AKN","BTL"]}
        searchTerm={search}
        activeFilter={filter}
        totalCount={links.length}
        onClose={()=>setShowExport(false)} />}

      {/* ADD FORM */}
      {showForm && (
        <div className="form-box">
          <div className="form-head"><b>Add New Link</b></div>
          <form onSubmit={handleSubmit}>
            <div className="fg fg-5">
              <Sel label="Owner"  name="owner"  val={form.owner}  onChange={handleChange} opts={["AKN","BTL"]} />
              <F   label="Link ID" name="link_id" val={form.link_id} onChange={handleChange} placeholder="aknw_220523_001" required />
              <Sel label="Type"   name="type"   val={form.type}   onChange={handleChange} opts={["D2D","Long Haul","Metro"]} placeholderOpt="Select type…" />
              <div className="field">
                <label className="flabel">Aggregation</label>
                <select className="finput" name="aggregation" value={form.aggregation} onChange={handleChange}>
                  <option value="">Select aggregation…</option>
                  {aggPOPs.map(p => (
                    <option key={p.id} value={p.name}>{p.name}</option>
                  ))}
                </select>
              </div>
              <F   label="To Location"      name="to_location"        val={form.to_location}        onChange={handleChange} placeholder="e.g. Sadarpur" required />
              <F   label="Bandwidth (Mbps)" name="quantity_mbps"      val={form.quantity_mbps}      onChange={handleChange} placeholder="1500" type="number" />
              <F   label="VLAN"             name="vlan"               val={form.vlan}               onChange={handleChange} placeholder="10-15,18" />
              <F   label="Date"             name="commissioning_date" val={form.commissioning_date} onChange={handleChange} type="date" />
              <Sel label="Status" name="status" val={form.status} onChange={handleChange} opts={["ACTIVE","PENDING","CANCELLED"]} />
              <F   label="Notes"  name="notes"  val={form.notes}  onChange={handleChange} placeholder="Optional" />
            </div>
            <div className="factions">
              <button type="submit" className="btn-save">Save Link</button>
              <button type="button" className="btn-discard" onClick={()=>setShowForm(false)}>Discard</button>
            </div>
          </form>
        </div>
      )}

      {/* EDIT FORM */}
      {editingLink && (
        <div className="form-box edit-box">
          <div className="form-head"><b>Edit Link</b> — <span className="edit-id">{editingLink.link_id}</span></div>
          <div className="fg fg-5">
            <Sel label="Owner" val={editingLink.owner} onChange={e=>setEditingLink({...editingLink,owner:e.target.value})} opts={["AKN","BTL"]} />
            <div className="field"><label className="flabel">Link ID</label><input className="finput" value={editingLink.link_id} disabled /></div>
            <Sel label="Type" val={editingLink.type||""} onChange={e=>setEditingLink({...editingLink,type:e.target.value})} opts={["D2D","Long Haul","Metro"]} placeholderOpt="Select type…" />
            <div className="field">
              <label className="flabel">Aggregation</label>
              <select className="finput" value={editingLink.aggregation||""} onChange={e=>setEditingLink({...editingLink,aggregation:e.target.value})}>
                <option value="">Select aggregation…</option>
                {aggPOPs.map(p => (
                  <option key={p.id} value={p.name}>{p.name}</option>
                ))}
              </select>
            </div>
            {[
              {label:"To Location",       key:"to_location"},
              {label:"Bandwidth (Mbps)",  key:"quantity_mbps", type:"number"},
              {label:"VLAN",              key:"vlan"},
              {label:"Date",              key:"commissioning_date", type:"date"},
            ].map(f=>(
              <div className="field" key={f.key}>
                <label className="flabel">{f.label}</label>
                <input className="finput" type={f.type||"text"} value={editingLink[f.key]||""} onChange={e=>setEditingLink({...editingLink,[f.key]:e.target.value})} />
              </div>
            ))}
            <Sel label="Status" val={editingLink.status} onChange={e=>setEditingLink({...editingLink,status:e.target.value})} opts={["ACTIVE","PENDING","CANCELLED"]} />
            <div className="field">
              <label className="flabel">Notes</label>
              <input className="finput" value={editingLink.notes||""} onChange={e=>setEditingLink({...editingLink,notes:e.target.value})} />
            </div>
          </div>
          <div className="factions">
            <button className="btn-save" onClick={handleUpdate}>Save Changes</button>
            <button className="btn-discard" onClick={()=>setEditingLink(null)}>Cancel</button>
          </div>
        </div>
      )}

      {reqModal && <RequestModal link={reqModal} user={user} initialType={reqInitialType} onClose={()=>setReqModal(null)} onSave={async (payload)=>{ await API.post("/requests/", payload); fetchRequests(); setReqModal(null); }} />}

      {utilModal && <UtilModal link={utilModal} onClose={()=>setUtilModal(null)} onSave={async (mbps, by, periodFrom, periodTo) => {
        await API.post("/utilization/", {
          link_id: utilModal.id,
          max_util_mbps: Number(mbps),
          updated_by: by,
          period_from: periodFrom || null,
          period_to: periodTo || null,
        });
        fetchUtils();
        setUtilModal(null);
      }} />}

      {/* TABLE */}
      <div className="tbl-wrap">
        <div className="tbl-hd">
          <span className="tbl-title">Links <span className="tbl-cnt">{filtered.length}</span></span>
          <span className="tbl-f">Filter: {filter}</span>
        </div>
        <div className="tbl-scroll">
          <table>
            <thead><tr>
              <th>#</th>
              {!hide("link_id") && <th className="th-sort" onClick={()=>handleSort("link_id")}>Link ID<SortIcon col="link_id"/></th>}
              {!hide("owner")   && <th className="th-sort" onClick={()=>handleSort("owner")}>Owner<SortIcon col="owner"/></th>}
              <th className="th-sort" onClick={()=>handleSort("type")}>Type<SortIcon col="type"/></th>
              <th className="th-sort" onClick={()=>handleSort("aggregation")}>Aggregation<SortIcon col="aggregation"/></th>
              <th className="th-sort" onClick={()=>handleSort("to_location")}>To Location<SortIcon col="to_location"/></th>
              <th className="th-sort" onClick={()=>handleSort("quantity_mbps")}>Bandwidth<SortIcon col="quantity_mbps"/></th>
              {!hide("vlan") && <th>VLAN</th>}
              {!hide("commissioning_date") && <th className="th-sort" onClick={()=>handleSort("commissioning_date")}>Date<SortIcon col="commissioning_date"/></th>}
              <th className="th-sort" onClick={()=>handleSort("status")}>Status<SortIcon col="status"/></th>
              <th>Notes</th>
              {!hide("max_usage")    && <th className="th-sort" onClick={()=>handleSort("max_usage")}>Max Usage<SortIcon col="max_usage"/></th>}
              {!hide("capacity_gap")  && <th className="th-sort" onClick={()=>handleSort("capacity_gap")}>Capacity Gap<SortIcon col="capacity_gap"/></th>}
              {!hide("last_updated")  && <th className="th-sort" onClick={()=>handleSort("last_updated")}>Last Usage Updated<SortIcon col="last_updated"/></th>}
              <th>Action</th>
            </tr></thead>
            <tbody>
              {filtered.length===0 ? (
                <tr><td colSpan={15} className="empty">{search ? `No links match "${search}"` : "No links found"}</td></tr>
              ) : filtered.map((l,i)=>(
                <tr key={l.id}>
                  <td className="num">{i+1}</td>
                  {!hide("link_id") && <td><span className="lid">{l.link_id}</span></td>}
                  {!hide("owner") && <td className="muted">{l.owner}</td>}
                  <td>{l.type?<span className="type-chip">{l.type}</span>:<span className="muted">—</span>}</td>
                  <td className="muted">{l.aggregation||"—"}</td>
                  <td className="bold">{l.to_location}</td>
                  <td className="bold">{l.quantity_mbps?`${l.quantity_mbps} Mbps`:"—"}</td>
                  {!hide("vlan") && <td className="bold">{l.vlan||"—"}</td>}
                  {!hide("commissioning_date") && <td className="muted">{l.commissioning_date||"—"}</td>}
                  <td><Badge status={l.status}/></td>
                  <td className="muted notes-cell">{l.notes||"—"}</td>
                  {!hide("max_usage") && <td>{(() => {
                    const u = utilMap[l.id];
                    if (!u || u.max_util_mbps == null) return <span className="muted">—</span>;
                    const pct = l.quantity_mbps ? Math.round(u.max_util_mbps / l.quantity_mbps * 100) : null;
                    const color = pct >= 90 ? "#dc2626" : pct >= 70 ? "#d97706" : "#16a34a";
                    return (<span style={{fontSize:12,color,fontWeight:600}}>{u.max_util_mbps} Mbps{pct!=null?` (${pct}%)`:""}</span>);
                  })()}</td>}
                  {!hide("capacity_gap") && <td>{(() => {
                    const u = utilMap[l.id];
                    if (!u || u.max_util_mbps == null || !l.quantity_mbps) return <span className="muted">—</span>;
                    const gap = l.quantity_mbps - u.max_util_mbps;
                    const pct = Math.round(gap / l.quantity_mbps * 100);
                    const color = gap < 0 ? "#dc2626" : gap < l.quantity_mbps * 0.1 ? "#d97706" : "#16a34a";
                    return <span style={{fontSize:12,fontWeight:600,color}}>{gap < 0 ? "⚠ +" + Math.abs(gap).toFixed(0) : gap.toFixed(0)} Mbps ({pct}%)</span>;
                  })()}</td>}
                  <td>{(() => {
                    const u = utilMap[l.id];
                    if (!u?.updated_at) return <span className="muted">Never</span>;
                    const days = daysSince(u.updated_at);
                    const color = days === 0 ? "#16a34a" : days <= 7 ? "#d97706" : "#dc2626";
                    const fmt = d => d ? new Date(d).toLocaleDateString("en-GB",{day:"numeric",month:"short"}) : null;
                    const period = (u.period_from && u.period_to)
                      ? `${fmt(u.period_from)} – ${fmt(u.period_to)}`
                      : null;
                    return (
                      <div>
                        <span style={{fontSize:11,fontWeight:600,color}}>{days === 0 ? "Today" : `${days}d ago`}</span>
                        {u.updated_by && <div style={{fontSize:10,color:"#94a3b8"}}>{u.updated_by}</div>}
                        {period && <div style={{fontSize:10,color:"#94a3b8"}}>{period}</div>}
                      </div>
                    );
                  })()}</td>
                  <td>
                    <div className="action-cell">
                      {can(role,"editLinks") && <button className="btn-act btn-act-edit" onClick={()=>{setEditingLink(l);setOriginalLink(l);setShowForm(false);}} title="Edit link details">Edit</button>}
                      {can(role,"usageUpdate") && <button className="btn-act btn-act-usage" onClick={()=>setUtilModal(l)} title="Update usage data">Usage</button>}
                      {can(role,"changeReq") && <button className="btn-act btn-act-capacity" onClick={()=>{setReqInitialType("UPGRADE");setReqModal(l);setShowForm(false);setEditingLink(null);}} title="Request capacity change">Capacity</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="tbl-foot">Showing {filtered.length} of {links.length} links{search ? ` matching "${search}"` : ""} — <span style={{color:"#94a3b8"}}>{Object.keys(utilMap).length} with usage data</span></div>
      </div>
    </div>
  );
}

// ─── POPs Page ────────────────────────────────────────────────────
function POPsPage({ pops, fetchPops }) {
  const [showForm, setShowForm]     = useState(false);
  const [editingPOP, setEditingPOP] = useState(null);
  const [form, setForm]             = useState(EMPTY_POP);
  const [showExport, setShowExport] = useState(false);
  const [search, setSearch]         = useState("");
  const [filterOp, setFilterOp]     = useState("ALL");
  const [sortColP, setSortColP]     = useState(null);
  const [sortDirP, setSortDirP]     = useState("asc");

  const handleChange = e => setForm({...form, [e.target.name]: e.target.value});

  const handleSubmit = async e => {
    e.preventDefault();
    try {
      await API.post("/pops/", {
        ...form,
        lat: form.lat ? Number(form.lat) : null,
        lng: form.lng ? Number(form.lng) : null,
      });
      fetchPops(); setShowForm(false); setForm(EMPTY_POP);
    } catch(err) { console.error(err); }
  };

  const handleUpdate = async () => {
    try {
      await API.put(`/pops/${editingPOP.id}`, {
        ...editingPOP,
        lat: editingPOP.lat ? Number(editingPOP.lat) : null,
        lng: editingPOP.lng ? Number(editingPOP.lng) : null,
      });
      setEditingPOP(null); fetchPops();
    } catch(err) { console.error(err); }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this POP?")) return;
    await API.delete(`/pops/${id}`);
    fetchPops();
  };

  const typeChip = (t) => {
    const isAgg = t?.toLowerCase() === "aggregation";
    return (
      <span style={{fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius:4,
        color:isAgg?"#0369a1":"#6d28d9", background:isAgg?"#e0f2fe":"#ede9fe"}}>
        {t||"—"}
      </span>
    );
  };

  const filteredPOPs = (() => {
    let rows = pops.filter(p => {
      const matchOp = filterOp==="ALL" || p.operator?.toUpperCase()===filterOp;
      const q = search.toLowerCase().trim();
      const matchSearch = !q || [p.pop_id,p.name,p.type,p.operator,p.notes]
        .some(v => v && String(v).toLowerCase().includes(q));
      return matchOp && matchSearch;
    });
    if (sortColP) {
      rows = [...rows].sort((a, b) => {
        const av = a[sortColP] ?? ""; const bv = b[sortColP] ?? "";
        if (av < bv) return sortDirP === "asc" ? -1 : 1;
        if (av > bv) return sortDirP === "asc" ? 1 : -1;
        return 0;
      });
    }
    return rows;
  })();

  const handleSortP = (col) => {
    if (sortColP === col) setSortDirP(d => d === "asc" ? "desc" : "asc");
    else { setSortColP(col); setSortDirP("asc"); }
  };

  const SortIconP = ({ col }) => {
    if (sortColP !== col) return <span style={{opacity:.3,marginLeft:3}}>⇅</span>;
    return <span style={{marginLeft:3,color:"#6366f1"}}>{sortDirP==="asc"?"↑":"↓"}</span>;
  };

  return (
    <div className="page-col">
      <div className="toolbar">
        <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          <span className="section-title">POPs</span>
          <div className="tabs">
            {["ALL","AKN","BTL"].map(f=>(
              <button key={f} className={`tab ${filterOp===f?"tab-on":""}`} onClick={()=>setFilterOp(f)}>{f}</button>
            ))}
          </div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <div className="search-wrap">
            <span className="search-icon">⌕</span>
            <input className="search-input" placeholder="Search POPs…" value={search} onChange={e=>setSearch(e.target.value)} />
            {search && <button className="search-clear" onClick={()=>setSearch("")}>✕</button>}
          </div>
          <button className="btn-export" onClick={()=>setShowExport(true)}>↓ Export</button>
          <button className="btn-add" onClick={()=>{setShowForm(!showForm);setEditingPOP(null);}}>
            {showForm?"✕ Close":"+ Add POP"}
          </button>
        </div>
      </div>

      {showExport && <ExportModal data={filteredPOPs} allCols={POP_COLS} title="POPs"
        filterField="operator" filterOptions={["AKN","BTL"]}
        searchTerm={search}
        activeFilter={filterOp}
        totalCount={pops.length}
        onClose={()=>setShowExport(false)} />}

      {showForm && (
        <div className="form-box">
          <div className="form-head"><b>Add New POP</b></div>
          <form onSubmit={handleSubmit}>
            <div className="fg fg-5">
              <Sel label="Operator"  name="operator" val={form.operator} onChange={handleChange} opts={["AKN","BTL"]} />
              <F   label="POP ID"    name="pop_id" val={form.pop_id} onChange={handleChange} placeholder="e.g. POP-001" required />
              <F   label="POP Name"  name="name"   val={form.name}   onChange={handleChange} placeholder="e.g. Bhanga POP" required />
              <Sel label="Type"      name="type"   val={form.type}   onChange={handleChange} opts={["Aggregation","POP"]} placeholderOpt="Select type…" />
              <F   label="Latitude"  name="lat"    val={form.lat}    onChange={handleChange} placeholder="e.g. 23.0104" type="number" />
              <F   label="Longitude" name="lng"    val={form.lng}    onChange={handleChange} placeholder="e.g. 89.9985" type="number" />
              <F   label="Notes"     name="notes"  val={form.notes}  onChange={handleChange} placeholder="Optional" />
            </div>
            <div className="factions">
              <button type="submit" className="btn-save">Save POP</button>
              <button type="button" className="btn-discard" onClick={()=>setShowForm(false)}>Discard</button>
            </div>
          </form>
        </div>
      )}

      {editingPOP && (
        <div className="form-box edit-box">
          <div className="form-head"><b>Edit POP</b> — <span className="edit-id">{editingPOP.name}</span></div>
          <div className="fg fg-5">
            <div className="field">
              <label className="flabel">Operator</label>
              <select className="finput" value={editingPOP.operator||"AKN"} onChange={e=>setEditingPOP({...editingPOP,operator:e.target.value})}>
                <option value="AKN">AKN</option>
                <option value="BTL">BTL</option>
              </select>
            </div>
            <div className="field"><label className="flabel">POP ID</label><input className="finput" value={editingPOP.pop_id||""} onChange={e=>setEditingPOP({...editingPOP,pop_id:e.target.value})} /></div>
            <div className="field"><label className="flabel">POP Name</label><input className="finput" value={editingPOP.name||""} onChange={e=>setEditingPOP({...editingPOP,name:e.target.value})} /></div>
            <div className="field">
              <label className="flabel">Type</label>
              <select className="finput" value={editingPOP.type||""} onChange={e=>setEditingPOP({...editingPOP,type:e.target.value})}>
                <option value="">Select type…</option>
                <option>Aggregation</option>
                <option>POP</option>
              </select>
            </div>
            <div className="field"><label className="flabel">Latitude</label><input className="finput" type="number" value={editingPOP.lat||""} onChange={e=>setEditingPOP({...editingPOP,lat:e.target.value})} /></div>
            <div className="field"><label className="flabel">Longitude</label><input className="finput" type="number" value={editingPOP.lng||""} onChange={e=>setEditingPOP({...editingPOP,lng:e.target.value})} /></div>
            <div className="field"><label className="flabel">Notes</label><input className="finput" value={editingPOP.notes||""} onChange={e=>setEditingPOP({...editingPOP,notes:e.target.value})} /></div>
          </div>
          <div className="factions">
            <button className="btn-save" onClick={handleUpdate}>Save Changes</button>
            <button className="btn-discard" onClick={()=>setEditingPOP(null)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="tbl-wrap">
        <div className="tbl-hd">
          <span className="tbl-title">POPs <span className="tbl-cnt">{filteredPOPs.length}</span></span>
        </div>
        <div className="tbl-scroll">
          <table>
            <thead><tr>
              <th>#</th>
              <th className="th-sort" onClick={()=>handleSortP("operator")}>Operator<SortIconP col="operator"/></th>
              <th className="th-sort" onClick={()=>handleSortP("pop_id")}>POP ID<SortIconP col="pop_id"/></th>
              <th className="th-sort" onClick={()=>handleSortP("name")}>POP Name<SortIconP col="name"/></th>
              <th className="th-sort" onClick={()=>handleSortP("type")}>Type<SortIconP col="type"/></th>
              <th className="th-sort" onClick={()=>handleSortP("lat")}>Latitude<SortIconP col="lat"/></th>
              <th className="th-sort" onClick={()=>handleSortP("lng")}>Longitude<SortIconP col="lng"/></th>
              <th>Notes</th>
              <th>Actions</th>
            </tr></thead>
            <tbody>
              {filteredPOPs.length===0 ? (
                <tr><td colSpan={9} className="empty">{search||filterOp!=="ALL" ? "No POPs match your search" : "No POPs added yet"}</td></tr>
              ) : filteredPOPs.map((p,i)=>(
                <tr key={p.id}>
                  <td className="num">{i+1}</td>
                  <td><span style={{fontSize:11,fontWeight:700,padding:"2px 9px",borderRadius:4,background:p.operator==="AKN"?"#dbeafe":p.operator==="BTL"?"#dcfce7":"#f1f5f9",color:p.operator==="AKN"?"#2563eb":p.operator==="BTL"?"#16a34a":"#64748b"}}>{p.operator||"—"}</span></td>
                  <td><span className="lid">{p.pop_id}</span></td>
                  <td className="bold">{p.name}</td>
                  <td>{typeChip(p.type)}</td>
                  <td className="muted">{p.lat != null ? Number(p.lat).toFixed(5) : "—"}</td>
                  <td className="muted">{p.lng != null ? Number(p.lng).toFixed(5) : "—"}</td>
                  <td className="muted notes-cell">{p.notes||"—"}</td>
                  <td style={{display:"flex",gap:6}}>
                    <button className="edit-btn" onClick={()=>{setEditingPOP(p);setShowForm(false);}}>Edit</button>
                    <button className="del-btn"  onClick={()=>handleDelete(p.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="tbl-foot">{filteredPOPs.length} of {pops.length} POP{pops.length!==1?"s":""}</div>
      </div>
    </div>
  );
}

// ─── Shared components ────────────────────────────────────────────
function F({ label, name, val, onChange, placeholder, type="text", required }) {
  return (
    <div className="field">
      <label className="flabel">{label}</label>
      <input className="finput" name={name} value={val} onChange={onChange} placeholder={placeholder} type={type} required={required} />
    </div>
  );
}

function Sel({ label, name, val, onChange, opts, placeholderOpt }) {
  return (
    <div className="field">
      <label className="flabel">{label}</label>
      <select className="finput" name={name} value={val} onChange={onChange}>
        {placeholderOpt && <option value="">{placeholderOpt}</option>}
        {opts.map(o=><option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function Badge({ status }) {
  const s = status?.toUpperCase();
  const m = {
    ACTIVE:    {color:"#15803d",bg:"#f0fdf4",border:"#bbf7d0"},
    PENDING:   {color:"#b45309",bg:"#fffbeb",border:"#fde68a"},
    CANCELLED: {color:"#b91c1c",bg:"#fef2f2",border:"#fecaca"},
  };
  const st = m[s]||{color:"#64748b",bg:"#f8fafc",border:"#e2e8f0"};
  return (
    <span style={{color:st.color,background:st.bg,border:`1px solid ${st.border}`,padding:"3px 9px",borderRadius:20,fontSize:11,fontWeight:600,display:"inline-flex",alignItems:"center",gap:4,whiteSpace:"nowrap"}}>
      <span style={{width:5,height:5,borderRadius:"50%",background:st.color,flexShrink:0}}></span>{s}
    </span>
  );
}

// ─── Utilization Update Modal ─────────────────────────────────────
function UtilModal({ link, onClose, onSave }) {
  const [mbps,   setMbps]   = useState("");
  const [by,     setBy]     = useState("NOC");
  const [saving, setSaving] = useState(false);

  const today     = new Date();
  const sevenAgo  = new Date(today); sevenAgo.setDate(today.getDate() - 7);
  const fmt       = d => d.toISOString().slice(0, 10);
  const periodTo   = fmt(today);
  const periodFrom = fmt(sevenAgo);

  const pct = (mbps && link.quantity_mbps)
    ? Math.round(Number(mbps) / link.quantity_mbps * 100)
    : null;
  const gap = (mbps && link.quantity_mbps)
    ? (link.quantity_mbps - Number(mbps)).toFixed(0)
    : null;
  const barColor = pct >= 90 ? "#dc2626" : pct >= 70 ? "#d97706" : "#16a34a";

  const handleSave = async () => {
    if (!mbps) return;
    setSaving(true);
    await onSave(mbps, by, periodFrom, periodTo);
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:420}} onClick={e=>e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="modal-title">Usage Update</div>
            <div style={{fontFamily:"var(--font-mono)",fontSize:12,color:"#4f46e5",marginTop:2}}>{link.link_id}</div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-section">
          <div style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:8,padding:"10px 14px",marginBottom:16,display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <div>
              <div style={{fontSize:10,color:"#94a3b8",fontWeight:600,marginBottom:2}}>AGGREGATION</div>
              <div style={{fontSize:13,fontWeight:600,color:"#0f172a"}}>{link.aggregation||"—"}</div>
            </div>
            <div>
              <div style={{fontSize:10,color:"#94a3b8",fontWeight:600,marginBottom:2}}>TO LOCATION</div>
              <div style={{fontSize:13,fontWeight:600,color:"#0f172a"}}>{link.to_location}</div>
            </div>
            <div>
              <div style={{fontSize:10,color:"#94a3b8",fontWeight:600,marginBottom:2}}>CAPACITY</div>
              <div style={{fontSize:13,fontWeight:600,color:"#4f46e5"}}>{link.quantity_mbps ? `${link.quantity_mbps} Mbps` : "—"}</div>
            </div>
            <div>
              <div style={{fontSize:10,color:"#94a3b8",fontWeight:600,marginBottom:2}}>TYPE</div>
              <div style={{fontSize:13,color:"#475569"}}>{link.type||"—"}</div>
            </div>
          </div>

          <div className="field" style={{marginBottom:12}}>
            <label className="flabel">Max Usage — Last 7 Days (Mbps)</label>
            <input className="finput" type="number" placeholder="e.g. 1200" value={mbps}
              onChange={e=>setMbps(e.target.value)} autoFocus />
          </div>

          {mbps && link.quantity_mbps && (
            <div style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:8,padding:"12px 14px",marginBottom:12}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                <span style={{fontSize:12,fontWeight:600,color:barColor}}>{pct}% utilized</span>
                <span style={{fontSize:12,color: gap<0?"#dc2626":"#16a34a",fontWeight:600}}>
                  {gap<0 ? `⚠ Over capacity by ${Math.abs(gap)} Mbps` : `${gap} Mbps headroom`}
                </span>
              </div>
              <div style={{height:8,background:"#e2e8f0",borderRadius:4,overflow:"hidden"}}>
                <div style={{width:`${Math.min(pct,100)}%`,height:"100%",background:barColor,borderRadius:4,transition:"width .3s"}}></div>
              </div>
              {pct >= 90 && <div style={{marginTop:6,fontSize:11,color:"#dc2626",fontWeight:600}}>⚠ Critical — above 90% capacity</div>}
              {pct >= 70 && pct < 90 && <div style={{marginTop:6,fontSize:11,color:"#d97706",fontWeight:600}}>⚡ Warning — above 70% capacity</div>}
            </div>
          )}

          <div style={{display:"flex",gap:8,alignItems:"center",padding:"8px 12px",background:"#f8fafc",borderRadius:7,border:"1px solid #e2e8f0"}}>
            <span style={{fontSize:11,color:"#94a3b8",fontWeight:600}}>PERIOD</span>
            <span style={{fontSize:12,color:"#475569",fontFamily:"var(--font-mono)"}}>{periodFrom}</span>
            <span style={{fontSize:11,color:"#94a3b8"}}>→</span>
            <span style={{fontSize:12,color:"#475569",fontFamily:"var(--font-mono)"}}>{periodTo}</span>
            <span style={{fontSize:10,color:"#94a3b8",marginLeft:"auto"}}>auto</span>
          </div>

          <div className="field">
            <label className="flabel">Reported By</label>
            <input className="finput" placeholder="e.g. Rahul, NOC Team" value={by} onChange={e=>setBy(e.target.value)} />
          </div>
        </div>

        <div className="modal-foot">
          <button className="btn-discard" onClick={onClose}>Cancel</button>
          <button className="btn-save" disabled={!mbps||saving} style={{opacity:!mbps?0.5:1}}
            onClick={handleSave}>
            {saving ? "Saving…" : "Submit Usage Update"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Login Page ───────────────────────────────────────────────────
function LoginPage({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [remember, setRemember] = useState(true);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const r = await API.post("/auth/login", { username, password });
      onLogin({ username: r.data.username, role: r.data.role, token: r.data.access_token });
    } catch(err) {
      setError(err.response?.data?.detail || "Login failed");
    }
    setLoading(false);
  };

  return (
    <>
      <style>{LOGIN_CSS}</style>
      <div className="login-page">
        <svg className="login-bg" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" viewBox="0 0 800 540">
          <defs>
            <pattern id="netgrid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#6366F1" strokeWidth="0.4" opacity="0.3" />
            </pattern>
            <radialGradient id="bgglow1" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#6366F1" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#6366F1" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="bgglow2" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#22D3EE" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="bgglow3" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#A78BFA" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#A78BFA" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#netgrid)" />
          <circle cx="120" cy="100" r="200" fill="url(#bgglow1)" />
          <circle cx="680" cy="440" r="220" fill="url(#bgglow2)" />
          <circle cx="700" cy="80" r="160" fill="url(#bgglow3)" />
          <g stroke="#6366F1" strokeWidth="0.6" opacity="0.5">
            <line x1="60"  y1="80"  x2="180" y2="160" />
            <line x1="180" y1="160" x2="320" y2="90"  />
            <line x1="320" y1="90"  x2="460" y2="180" />
            <line x1="460" y1="180" x2="600" y2="120" />
            <line x1="600" y1="120" x2="730" y2="220" />
            <line x1="60"  y1="80"  x2="100" y2="280" />
            <line x1="100" y1="280" x2="260" y2="380" />
            <line x1="260" y1="380" x2="430" y2="450" />
            <line x1="430" y1="450" x2="600" y2="390" />
            <line x1="600" y1="390" x2="730" y2="470" />
            <line x1="180" y1="160" x2="100" y2="280" />
            <line x1="320" y1="90"  x2="260" y2="380" />
            <line x1="460" y1="180" x2="430" y2="450" />
            <line x1="600" y1="120" x2="600" y2="390" />
            <line x1="60"  y1="80"  x2="320" y2="90"  />
            <line x1="730" y1="220" x2="730" y2="470" />
          </g>
          <g>
            <circle cx="60"  cy="80"  r="2.5" fill="#A78BFA" />
            <circle cx="180" cy="160" r="2.5" fill="#A78BFA" />
            <circle cx="320" cy="90"  r="2.5" fill="#22D3EE" />
            <circle cx="460" cy="180" r="2.5" fill="#A78BFA" />
            <circle cx="600" cy="120" r="2.5" fill="#22D3EE" />
            <circle cx="730" cy="220" r="2.5" fill="#A78BFA" />
            <circle cx="100" cy="280" r="2.5" fill="#22D3EE" />
            <circle cx="260" cy="380" r="2.5" fill="#A78BFA" />
            <circle cx="430" cy="450" r="2.5" fill="#22D3EE" />
            <circle cx="600" cy="390" r="2.5" fill="#A78BFA" />
            <circle cx="730" cy="470" r="2.5" fill="#22D3EE" />
          </g>
          <circle cx="320" cy="90" r="4" fill="none" stroke="#22D3EE" strokeWidth="1">
            <animate attributeName="r" values="4;20;4" dur="3s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.8;0;0.8" dur="3s" repeatCount="indefinite" />
          </circle>
          <circle cx="430" cy="450" r="4" fill="none" stroke="#22D3EE" strokeWidth="1">
            <animate attributeName="r" values="4;20;4" dur="3s" begin="1s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.8;0;0.8" dur="3s" begin="1s" repeatCount="indefinite" />
          </circle>
          <circle cx="100" cy="280" r="4" fill="none" stroke="#A78BFA" strokeWidth="1">
            <animate attributeName="r" values="4;20;4" dur="3s" begin="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.8;0;0.8" dur="3s" begin="2s" repeatCount="indefinite" />
          </circle>
          <circle cx="600" cy="120" r="4" fill="none" stroke="#22D3EE" strokeWidth="1">
            <animate attributeName="r" values="4;18;4" dur="3.5s" begin="0.5s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.8;0;0.8" dur="3.5s" begin="0.5s" repeatCount="indefinite" />
          </circle>
          <circle r="3" fill="#22D3EE">
            <animateMotion dur="4s" repeatCount="indefinite" path="M 60 80 L 180 160 L 320 90 L 460 180 L 600 120" />
          </circle>
          <circle r="3" fill="#A78BFA">
            <animateMotion dur="5s" repeatCount="indefinite" path="M 60 80 L 100 280 L 260 380 L 430 450 L 600 390 L 730 470" />
          </circle>
          <circle r="2.5" fill="#22D3EE">
            <animateMotion dur="3.5s" begin="1.5s" repeatCount="indefinite" path="M 180 160 L 320 90 L 460 180" />
          </circle>
          <circle r="2.5" fill="#A78BFA">
            <animateMotion dur="4.5s" begin="2s" repeatCount="indefinite" path="M 260 380 L 430 450 L 600 390 L 730 470" />
          </circle>
        </svg>

        <div className="login-card">
          <div className="login-brand">
            <div className="login-logo">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" />
              </svg>
            </div>
            <div>
              <div className="login-brand-title">ISP Panel</div>
              <div className="login-brand-sub">Network Operations</div>
            </div>
          </div>

          <h3 className="login-heading">Welcome back</h3>
          <p className="login-subheading">Sign in to your operator account</p>

          <form onSubmit={handleLogin}>
            <label className="login-label">USERNAME</label>
            <input type="text" className="login-input" value={username} onChange={e=>setUsername(e.target.value)} placeholder="your_username" autoComplete="username" autoFocus required />

            <label className="login-label">PASSWORD</label>
            <input type="password" className="login-input" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" required />

            <div className="login-row">
              <label className="login-remember">
                <input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)} />
                Remember me
              </label>
              <a href="#" className="login-forgot" onClick={e=>e.preventDefault()}>Forgot?</a>
            </div>

            {error && <div className="login-error">{error}</div>}

            <button type="submit" disabled={loading} className="login-button">
              {loading ? "Signing in…" : "Sign in →"}
            </button>
          </form>

          <div className="login-footer">SECURED BY ISP PANEL © 2026</div>
        </div>
      </div>
    </>
  );
}

// ─── Users Page ───────────────────────────────────────────────────
function UsersPage() {
  const [users, setUsers]       = useState([]);
  const [showForm, setShowForm]  = useState(false);
  const [form, setForm]          = useState({username:"",password:"",role:"NOC"});
  const [search, setSearch]      = useState("");
  const [editUser, setEditUser]  = useState(null);
  const [editForm, setEditForm]  = useState({username:"",password:"",role:"NOC"});

  useEffect(() => { fetchUsers(); }, []);
  const fetchUsers = async () => { const r = await API.get("/users/"); setUsers(r.data); };

  const handleSubmit = async e => {
    e.preventDefault();
    try {
      await API.post("/users/", form);
      fetchUsers(); setShowForm(false); setForm({username:"",password:"",role:"NOC"});
    } catch(err) { alert(err.response?.data?.detail||"Error"); }
  };

  const openEdit = (u) => {
    setEditUser(u);
    setEditForm({username: u.username, password: "", role: u.role});
  };

  const handleEditSubmit = async e => {
    e.preventDefault();
    try {
      const payload = {username: editForm.username, role: editForm.role};
      if (editForm.password) payload.password = editForm.password;
      await API.put(`/users/${editUser.id}`, payload);
      fetchUsers(); setEditUser(null);
    } catch(err) { alert(err.response?.data?.detail||"Error"); }
  };

  const handleDelete = async (u) => {
    if (!window.confirm(`Delete user "${u.username}"? This cannot be undone.`)) return;
    try {
      await API.delete(`/users/${u.id}`);
      fetchUsers();
    } catch(err) { alert(err.response?.data?.detail||"Error"); }
  };

  const filtered = users.filter(u => !search || u.username.toLowerCase().includes(search.toLowerCase()) || u.role.toLowerCase().includes(search.toLowerCase()));

  const roleStyle = (r) => ({
    ADMIN:    {bg:"#eef2ff",color:"#4f46e5"},
    NOC:      {bg:"#f0fdf4",color:"#16a34a"},
    ACCOUNTS: {bg:"#fffbeb",color:"#b45309"},
    PARTNER:  {bg:"#f5f3ff",color:"#7c3aed"},
    KAM:      {bg:"#f8fafc",color:"#64748b"},
  }[r]||{bg:"#f8fafc",color:"#64748b"});

  return (
    <div className="page-col">
      <div className="toolbar">
        <div className="search-wrap">
          <span className="search-icon">⌕</span>
          <input className="search-input" placeholder="Search users…" value={search} onChange={e=>setSearch(e.target.value)} />
        </div>
        <button className="btn-add" onClick={()=>{ setShowForm(!showForm); setEditUser(null); }}>{showForm?"✕ Close":"+ Add User"}</button>
      </div>

      {showForm && (
        <div className="form-box">
          <div className="form-head"><b>Add User</b></div>
          <form onSubmit={handleSubmit}>
            <div className="fg fg-5">
              <F label="Username" name="username" val={form.username} onChange={e=>setForm({...form,username:e.target.value})} placeholder="username" required />
              <F label="Password" name="password" val={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="password" type="password" required />
              <div className="field">
                <label className="flabel">Role</label>
                <select className="finput" value={form.role} onChange={e=>setForm({...form,role:e.target.value})}>
                  {["ADMIN","NOC","ACCOUNTS","KAM","CLIENT"].map(r=><option key={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div className="factions">
              <button type="submit" className="btn-save">Create User</button>
              <button type="button" className="btn-discard" onClick={()=>setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {editUser && (
        <div className="form-box" style={{borderLeft:"3px solid #f59e0b"}}>
          <div className="form-head"><b>Edit User</b> <span style={{fontWeight:400,color:"var(--color-text-secondary)"}}>— {editUser.username}</span></div>
          <form onSubmit={handleEditSubmit}>
            <div className="fg fg-5">
              <F label="Username" name="username" val={editForm.username} onChange={e=>setEditForm({...editForm,username:e.target.value})} placeholder="username" required />
              <F label="New Password" name="password" val={editForm.password} onChange={e=>setEditForm({...editForm,password:e.target.value})} placeholder="leave blank to keep" type="password" />
              <div className="field">
                <label className="flabel">Role</label>
                <select className="finput" value={editForm.role} onChange={e=>setEditForm({...editForm,role:e.target.value})}>
                  {["ADMIN","NOC","ACCOUNTS","KAM","CLIENT"].map(r=><option key={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div className="factions">
              <button type="submit" className="btn-save">Save Changes</button>
              <button type="button" className="btn-discard" onClick={()=>setEditUser(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="tbl-wrap">
        <div className="tbl-hd"><span className="tbl-title">Users <span className="tbl-cnt">{filtered.length}</span></span></div>
        <div className="tbl-scroll">
          <table>
            <thead><tr><th>#</th><th>Username</th><th>Role</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.map((u,i) => {
                const rs = roleStyle(u.role);
                const isEditing = editUser?.id === u.id;
                return (
                  <tr key={u.id} style={isEditing ? {background:"#fffbeb"} : {}}>
                    <td className="num">{i+1}</td>
                    <td className="bold">{u.username}</td>
                    <td><span style={{fontSize:11,fontWeight:700,padding:"2px 10px",borderRadius:20,background:rs.bg,color:rs.color}}>{u.role}</span></td>
                    <td>
                      <div style={{display:"flex",gap:6}}>
                        <button onClick={()=>{ setShowForm(false); openEdit(u); }} style={{fontSize:12,padding:"3px 10px",borderRadius:6,border:"1px solid #d1d5db",background:isEditing?"#fef3c7":"#fff",color:"#374151",cursor:"pointer",fontWeight:500}}>✏️ Edit</button>
                        <button onClick={()=>handleDelete(u)} style={{fontSize:12,padding:"3px 10px",borderRadius:6,border:"1px solid #fca5a5",background:"#fff",color:"#dc2626",cursor:"pointer",fontWeight:500}}>🗑 Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="tbl-foot">{filtered.length} of {users.length} users</div>
      </div>
    </div>
  );
}

// ─── KAMs Page ────────────────────────────────────────────────────
function KAMsPage({ kams, fetchKams }) {
  const [showForm, setShowForm]     = useState(false);
  const [editingKAM, setEditingKAM] = useState(null);
  const [form, setForm] = useState({username:"",password:"",kam_id:"",name:"",mobile:"",nid:"",address:""});
  const EMPTY_KAM = {username:"",password:"",kam_id:"",name:"",mobile:"",nid:"",address:""};

  const handleSubmit = async e => {
    e.preventDefault();
    try { await API.post("/kams/", form); fetchKams(); setShowForm(false); setForm(EMPTY_KAM); }
    catch(err) { alert(err.response?.data?.detail||"Error"); }
  };

  const handleUpdate = async () => {
    try { await API.put(`/kams/${editingKAM.id}`, {name:editingKAM.name,mobile:editingKAM.mobile,nid:editingKAM.nid,address:editingKAM.address}); fetchKams(); setEditingKAM(null); }
    catch(err) { alert(err.response?.data?.detail||"Error"); }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this KAM and their login account?")) return;
    await API.delete(`/kams/${id}`); fetchKams();
  };

  return (
    <div className="page-col">
      <div className="toolbar">
        <span className="section-title">Key Account Managers</span>
        <button className="btn-add" onClick={()=>{setShowForm(!showForm);setEditingKAM(null);}}>{showForm?"✕ Close":"+ Add KAM"}</button>
      </div>

      {showForm && (
        <div className="form-box">
          <div className="form-head"><b>Add KAM</b> <span style={{fontSize:11,color:"#94a3b8"}}>— creates login account automatically</span></div>
          <form onSubmit={handleSubmit}>
            <div className="fg fg-5">
              <F label="KAM ID"   name="kam_id"   val={form.kam_id}   onChange={e=>setForm({...form,kam_id:e.target.value})}   placeholder="KAM-001" required />
              <F label="Full Name" name="name"    val={form.name}     onChange={e=>setForm({...form,name:e.target.value})}     placeholder="Name" required />
              <F label="Mobile"   name="mobile"   val={form.mobile}   onChange={e=>setForm({...form,mobile:e.target.value})}   placeholder="01XXXXXXXXX" />
              <F label="NID"      name="nid"      val={form.nid}      onChange={e=>setForm({...form,nid:e.target.value})}      placeholder="NID number" />
              <F label="Address"  name="address"  val={form.address}  onChange={e=>setForm({...form,address:e.target.value})}  placeholder="Address" />
              <F label="Username (login)" name="username" val={form.username} onChange={e=>setForm({...form,username:e.target.value})} placeholder="kam_login" required />
              <F label="Password"  name="password" val={form.password}  onChange={e=>setForm({...form,password:e.target.value})}  placeholder="password" type="password" required />
            </div>
            <div className="factions">
              <button type="submit" className="btn-save">Save KAM</button>
              <button type="button" className="btn-discard" onClick={()=>setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {editingKAM && (
        <div className="form-box edit-box">
          <div className="form-head"><b>Edit KAM</b> — <span className="edit-id">{editingKAM.kam_id}</span></div>
          <div className="fg fg-5">
            {[{l:"Full Name",k:"name"},{l:"Mobile",k:"mobile"},{l:"NID",k:"nid"},{l:"Address",k:"address"}].map(f=>(
              <div className="field" key={f.k}>
                <label className="flabel">{f.l}</label>
                <input className="finput" value={editingKAM[f.k]||""} onChange={e=>setEditingKAM({...editingKAM,[f.k]:e.target.value})} />
              </div>
            ))}
          </div>
          <div className="factions">
            <button className="btn-save" onClick={handleUpdate}>Save</button>
            <button className="btn-discard" onClick={()=>setEditingKAM(null)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="tbl-wrap">
        <div className="tbl-hd"><span className="tbl-title">KAMs <span className="tbl-cnt">{kams.length}</span></span></div>
        <div className="tbl-scroll">
          <table>
            <thead><tr><th>#</th><th>KAM ID</th><th>Name</th><th>Mobile</th><th>NID</th><th>Address</th><th>Username</th><th>Actions</th></tr></thead>
            <tbody>
              {kams.length===0 ? <tr><td colSpan={8} className="empty">No KAMs yet</td></tr>
              : kams.map((k,i)=>(
                <tr key={k.id}>
                  <td className="num">{i+1}</td>
                  <td><span className="lid">{k.kam_id}</span></td>
                  <td className="bold">{k.name}</td>
                  <td className="muted">{k.mobile||"—"}</td>
                  <td className="muted">{k.nid||"—"}</td>
                  <td className="muted notes-cell">{k.address||"—"}</td>
                  <td className="muted">{k.username||"—"}</td>
                  <td style={{display:"flex",gap:5}}>
                    <button className="edit-btn" onClick={()=>{setEditingKAM(k);setShowForm(false);}}>Edit</button>
                    <button className="del-btn" onClick={()=>handleDelete(k.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="tbl-foot">{kams.length} KAM{kams.length!==1?"s":""}</div>
      </div>
    </div>
  );
}

// ─── Partners Page ────────────────────────────────────────────────
function PartnersPage({ partners, kams, fetchPartners }) {
  const [showForm, setShowForm]         = useState(false);
  const [editingPartner, setEditingP]   = useState(null);
  const EMPTY_P = {username:"",password:"",partner_id:"",name:"",mobile:"",address:"",kam_id:""};
  const [form, setForm] = useState(EMPTY_P);

  const handleSubmit = async e => {
    e.preventDefault();
    try {
      await API.post("/partners/", {...form, kam_id: form.kam_id ? Number(form.kam_id) : null});
      fetchPartners(); setShowForm(false); setForm(EMPTY_P);
    } catch(err) { alert(err.response?.data?.detail||"Error"); }
  };

  const handleUpdate = async () => {
    try {
      await API.put(`/partners/${editingPartner.id}`, {name:editingPartner.name,mobile:editingPartner.mobile,address:editingPartner.address,kam_id:editingPartner.kam_id?Number(editingPartner.kam_id):null});
      fetchPartners(); setEditingP(null);
    } catch(err) { alert(err.response?.data?.detail||"Error"); }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this partner and their login?")) return;
    await API.delete(`/partners/${id}`); fetchPartners();
  };

  return (
    <div className="page-col">
      <div className="toolbar">
        <span className="section-title">Partners</span>
        <button className="btn-add" onClick={()=>{setShowForm(!showForm);setEditingP(null);}}>{showForm?"✕ Close":"+ Add Partner"}</button>
      </div>

      {showForm && (
        <div className="form-box">
          <div className="form-head"><b>Add Partner</b> <span style={{fontSize:11,color:"#94a3b8"}}>— creates login account automatically</span></div>
          <form onSubmit={handleSubmit}>
            <div className="fg fg-5">
              <F label="Partner ID" name="partner_id" val={form.partner_id} onChange={e=>setForm({...form,partner_id:e.target.value})} placeholder="PTR-001" required />
              <F label="Name"       name="name"       val={form.name}       onChange={e=>setForm({...form,name:e.target.value})}       placeholder="Company / Person" required />
              <F label="Mobile"     name="mobile"     val={form.mobile}     onChange={e=>setForm({...form,mobile:e.target.value})}     placeholder="01XXXXXXXXX" />
              <F label="Address"    name="address"    val={form.address}    onChange={e=>setForm({...form,address:e.target.value})}    placeholder="Address" />
              <div className="field">
                <label className="flabel">KAM</label>
                <select className="finput" value={form.kam_id} onChange={e=>setForm({...form,kam_id:e.target.value})}>
                  <option value="">Select KAM…</option>
                  {kams.map(k=><option key={k.id} value={k.id}>{k.name} ({k.kam_id})</option>)}
                </select>
              </div>
              <F label="Username (login)" name="username" val={form.username} onChange={e=>setForm({...form,username:e.target.value})} placeholder="partner_login" required />
              <F label="Password"         name="password" val={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="password" type="password" required />
            </div>
            <div className="factions">
              <button type="submit" className="btn-save">Save Partner</button>
              <button type="button" className="btn-discard" onClick={()=>setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {editingPartner && (
        <div className="form-box edit-box">
          <div className="form-head"><b>Edit Partner</b> — <span className="edit-id">{editingPartner.partner_id}</span></div>
          <div className="fg fg-5">
            {[{l:"Name",k:"name"},{l:"Mobile",k:"mobile"},{l:"Address",k:"address"}].map(f=>(
              <div className="field" key={f.k}>
                <label className="flabel">{f.l}</label>
                <input className="finput" value={editingPartner[f.k]||""} onChange={e=>setEditingP({...editingPartner,[f.k]:e.target.value})} />
              </div>
            ))}
            <div className="field">
              <label className="flabel">KAM</label>
              <select className="finput" value={editingPartner.kam_id||""} onChange={e=>setEditingP({...editingPartner,kam_id:e.target.value})}>
                <option value="">No KAM</option>
                {kams.map(k=><option key={k.id} value={k.id}>{k.name} ({k.kam_id})</option>)}
              </select>
            </div>
          </div>
          <div className="factions">
            <button className="btn-save" onClick={handleUpdate}>Save</button>
            <button className="btn-discard" onClick={()=>setEditingP(null)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="tbl-wrap">
        <div className="tbl-hd"><span className="tbl-title">Partners <span className="tbl-cnt">{partners.length}</span></span></div>
        <div className="tbl-scroll">
          <table>
            <thead><tr><th>#</th><th>Partner ID</th><th>Name</th><th>Mobile</th><th>Address</th><th>KAM</th><th>Username</th><th>Actions</th></tr></thead>
            <tbody>
              {partners.length===0 ? <tr><td colSpan={8} className="empty">No partners yet</td></tr>
              : partners.map((p,i)=>(
                <tr key={p.id}>
                  <td className="num">{i+1}</td>
                  <td><span className="lid">{p.partner_id}</span></td>
                  <td className="bold">{p.name}</td>
                  <td className="muted">{p.mobile||"—"}</td>
                  <td className="muted notes-cell">{p.address||"—"}</td>
                  <td className="muted">{p.kam_name||"—"}</td>
                  <td className="muted">{p.username||"—"}</td>
                  <td style={{display:"flex",gap:5}}>
                    <button className="edit-btn" onClick={()=>{setEditingP(p);setShowForm(false);}}>Edit</button>
                    <button className="del-btn" onClick={()=>handleDelete(p.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="tbl-foot">{partners.length} partner{partners.length!==1?"s":""}</div>
      </div>
    </div>
  );
}

// ─── Request Modal ────────────────────────────────────────────────
function RequestModal({ link, user, onClose, onSave, initialType }) {
  const [reqType,  setReqType]  = useState(initialType || "UPGRADE");
  const [changeMbps, setChangeMbps] = useState("");
  const role = user?.role || "NOC";
  const [reqBy,    setReqBy]    = useState("");
  const [saving,   setSaving]   = useState(false);

  const current  = link.quantity_mbps || 0;
  const change   = Number(changeMbps) || 0;
  const newTotal = reqType === "UPGRADE"   ? current + change
                 : reqType === "DOWNGRADE" ? Math.max(0, current - change)
                 : 0;

  const isPartnerRestricted = role === "PARTNER" && (reqType === "DOWNGRADE" || reqType === "TERMINATE");
  const minDate = new Date(Date.now() + 30*864e5).toISOString().slice(0,10);
  const [partnerDate, setPartnerDate] = useState(minDate);

  const typeColors = { UPGRADE:"#16a34a", DOWNGRADE:"#d97706", TERMINATE:"#dc2626" };
  const color = typeColors[reqType];

  const handleSave = async () => {
    if (!reqBy) return;
    if (reqType !== "TERMINATE" && !changeMbps) return;
    setSaving(true);
    await onSave({
      link_id:        link.id,
      request_type:   reqType,
      change_mbps:    reqType === "TERMINATE" ? null : change,
      requested_by:   reqBy,
      requested_role: role,
      effective_date: isPartnerRestricted ? partnerDate : null,
    });
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:440}} onClick={e=>e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="modal-title">Change Request</div>
            <div style={{fontFamily:"var(--font-mono)",fontSize:12,color:"#4f46e5",marginTop:2}}>{link.link_id}</div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-section">
          <div style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:8,padding:"10px 14px",marginBottom:16,display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <div><div style={{fontSize:10,color:"#94a3b8",fontWeight:600,marginBottom:2}}>AGGREGATION</div><div style={{fontSize:13,fontWeight:600,color:"#0f172a"}}>{link.aggregation||"—"}</div></div>
            <div><div style={{fontSize:10,color:"#94a3b8",fontWeight:600,marginBottom:2}}>TO LOCATION</div><div style={{fontSize:13,fontWeight:600,color:"#0f172a"}}>{link.to_location}</div></div>
            <div><div style={{fontSize:10,color:"#94a3b8",fontWeight:600,marginBottom:2}}>CURRENT CAPACITY</div><div style={{fontSize:13,fontWeight:600,color:"#4f46e5"}}>{current} Mbps</div></div>
            <div><div style={{fontSize:10,color:"#94a3b8",fontWeight:600,marginBottom:2}}>TYPE</div><div style={{fontSize:13,color:"#475569"}}>{link.type||"—"}</div></div>
          </div>

          <div style={{marginBottom:14}}>
            <label className="flabel" style={{marginBottom:8,display:"block"}}>Request Type</label>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
              {[
                {t:"UPGRADE",   label:"Upgrade",   desc:"Increase capacity"},
                {t:"DOWNGRADE", label:"Downgrade", desc:"Reduce capacity"},
                {t:"TERMINATE", label:"Terminate", desc:"Cancel link"},
              ].map(opt=>(
                <div key={opt.t}
                  onClick={()=>setReqType(opt.t)}
                  style={{padding:"10px 8px",borderRadius:8,border:`1.5px solid ${reqType===opt.t?typeColors[opt.t]:"#e2e8f0"}`,background:reqType===opt.t?`${typeColors[opt.t]}11`:"#f8fafc",cursor:"pointer",textAlign:"center",transition:"all .15s"}}>
                  <div style={{fontSize:12,fontWeight:700,color:reqType===opt.t?typeColors[opt.t]:"#475569"}}>{opt.label}</div>
                  <div style={{fontSize:10,color:"#94a3b8",marginTop:2}}>{opt.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {reqType !== "TERMINATE" && (
            <div className="field" style={{marginBottom:14}}>
              <label className="flabel">{reqType === "UPGRADE" ? "Upgrade by (Mbps)" : "Downgrade by (Mbps)"}</label>
              <input className="finput" type="number" placeholder="e.g. 500" value={changeMbps} onChange={e=>setChangeMbps(e.target.value)} autoFocus />
            </div>
          )}

          {reqType !== "TERMINATE" && changeMbps && (
            <div style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:8,padding:"10px 14px",marginBottom:14,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontSize:12,color:"#64748b"}}>{current} Mbps <span style={{color:color,fontWeight:700}}>{reqType==="UPGRADE"?`+ ${change}`:`− ${change}`} Mbps</span></div>
              <div style={{fontSize:14,fontWeight:700,color:color}}>{newTotal} Mbps total</div>
            </div>
          )}
          {reqType === "TERMINATE" && (
            <div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:"10px 14px",marginBottom:14}}>
              <div style={{fontSize:12,fontWeight:600,color:"#dc2626"}}>⚠ This will set the link status to CANCELLED after admin confirmation.</div>
            </div>
          )}

          <div className="field">
            <label className="flabel">Submitted As</label>
            <div className="finput" style={{background:"#f1f5f9",fontWeight:600,color:
              role==="ADMIN"?"#4f46e5":role==="NOC"?"#16a34a":role==="KAM"?"#0891b2":role==="ACCOUNTS"?"#b45309":role==="PARTNER"?"#7c3aed":"#64748b"
            }}>{role}</div>
          </div>

          <div className="field">
            <label className="flabel">Your Name / Username</label>
            <input className="finput" placeholder="e.g. Rahul, aknoc_01" value={reqBy} onChange={e=>setReqBy(e.target.value)} />
          </div>
        </div>

        <div className="modal-foot">
          <button className="btn-discard" onClick={onClose}>Cancel</button>
          <button className="btn-save"
            disabled={saving || !reqBy || (reqType!=="TERMINATE" && !changeMbps)}
            style={{opacity:(!reqBy||(reqType!=="TERMINATE"&&!changeMbps))?0.5:1, background:color}}
            onClick={handleSave}>
            {saving ? "Submitting…" : `Submit ${reqType.charAt(0)+reqType.slice(1).toLowerCase()} Request`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Requests Page ────────────────────────────────────────────────
function RequestsPage({ requests, links, fetchRequests, fetchLinks }) {
  const [tab,         setTab]         = useState("BILLING_PENDING");
  const [actionModal, setActionModal] = useState(null);
  const [note,        setNote]        = useState("");
  const [actBy,       setActBy]       = useState("");
  const [saving,      setSaving]      = useState(false);

  const linkMap = Object.fromEntries(links.map(l=>[l.id, l]));

  const tabs = [
    { key:"BILLING_PENDING", label:"Billing Pending" },
    { key:"ADMIN_PENDING",   label:"Admin Pending"   },
    { key:"CONFIRMED",       label:"Confirmed"       },
    { key:"CANCELLED",       label:"Cancelled"       },
    { key:"REJECTED",        label:"Rejected"        },
    { key:"ALL",             label:"All"             },
  ];

  const filtered = tab === "ALL" ? requests : requests.filter(r=>r.status===tab);

  const statusColor = {
    BILLING_PENDING: {color:"#b45309",bg:"#fffbeb",border:"#fde68a"},
    ADMIN_PENDING:   {color:"#7c3aed",bg:"#f5f3ff",border:"#ddd6fe"},
    CONFIRMED:       {color:"#15803d",bg:"#f0fdf4",border:"#bbf7d0"},
    CANCELLED:       {color:"#b91c1c",bg:"#fef2f2",border:"#fecaca"},
    REJECTED:        {color:"#64748b",bg:"#f8fafc",border:"#e2e8f0"},
  };

  const typeColor = { UPGRADE:"#16a34a", DOWNGRADE:"#d97706", TERMINATE:"#dc2626" };

  const handleBillingAction = async (action) => {
    if (!actBy) return;
    if (action === "CANCEL" && !note) return;
    setSaving(true);
    await API.put(`/requests/${actionModal.req.id}/billing`, { action, billing_by: actBy, billing_note: note||null });
    fetchRequests(); fetchLinks();
    setActionModal(null); setNote(""); setActBy("");
    setSaving(false);
  };

  const handleAdminAction = async (action) => {
    if (!actBy) return;
    setSaving(true);
    await API.put(`/requests/${actionModal.req.id}/admin`, { action, admin_by: actBy, admin_note: note||null });
    fetchRequests(); fetchLinks();
    setActionModal(null); setNote(""); setActBy("");
    setSaving(false);
  };

  const buildMsg = (req) => {
    const l = linkMap[req.link_id];
    if (!l) return "";
    const current = l.quantity_mbps || 0;
    const change  = req.change_mbps || 0;
    const total   = req.request_type==="UPGRADE" ? current+change : Math.max(0,current-change);
    if (req.request_type === "TERMINATE") {
      return `Link ID: ${l.link_id}\nCurrent Capacity: ${current} Mbps\nTerminate: Requested\n\nRequested by: ${req.requested_by}`;
    }
    const changeLabel = req.request_type==="UPGRADE" ? `Upgrade: +${change} Mbps` : `Downgrade: −${change} Mbps`;
    return `Link ID: ${l.link_id}\nCurrent Capacity: ${current} Mbps\n${changeLabel}\nTotal Capacity: ${total} Mbps\n\nRequested by: ${req.requested_by}`;
  };

  const daysSince = d => d ? Math.floor((Date.now()-new Date(d).getTime())/(864e5)) : null;

  return (
    <div className="page-col">
      <div className="toolbar">
        <div className="tabs" style={{flexWrap:"wrap"}}>
          {tabs.map(t=>{
            const cnt = t.key==="ALL" ? requests.length : requests.filter(r=>r.status===t.key).length;
            return (
              <button key={t.key} className={`tab ${tab===t.key?"tab-on":""}`} onClick={()=>setTab(t.key)}>
                {t.label} {cnt>0&&<span style={{background:tab===t.key?"#6366f1":"#e2e8f0",color:tab===t.key?"#fff":"#64748b",borderRadius:10,padding:"0 5px",fontSize:10,marginLeft:3}}>{cnt}</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="tbl-wrap">
        <div className="tbl-hd">
          <span className="tbl-title">Requests <span className="tbl-cnt">{filtered.length}</span></span>
        </div>
        <div className="tbl-scroll">
          <table>
            <thead><tr>
              <th>#</th><th>Link ID</th><th>Route</th><th>Request</th><th>Change</th>
              <th>By</th><th>Role</th><th>Effective</th><th>Status</th><th>Submitted</th><th>Actions</th>
            </tr></thead>
            <tbody>
              {filtered.length===0 ? (
                <tr><td colSpan={11} className="empty">No requests found</td></tr>
              ) : filtered.map((req,i)=>{
                const l   = linkMap[req.link_id];
                const st  = statusColor[req.status]||statusColor.REJECTED;
                const tc  = typeColor[req.request_type]||"#475569";
                const ds  = daysSince(req.created_at);
                return (
                  <tr key={req.id}>
                    <td className="num">{i+1}</td>
                    <td><span className="lid">{l?.link_id||req.link_id}</span></td>
                    <td className="muted" style={{fontSize:11}}>{l?.aggregation||"—"} → {l?.to_location||"—"}</td>
                    <td><span style={{fontSize:11,fontWeight:700,color:tc,background:`${tc}18`,padding:"2px 8px",borderRadius:4}}>{req.request_type}</span></td>
                    <td style={{fontSize:12,fontWeight:600,color:tc}}>
                      {req.request_type==="TERMINATE" ? "Terminate" : req.request_type==="UPGRADE" ? `+${req.change_mbps} Mbps` : `−${req.change_mbps} Mbps`}
                    </td>
                    <td className="muted">{req.requested_by}</td>
                    <td><span style={{fontSize:10,fontWeight:600,padding:"2px 7px",borderRadius:4,background:req.requested_role==="NOC"?"#eef2ff":"#f0fdf4",color:req.requested_role==="NOC"?"#4f46e5":"#16a34a"}}>{req.requested_role}</span></td>
                    <td className="muted" style={{fontSize:11}}>{req.effective_date||"—"}</td>
                    <td><span style={{fontSize:11,fontWeight:600,color:st.color,background:st.bg,border:`1px solid ${st.border}`,padding:"2px 9px",borderRadius:20,display:"inline-flex",alignItems:"center",gap:4,whiteSpace:"nowrap"}}><span style={{width:5,height:5,borderRadius:"50%",background:st.color,flexShrink:0}}></span>{req.status.replace("_"," ")}</span></td>
                    <td className="muted" style={{fontSize:11}}>{ds===0?"Today":`${ds}d ago`}</td>
                    <td>
                      <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                        {req.status==="BILLING_PENDING" && (
                          <button className="req-btn" onClick={()=>{setActionModal({req,mode:"billing"});setNote("");setActBy("");}}>Review</button>
                        )}
                        {req.status==="ADMIN_PENDING" && (
                          <>
                            <button className="req-btn" style={{borderColor:"#bbf7d0",color:"#16a34a"}} onClick={()=>{setActionModal({req,mode:"admin",action:"CONFIRM"});setNote("");setActBy("");}}>Confirm</button>
                            <button className="req-btn" style={{borderColor:"#fecaca",color:"#dc2626"}} onClick={()=>{setActionModal({req,mode:"admin",action:"REJECT"});setNote("");setActBy("");}}>Reject</button>
                          </>
                        )}
                        {(req.status==="CONFIRMED"||req.status==="CANCELLED"||req.status==="REJECTED") && (
                          <span style={{fontSize:11,color:"#94a3b8"}}>—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="tbl-foot">{filtered.length} of {requests.length} requests</div>
      </div>

      {actionModal && (
        <div className="modal-overlay" onClick={()=>setActionModal(null)}>
          <div className="modal" style={{maxWidth:440}} onClick={e=>e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <div className="modal-title">
                  {actionModal.mode==="billing" ? "Billing Review" : actionModal.action==="CONFIRM" ? "Admin Confirm" : "Admin Reject"}
                </div>
                <div style={{fontFamily:"var(--font-mono)",fontSize:12,color:"#4f46e5",marginTop:2}}>
                  {linkMap[actionModal.req.link_id]?.link_id}
                </div>
              </div>
              <button className="modal-close" onClick={()=>setActionModal(null)}>✕</button>
            </div>

            <div className="modal-section">
              <div style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:8,padding:"12px 14px",marginBottom:14}}>
                <div style={{fontSize:10,color:"#94a3b8",fontWeight:600,marginBottom:8,letterSpacing:.4}}>MESSAGE PREVIEW</div>
                <pre style={{fontSize:12,color:"#1e293b",fontFamily:"var(--font-mono)",lineHeight:1.7,margin:0,whiteSpace:"pre-wrap"}}>{buildMsg(actionModal.req)}</pre>
              </div>

              <div className="field" style={{marginBottom:12}}>
                <label className="flabel">
                  {actionModal.mode==="billing" && actionModal.req.status==="BILLING_PENDING" ? "Note (required if cancelling)" : "Note (optional)"}
                </label>
                <textarea className="finput" rows={3} style={{resize:"vertical"}} placeholder="Add a note…" value={note} onChange={e=>setNote(e.target.value)} />
              </div>

              <div className="field">
                <label className="flabel">Your Name</label>
                <input className="finput" placeholder="e.g. Accounts Team" value={actBy} onChange={e=>setActBy(e.target.value)} />
              </div>
            </div>

            <div className="modal-foot">
              <button className="btn-discard" onClick={()=>setActionModal(null)}>Close</button>
              {actionModal.mode==="billing" && (
                <>
                  <button className="btn-discard" style={{borderColor:"#fecaca",color:"#dc2626"}} disabled={!actBy||!note||saving}
                    onClick={()=>handleBillingAction("CANCEL")}>
                    Cancel Request
                  </button>
                  <button className="btn-save" disabled={!actBy||saving} onClick={()=>handleBillingAction("APPROVE")}>
                    Approve →
                  </button>
                </>
              )}
              {actionModal.mode==="admin" && actionModal.action==="CONFIRM" && (
                <button className="btn-save" disabled={!actBy||saving} onClick={()=>handleAdminAction("CONFIRM")}>
                  Confirm & Apply
                </button>
              )}
              {actionModal.mode==="admin" && actionModal.action==="REJECT" && (
                <button className="btn-save" style={{background:"#dc2626"}} disabled={!actBy||saving} onClick={()=>handleAdminAction("REJECT")}>
                  Reject Request
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Export Modal ─────────────────────────────────────────────────
const LINK_COLS = [
  { key:"link_id",           label:"Link ID" },
  { key:"owner",             label:"Owner" },
  { key:"type",              label:"Type" },
  { key:"aggregation",       label:"Aggregation" },
  { key:"to_location",       label:"To Location" },
  { key:"quantity_mbps",     label:"Bandwidth (Mbps)" },
  { key:"vlan",              label:"VLAN" },
  { key:"commissioning_date",label:"Date" },
  { key:"status",            label:"Status" },
  { key:"notes",             label:"Notes" },
  { key:"max_usage",         label:"Max Usage (Mbps)" },
  { key:"capacity_gap",      label:"Capacity Gap (Mbps)" },
  { key:"last_usage_updated",label:"Last Usage Updated" },
  { key:"usage_updated_by",  label:"Updated By" },
];

const POP_COLS = [
  { key:"operator", label:"Operator" },
  { key:"pop_id",   label:"POP ID" },
  { key:"name",     label:"POP Name" },
  { key:"type",     label:"Type" },
  { key:"lat",      label:"Latitude" },
  { key:"lng",      label:"Longitude" },
  { key:"notes",    label:"Notes" },
];

function ExportModal({ data, allCols, title, filterField, filterOptions, searchTerm, activeFilter, totalCount, onClose }) {
  const [selectedCols, setSelectedCols] = useState(allCols.map(c=>c.key));
  const [filterVal, setFilterVal]       = useState("ALL");
  const [fmt, setFmt]                   = useState("excel");

  const toggleCol = key => setSelectedCols(prev =>
    prev.includes(key) ? prev.filter(k=>k!==key) : [...prev, key]
  );

  const filteredData = filterVal==="ALL" ? data
    : data.filter(r => {
        const statusMatch = (r["status"]||"").toUpperCase() === filterVal;
        const ownerMatch  = (r["owner"]||"").toUpperCase()  === filterVal;
        return statusMatch || ownerMatch;
      });

  const activeCols = allCols.filter(c => selectedCols.includes(c.key));

  const exportExcel = () => {
    const rows = filteredData.map(r =>
      activeCols.map(c => {
        const v = r[c.key];
        return v == null ? "" : String(v).replace(/"/g,'""');
      })
    );

    const csvRows = [
      activeCols.map(c=>c.label).join(","),
      ...rows.map(r => r.map(v => `"${v}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvRows], { type:"text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    const suffix = searchTerm ? `_search-${searchTerm.replace(/\s+/g,"-")}` : "";
    a.download = `${title.toLowerCase().replace(/\s+/g,"_")}_export${suffix}_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const buildHTML = (forPrint=false) => {
    const tableRows = [
      `<tr>${activeCols.map(c=>`<th style="background:#4f46e5;color:#fff;padding:8px 12px;font-family:Arial;font-size:11pt;border:1px solid #c7d2fe;text-align:left;">${c.label}</th>`).join("")}</tr>`,
      ...filteredData.map((r,i) =>
        `<tr style="background:${i%2===0?"#ffffff":"#f8fafc"};">${
          activeCols.map(c=>`<td style="padding:7px 12px;font-family:Arial;font-size:10pt;border:1px solid #e2e8f0;">${r[c.key]??""}</td>`).join("")
        }</tr>`
      )
    ].join("");

    const filterInfo = [
      searchTerm && `Search: "${searchTerm}"`,
      activeFilter && activeFilter !== "ALL" && `Tab: ${activeFilter}`,
      filterVal !== "ALL" && `Filter: ${filterVal}`,
    ].filter(Boolean).join(" | ") || "No filter";

    return `
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${title} Export</title>
<style>
  body { font-family: Arial, sans-serif; margin: 20px; }
  h2   { color: #0f172a; font-size: 14pt; margin-bottom: 4px; }
  p    { color: #64748b; font-size: 10pt; margin-bottom: 16px; }
  table{ border-collapse: collapse; width: 100%; }
  ${forPrint ? "@media print { @page { size: landscape; margin: 10mm; } body { margin: 0; } }" : ""}
</style></head>
<body>
<h2>${title} Export</h2>
<p>Generated: ${new Date().toLocaleString()} &nbsp;|&nbsp; ${filterInfo} &nbsp;|&nbsp; Rows: ${filteredData.length}${totalCount?` of ${totalCount}`:""}</p>
<table>${tableRows}</table>
${forPrint ? "<script>window.onload=()=>{window.print();}</script>" : ""}
</body></html>`;
  };

  const exportWord = () => {
    const blob = new Blob([buildHTML(false)], { type:"application/msword" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    const suffix = searchTerm ? `_search-${searchTerm.replace(/\s+/g,"-")}` : "";
    a.download = `${title.toLowerCase().replace(/\s+/g,"_")}_export${suffix}_${new Date().toISOString().slice(0,10)}.doc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printNow = () => {
    const w = window.open("", "_blank", "width=1200,height=800");
    if (!w) { alert("Please allow popups to print."); return; }
    w.document.write(buildHTML(true));
    w.document.close();
  };

  // Build context banner showing what's being exported
  const contextChips = [];
  if (searchTerm) contextChips.push({label:`Search: "${searchTerm}"`, color:"#4f46e5", bg:"#eef2ff"});
  if (activeFilter && activeFilter !== "ALL") contextChips.push({label:`Tab: ${activeFilter}`, color:"#0369a1", bg:"#e0f2fe"});

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>

        <div className="modal-head">
          <div>
            <div className="modal-title">Export {title}</div>
            <div className="modal-sub">Choose format, filter and columns</div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Context banner */}
        {(contextChips.length > 0 || (totalCount && totalCount !== data.length)) && (
          <div style={{padding:"10px 24px",background:"#fffbeb",borderBottom:"1px solid #fde68a",display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            <span style={{fontSize:11,fontWeight:700,color:"#b45309",letterSpacing:.3}}>EXPORTING:</span>
            {contextChips.map((c,i)=>(
              <span key={i} style={{fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius:4,background:c.bg,color:c.color}}>{c.label}</span>
            ))}
            <span style={{fontSize:11,color:"#92400e",marginLeft:"auto"}}>
              {data.length}{totalCount ? ` of ${totalCount} total` : ""} rows in current view
            </span>
          </div>
        )}

        <div className="modal-section">
          <div className="modal-label">Format</div>
          <div className="fmt-row">
            {[
              { id:"excel", icon:"📊", label:"Excel (.csv)", sub:"Opens in Excel / Sheets" },
              { id:"word",  icon:"📄", label:"Word (.doc)",  sub:"Opens in Word" },
              { id:"print", icon:"🖨️", label:"Print",        sub:"Send directly to printer" },
            ].map(f=>(
              <div key={f.id} className={`fmt-card ${fmt===f.id?"fmt-on":""}`} onClick={()=>setFmt(f.id)}>
                <span className="fmt-icon">{f.icon}</span>
                <div>
                  <div className="fmt-label">{f.label}</div>
                  <div className="fmt-sub">{f.sub}</div>
                </div>
                {fmt===f.id && <span className="fmt-check">✓</span>}
              </div>
            ))}
          </div>
        </div>

        <div className="modal-section">
          <div className="modal-label">Filter rows (additional)</div>
          <div className="filter-row">
            {["ALL",...filterOptions].map(opt=>(
              <button key={opt} className={`tab ${filterVal===opt?"tab-on":""}`} onClick={()=>setFilterVal(opt)}>{opt}</button>
            ))}
          </div>
          <div className="modal-count">{filteredData.length} rows will be {fmt==="print" ? "printed" : "exported"}</div>
        </div>

        <div className="modal-section">
          <div className="modal-label-row">
            <span className="modal-label">Columns</span>
            <div style={{display:"flex",gap:6}}>
              <button className="col-tog" onClick={()=>setSelectedCols(allCols.map(c=>c.key))}>All</button>
              <button className="col-tog" onClick={()=>setSelectedCols([])}>None</button>
            </div>
          </div>
          <div className="col-grid">
            {allCols.map(c=>(
              <div key={c.key} className={`col-chip ${selectedCols.includes(c.key)?"col-on":""}`} onClick={()=>toggleCol(c.key)}>
                <span className="col-check">{selectedCols.includes(c.key)?"✓":"+"}</span>
                {c.label}
              </div>
            ))}
          </div>
        </div>

        <div className="modal-foot">
          <button className="btn-discard" onClick={onClose}>Cancel</button>
          <button className="btn-save" disabled={selectedCols.length===0||filteredData.length===0}
            onClick={fmt==="excel" ? exportExcel : fmt==="word" ? exportWord : printNow}
            style={{opacity:selectedCols.length===0||filteredData.length===0?0.5:1}}>
            {fmt==="print" ? "🖨️ Print Now" : `↓ Download ${fmt==="excel"?"Excel":"Word"}`}
          </button>
        </div>

      </div>
    </div>
  );
}

// ─── Login Page CSS ───────────────────────────────────────────────
const LOGIN_CSS = `
.login-page {
  position: relative;
  min-height: 100vh;
  width: 100%;
  background: #0A0F1E;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  overflow: hidden;
  font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
}
.login-bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
}
.login-card {
  position: relative;
  z-index: 2;
  max-width: 400px;
  width: 100%;
  background: rgba(15, 23, 42, 0.85);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(99, 102, 241, 0.3);
  border-radius: 16px;
  padding: 36px 32px;
  box-shadow: 0 20px 60px rgba(0,0,0,.5), 0 0 100px rgba(99,102,241,.2);
}
.login-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 28px;
}
.login-logo {
  width: 42px;
  height: 42px;
  background: linear-gradient(135deg, #6366F1, #8B5CF6);
  border-radius: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 16px rgba(99,102,241,.5);
  flex-shrink: 0;
}
.login-brand-title { color: white; font-weight: 700; font-size: 16px; }
.login-brand-sub   { color: #94A3B8; font-size: 11px; }
.login-heading     { color: white; font-size: 22px; font-weight: 700; margin: 0 0 6px; }
.login-subheading  { color: #94A3B8; font-size: 13px; margin: 0 0 24px; }
.login-label { display: block; font-size: 11px; color: #94A3B8; margin-bottom: 6px; letter-spacing: 0.3px; font-weight: 600; }
.login-input {
  width: 100%; padding: 11px 14px; margin-bottom: 14px;
  background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 8px; color: white; font-size: 13px; box-sizing: border-box;
  outline: none; transition: border-color .2s, box-shadow .2s; font-family: inherit;
}
.login-input::placeholder { color: #475569; }
.login-input:focus { border-color: rgba(99,102,241,.6); box-shadow: 0 0 0 3px rgba(99,102,241,.15); }
.login-row { display: flex; justify-content: space-between; align-items: center; font-size: 12px; margin-bottom: 14px; margin-top: 4px; }
.login-remember { display: flex; align-items: center; gap: 6px; color: #94A3B8; cursor: pointer; }
.login-remember input[type="checkbox"] { width: 13px; height: 13px; accent-color: #6366F1; cursor: pointer; }
.login-forgot { color: #818CF8; text-decoration: none; transition: color .2s; }
.login-forgot:hover { color: #A5B4FC; }
.login-error { font-size: 12px; color: #FCA5A5; background: rgba(220, 38, 38, 0.1); border: 1px solid rgba(220, 38, 38, 0.3); border-radius: 7px; padding: 8px 12px; margin-bottom: 14px; }
.login-button {
  width: 100%; padding: 12px; background: linear-gradient(135deg, #6366F1, #8B5CF6);
  color: white; border: none; border-radius: 8px; font-weight: 600; font-size: 13px;
  cursor: pointer; box-shadow: 0 4px 16px rgba(99,102,241,.4);
  transition: transform .15s, box-shadow .2s, opacity .2s; font-family: inherit;
}
.login-button:hover:not(:disabled) { box-shadow: 0 6px 22px rgba(99,102,241,.55); }
.login-button:active:not(:disabled) { transform: scale(0.98); }
.login-button:disabled { opacity: 0.7; cursor: not-allowed; }
.login-footer { text-align: center; font-size: 10px; color: #475569; margin-top: 18px; letter-spacing: 0.4px; }
@media (max-width: 480px) {
  .login-card { padding: 28px 20px; }
  .login-heading { font-size: 20px; }
}
`;

// ─── CSS ──────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
html,body,#root{height:100%;}
body{font-family:'Plus Jakarta Sans',sans-serif;color:#1e293b;background:#f1f5f9;}

/* ── Layout ── */
.layout{display:flex;height:100vh;overflow:hidden;position:relative;}

/* ── Sidebar backdrop (mobile) ── */
.sidebar-backdrop{
  display:none;
  position:fixed;inset:0;background:rgba(15,23,42,.5);z-index:199;
}
@media(max-width:768px){
  .sidebar-backdrop{display:block;}
}

/* ── Sidebar ── */
.sidebar{
  width:180px;flex-shrink:0;background:#fff;border-right:1px solid #e2e8f0;
  display:flex;flex-direction:column;height:100vh;
  transition:transform .25s ease;
  z-index:200;
}
@media(max-width:768px){
  .sidebar{
    position:fixed;top:0;left:0;height:100%;
    transform:translateX(-100%);
  }
  .sidebar.sidebar-open{
    transform:translateX(0);
    box-shadow:4px 0 24px rgba(0,0,0,.18);
  }
}

/* ── Sidebar close button (mobile only) ── */
.sidebar-close-btn{
  display:none;
  margin-left:auto;width:28px;height:28px;border-radius:50%;
  border:1px solid #e2e8f0;background:#f8fafc;cursor:pointer;
  font-size:12px;color:#64748b;align-items:center;justify-content:center;
  flex-shrink:0;
}
@media(max-width:768px){
  .sidebar-close-btn{display:flex;}
}

/* ── Hamburger (mobile only) ── */
.hamburger{
  display:none;flex-direction:column;justify-content:center;gap:5px;
  width:36px;height:36px;border:1px solid #e2e8f0;border-radius:8px;
  background:#f8fafc;cursor:pointer;padding:7px;flex-shrink:0;margin-right:8px;
}
.hamburger span{display:block;height:2px;background:#475569;border-radius:2px;transition:all .2s;}
@media(max-width:768px){
  .hamburger{display:flex;}
}

/* ── Brand ── */
.brand{padding:16px;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;gap:10px;}
.brand-logo{width:36px;height:36px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:9px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:16px;flex-shrink:0;box-shadow:0 3px 10px rgba(99,102,241,.3);}
.brand-name{font-size:14px;font-weight:700;color:#0f172a;}
.brand-sub{font-size:11px;color:#94a3b8;}

/* ── Nav ── */
.nav{padding:10px;flex:1;overflow-y:auto;}
.nav-item{display:flex;align-items:center;gap:9px;padding:8px 10px;border-radius:7px;cursor:pointer;color:#64748b;font-size:13px;font-weight:500;transition:all .15s;margin-bottom:1px;position:relative;}
.nav-item:hover{background:#f8fafc;color:#334155;}
.nav-on{background:#eef2ff!important;color:#4f46e5!important;font-weight:600;}
.nav-on::before{content:'';position:absolute;left:0;top:20%;height:60%;width:3px;background:#6366f1;border-radius:0 3px 3px 0;}
.nav-ico{font-size:14px;width:18px;text-align:center;flex-shrink:0;}
.nav-arr{margin-left:auto;font-size:10px;opacity:.5;}
.nav-sub{margin:2px 0 4px 38px;border-left:2px solid #f1f5f9;padding-left:10px;}
.nav-child{padding:6px 10px;border-radius:5px;cursor:pointer;color:#94a3b8;font-size:12.5px;transition:all .15s;margin-bottom:1px;}
.nav-child:hover{color:#475569;background:#f8fafc;}
.nav-child-on{color:#4f46e5!important;font-weight:600;background:#eef2ff!important;}
.sidebar-foot{padding:14px 16px;border-top:1px solid #f1f5f9;}
.online-pill{display:inline-flex;align-items:center;gap:5px;background:#f0fdf4;border:1px solid #bbf7d0;padding:3px 9px;border-radius:20px;font-size:11px;font-weight:600;color:#15803d;margin-bottom:3px;}
.dot{width:6px;height:6px;border-radius:50%;background:#16a34a;}
.foot-org{font-size:11px;color:#94a3b8;}

/* ── Main area ── */
.main{flex:1;display:flex;flex-direction:column;min-width:0;height:100vh;overflow:hidden;}

/* ── Topbar ── */
.topbar{flex-shrink:0;padding:12px 16px;background:#fff;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;gap:8px;}
.topbar-title{font-size:16px;font-weight:700;color:#0f172a;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.topbar-r{display:flex;align-items:center;gap:8px;flex-shrink:0;}
.date-chip{font-size:11px;color:#64748b;font-weight:500;background:#f8fafc;border:1px solid #e2e8f0;padding:3px 10px;border-radius:20px;white-space:nowrap;}
.role-badge{font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;white-space:nowrap;}
.topbar-username{font-size:12px;color:#64748b;font-weight:500;white-space:nowrap;}
.logout-btn{padding:5px 12px;border-radius:7px;border:1px solid #e2e8f0;background:#fff;color:#64748b;font-size:12px;cursor:pointer;font-family:inherit;white-space:nowrap;}

/* Hide some topbar items on small mobile */
@media(max-width:480px){
  .date-chip{display:none;}
  .topbar-username{display:none;}
  .topbar-title{font-size:14px;}
}

/* ── Content ── */
.content{flex:1;overflow-y:auto;padding:16px;}
@media(max-width:600px){
  .content{padding:10px;}
}
@media(min-width:769px){
  .content{padding:20px 24px;}
}

/* ── Dashboard ── */
.dash{display:flex;flex-direction:column;gap:16px;}
.stat-row{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;}
@media(max-width:900px){
  .stat-row{grid-template-columns:repeat(2,1fr);gap:10px;}
}
@media(max-width:480px){
  .stat-row{grid-template-columns:repeat(2,1fr);gap:8px;}
}
.stat-card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;display:flex;flex-direction:column;gap:6px;transition:all .15s;}
.stat-btn{font-family:inherit;cursor:pointer;text-align:left;width:100%;}
.stat-btn:hover{border-color:#cbd5e1;background:#fafbff;transform:translateY(-1px);box-shadow:0 2px 8px rgba(0,0,0,.04);}
.stat-btn:active{transform:translateY(0);}
.stat-top{display:flex;align-items:center;gap:8px;}
.stat-icon-sm{width:22px;height:22px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:11px;flex-shrink:0;}
.stat-bottom{display:flex;align-items:baseline;justify-content:space-between;gap:8px;}
.stat-label{font-size:11px;color:#64748b;font-weight:500;}
.stat-val{font-size:22px;font-weight:700;font-family:'IBM Plex Mono',monospace;line-height:1;}
.stat-bar{height:3px;background:#f1f5f9;border-radius:2px;overflow:hidden;}
.stat-fill{height:100%;border-radius:2px;transition:width .7s ease;}
.stat-pct{font-size:10px;font-weight:600;font-family:'IBM Plex Mono',monospace;white-space:nowrap;}
.dash-bottom{display:grid;grid-template-columns:1fr 320px;gap:14px;}
.dash-bottom-3col{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr) minmax(0,1fr);gap:14px;flex:1;min-height:0;}
.capacity-card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;display:flex;flex-direction:column;overflow:hidden;}
.cap-scroll{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:10px;}
.cap-total-box{background:linear-gradient(135deg,#eef2ff,#f5f3ff);border:1px solid #c7d2fe;border-radius:9px;padding:12px 14px;}
.cap-owner-box{background:#fff;border:1.5px solid #e2e8f0;border-radius:9px;padding:11px 13px;}
.cap-owner-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:2px;}
.cap-owner-tag{font-size:11px;font-weight:700;padding:2px 9px;border-radius:5px;letter-spacing:.4px;}
.cap-owner-total{font-size:15px;font-weight:700;font-family:'IBM Plex Mono',monospace;}
.cap-owner-sub{font-size:10.5px;color:#94a3b8;margin-bottom:9px;font-weight:500;}
.cap-type-row{margin-top:7px;}
.cap-type-line{display:flex;align-items:center;justify-content:space-between;margin-bottom:3px;}
.cap-type-name{font-size:11.5px;color:#475569;font-weight:600;}
.cap-type-val{font-size:11px;color:#0f172a;font-weight:600;font-family:'IBM Plex Mono',monospace;}
.cap-bar{height:5px;background:#f1f5f9;border-radius:3px;overflow:hidden;}
.cap-bar-fill{height:100%;border-radius:3px;transition:width .4s ease;}
.cap-empty{font-size:11px;color:#94a3b8;text-align:center;padding:8px;font-style:italic;}
@media(max-width:900px){
  .dash-bottom{grid-template-columns:1fr;}
  .dash-bottom-3col{grid-template-columns:1fr;flex:none;}
  .map-card{min-height:340px;}
  .recent-card,.attn-card,.capacity-card{min-height:auto;}
  .attn-list{max-height:none;}
  .cap-scroll{max-height:none;}
}
.map-card,.recent-card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;display:flex;flex-direction:column;overflow:hidden;}
.map-card{min-height:300px;}
.card-head{padding:12px 16px;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;}
.card-title{font-size:14px;font-weight:600;color:#0f172a;}
.btn-sm{padding:4px 12px;border-radius:6px;background:#f8fafc;border:1px solid #e2e8f0;color:#6366f1;font-size:12px;font-weight:600;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif;}
.btn-sm:hover{background:#eef2ff;border-color:#c7d2fe;}
.map-wrap{flex:1;padding:8px;min-height:260px;}
.map-empty{padding:12px 16px;font-size:12px;color:#94a3b8;text-align:center;}
.map-legend{display:flex;gap:12px;padding:8px 16px;border-top:1px solid #f1f5f9;flex-wrap:wrap;flex-shrink:0;}
.legend-item{display:flex;align-items:center;gap:5px;font-size:11px;color:#64748b;font-weight:500;}
.legend-diamond{width:11px;height:11px;border-radius:2px;transform:rotate(45deg);flex-shrink:0;}
.legend-circle{width:11px;height:11px;border-radius:50%;flex-shrink:0;}
.recent-list{flex:1;overflow-y:auto;max-height:300px;}
.recent-row{display:flex;align-items:center;justify-content:space-between;padding:10px 16px;border-bottom:1px solid #f8fafc;transition:background .1s;}
.recent-row:last-child{border-bottom:none;}
.recent-row:hover{background:#fafbff;}
.recent-id{font-family:'IBM Plex Mono',monospace;font-size:12px;color:#4f46e5;font-weight:500;}
.recent-loc{font-size:11.5px;color:#94a3b8;margin-top:1px;}
.empty-msg{padding:32px;text-align:center;color:#94a3b8;font-size:13px;}

/* ── Links Need Attention (card-based) ── */
.attn-card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:16px;display:flex;flex-direction:column;overflow:hidden;}
.attn-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;flex-wrap:nowrap;}
.attn-head-left{min-width:0;flex:1;}
.attn-title{font-size:15px;font-weight:600;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.attn-sub{font-size:11px;color:#64748b;margin-top:2px;}
.attn-viewall{font-size:11.5px;padding:5px 12px;border:1px solid #e2e8f0;background:#fff;border-radius:999px;cursor:pointer;color:#0f172a;font-family:inherit;white-space:nowrap;flex-shrink:0;}
.attn-viewall:hover{background:#f8fafc;border-color:#cbd5e1;}

.attn-stats{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px;}
.attn-stat{border-radius:10px;padding:10px 11px;cursor:pointer;transition:transform .1s;border-left:4px solid transparent;outline:2px solid transparent;outline-offset:-1px;}
.attn-stat:hover{transform:translateY(-1px);}
.attn-stat-num{font-size:22px;font-weight:600;line-height:1;}
.attn-stat-lbl{font-size:11px;margin-top:4px;font-weight:500;line-height:1.25;}

.attn-stat-stale{background:#EEEDFE;border-left-color:#7F77DD;}
.attn-num-stale{color:#26215C;}
.attn-lbl-stale{color:#534AB7;}
.attn-stat-stale.attn-stat-active{outline-color:rgba(127,119,221,.45);}

.attn-stat-over{background:#FAECE7;border-left-color:#D85A30;}
.attn-num-over{color:#4A1B0C;}
.attn-lbl-over{color:#993C1D;}
.attn-stat-over.attn-stat-active{outline-color:rgba(216,90,48,.45);}

.attn-stat-under{background:#E1F5EE;border-left-color:#1D9E75;}
.attn-num-under{color:#04342C;}
.attn-lbl-under{color:#0F6E56;}
.attn-stat-under.attn-stat-active{outline-color:rgba(29,158,117,.45);}

.attn-list{display:flex;flex-direction:column;gap:6px;max-height:360px;overflow-y:auto;}
.attn-empty{padding:22px;text-align:center;color:#94a3b8;font-size:12.5px;background:#f8fafc;border-radius:10px;}
.attn-row{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;padding:10px 12px;background:#f8fafc;border-radius:10px;transition:background .1s;}
.attn-row:hover{background:#f1f5f9;}
.attn-row-info{min-width:0;flex:1;}
.attn-row-route{font-size:12.5px;font-weight:600;color:#0f172a;line-height:1.35;word-break:break-word;}
.attn-row-note{font-size:11px;color:#64748b;margin-top:2px;word-break:break-word;}
.attn-row-status{display:flex;align-items:center;gap:6px;margin-top:5px;flex-wrap:wrap;}
.attn-row-statustxt{font-size:10.5px;color:#64748b;}

.attn-chip{font-size:10px;padding:1.5px 7px;border-radius:999px;font-weight:600;flex-shrink:0;}
.attn-chip-stale{background:#EEEDFE;color:#534AB7;}
.attn-chip-over{background:#FAECE7;color:#993C1D;}
.attn-chip-under{background:#E1F5EE;color:#0F6E56;}

.attn-row-btn{font-size:11.5px;padding:5px 12px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;cursor:pointer;color:#0f172a;flex-shrink:0;font-family:inherit;font-weight:500;align-self:flex-start;}
.attn-row-btn:hover{border-color:#cbd5e1;background:#f8fafc;}

@media(max-width:600px){
  .attn-stats{grid-template-columns:1fr 1fr 1fr;gap:6px;}
  .attn-stat{padding:8px 9px;}
  .attn-stat-num{font-size:18px;}
  .attn-stat-lbl{font-size:10px;}
}

/* ── Page ── */
.page-col{display:flex;flex-direction:column;gap:14px;min-height:0;}
.section-title{font-size:15px;font-weight:600;color:#0f172a;}
.toolbar{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;flex-shrink:0;}
.tabs{display:flex;background:#f1f5f9;border-radius:8px;padding:3px;gap:2px;flex-wrap:wrap;}
.tab{padding:5px 11px;border-radius:6px;border:none;font-size:12px;font-weight:500;cursor:pointer;background:transparent;color:#64748b;transition:all .15s;font-family:'Plus Jakarta Sans',sans-serif;}
.tab:hover{color:#334155;}
.tab-on{background:#fff!important;color:#4f46e5!important;font-weight:600!important;box-shadow:0 1px 4px rgba(0,0,0,.08);}
.btn-add{padding:7px 14px;border-radius:8px;background:#6366f1;color:#fff;font-size:13px;font-weight:600;border:none;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif;white-space:nowrap;}
.btn-add:hover{background:#4f46e5;box-shadow:0 4px 12px rgba(99,102,241,.3);}

/* ── Forms ── */
.form-box{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;flex-shrink:0;animation:fd .18s ease;}
.edit-box{border-color:#fde68a;}
@keyframes fd{from{opacity:0;transform:translateY(-4px);}to{opacity:1;transform:translateY(0);}}
.form-head{font-size:14px;color:#0f172a;margin-bottom:12px;}
.edit-id{color:#d97706;font-family:'IBM Plex Mono',monospace;font-size:13px;}
.fg{display:grid;gap:10px;}
.fg-5{grid-template-columns:repeat(5,1fr);}
@media(max-width:900px){.fg-5{grid-template-columns:repeat(3,1fr);}}
@media(max-width:580px){.fg-5{grid-template-columns:repeat(2,1fr);}}
@media(max-width:380px){.fg-5{grid-template-columns:1fr;}}
.field{display:flex;flex-direction:column;gap:4px;}
.flabel{font-size:10.5px;font-weight:600;color:#475569;letter-spacing:.2px;}
.finput{background:#f8fafc;border:1px solid #e2e8f0;border-radius:7px;color:#1e293b;font-size:12.5px;padding:8px 10px;outline:none;transition:all .15s;font-family:'Plus Jakarta Sans',sans-serif;width:100%;}
.finput:focus{border-color:#6366f1;background:#fff;box-shadow:0 0 0 3px rgba(99,102,241,.1);}
.finput::placeholder{color:#cbd5e1;}
.finput:disabled{opacity:.5;cursor:not-allowed;}
.factions{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;}
.btn-save{padding:8px 18px;border-radius:7px;background:#22c55e;color:#fff;font-size:13px;font-weight:600;border:none;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif;}
.btn-save:hover{background:#16a34a;}
.btn-discard{padding:8px 14px;border-radius:7px;background:transparent;color:#64748b;font-size:13px;border:1px solid #e2e8f0;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif;}
.btn-discard:hover{border-color:#cbd5e1;color:#334155;}

/* ── Table ── */
.tbl-wrap{background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;display:flex;flex-direction:column;min-height:200px;}
.tbl-hd{padding:12px 16px;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;}
.tbl-title{font-size:14px;font-weight:600;color:#0f172a;display:flex;align-items:center;gap:8px;}
.tbl-cnt{background:#f1f5f9;color:#64748b;font-size:11px;font-weight:600;padding:2px 8px;border-radius:10px;}
.tbl-f{font-size:11px;color:#94a3b8;}
.tbl-scroll{flex:1;overflow:auto;-webkit-overflow-scrolling:touch;}
table{width:100%;border-collapse:collapse;font-size:12.5px;}
thead{position:sticky;top:0;z-index:1;}
thead tr{background:#f8fafc;border-bottom:1px solid #e2e8f0;}
th{padding:9px 10px;text-align:left;font-size:10px;font-weight:700;color:#475569;letter-spacing:.4px;text-transform:uppercase;white-space:nowrap;}
.th-sort{cursor:pointer;user-select:none;}
.th-sort:hover{color:#4f46e5;background:#f1f5f9;}
tbody tr{border-bottom:1px solid #f1f5f9;transition:background .1s;}
tbody tr:last-child{border-bottom:none;}
tbody tr:nth-child(even){background:#fcfcfd;}
tbody tr:hover{background:#f5f7ff;}
td{padding:9px 10px;color:#334155;white-space:nowrap;vertical-align:middle;}
.num{color:#cbd5e1;font-size:11px;font-family:'IBM Plex Mono',monospace;font-weight:600;}
.lid{font-family:'IBM Plex Mono',monospace;font-size:11px;color:#4f46e5;background:#eef2ff;padding:2px 7px;border-radius:5px;font-weight:600;}
.muted{color:#64748b;font-size:12px;}
.bold{color:#0f172a;font-weight:600;font-size:12.5px;}
.notes-cell{max-width:110px;overflow:hidden;text-overflow:ellipsis;font-weight:500;color:#475569;}
.type-chip{font-size:10px;font-weight:700;color:#0369a1;background:#e0f2fe;padding:2px 7px;border-radius:4px;letter-spacing:.3px;text-transform:uppercase;}
.empty{padding:40px;text-align:center;color:#94a3b8;font-size:13px;}
.tbl-foot{padding:10px 16px;border-top:1px solid #f1f5f9;font-size:11.5px;color:#94a3b8;text-align:right;flex-shrink:0;}

/* ── Search ── */
.search-wrap{position:relative;display:flex;align-items:center;}
.search-icon{position:absolute;left:10px;color:#94a3b8;font-size:16px;pointer-events:none;}
.search-input{padding:7px 32px 7px 30px;border-radius:8px;border:1px solid #e2e8f0;background:#f8fafc;font-size:12.5px;color:#1e293b;outline:none;width:180px;font-family:'Plus Jakarta Sans',sans-serif;transition:all .15s;}
.search-input:focus{border-color:#6366f1;background:#fff;box-shadow:0 0 0 3px rgba(99,102,241,.1);width:210px;}
.search-input::placeholder{color:#cbd5e1;}
.search-clear{position:absolute;right:8px;background:none;border:none;color:#94a3b8;cursor:pointer;font-size:11px;padding:2px;line-height:1;}
.search-clear:hover{color:#475569;}

/* ── Action buttons (new) ── */
.action-cell{display:inline-flex;gap:4px;align-items:center;flex-wrap:nowrap;}
.btn-act{padding:5px 9px;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif;white-space:nowrap;transition:all .12s;border:1px solid transparent;letter-spacing:.2px;}
.btn-act:active{transform:translateY(1px);}

.btn-act-edit{background:#eef2ff;border-color:#c7d2fe;color:#4338ca;}
.btn-act-edit:hover{background:#6366f1;border-color:#6366f1;color:#fff;box-shadow:0 2px 6px rgba(99,102,241,.25);}

.btn-act-usage{background:#ecfeff;border-color:#a5f3fc;color:#0e7490;}
.btn-act-usage:hover{background:#06b6d4;border-color:#06b6d4;color:#fff;box-shadow:0 2px 6px rgba(6,182,212,.25);}

.btn-act-capacity{background:#faf5ff;border-color:#e9d5ff;color:#7c3aed;}
.btn-act-capacity:hover{background:#8b5cf6;border-color:#8b5cf6;color:#fff;box-shadow:0 2px 6px rgba(139,92,246,.25);}

/* Legacy button classes kept for other pages */
.edit-btn{padding:4px 10px;border-radius:6px;background:#fff;border:1px solid #e2e8f0;color:#64748b;font-size:11.5px;font-weight:500;cursor:pointer;transition:all .15s;font-family:'Plus Jakarta Sans',sans-serif;}
.edit-btn:hover{border-color:#6366f1;color:#4f46e5;background:#eef2ff;}
.del-btn{padding:4px 10px;border-radius:6px;background:#fff;border:1px solid #fecaca;color:#dc2626;font-size:11.5px;font-weight:500;cursor:pointer;transition:all .15s;font-family:'Plus Jakarta Sans',sans-serif;}
.del-btn:hover{background:#fef2f2;}
.util-btn{padding:4px 9px;border-radius:6px;background:#fff;border:1px solid #e0f2fe;color:#0369a1;font-size:11px;font-weight:600;cursor:pointer;transition:all .15s;font-family:'Plus Jakarta Sans',sans-serif;white-space:nowrap;}
.util-btn:hover{background:#e0f2fe;border-color:#7dd3fc;}
.req-btn{padding:4px 9px;border-radius:6px;background:#fff;border:1px solid #e2e8f0;color:#7c3aed;font-size:11px;font-weight:600;cursor:pointer;transition:all .15s;font-family:'Plus Jakarta Sans',sans-serif;white-space:nowrap;}
.req-btn:hover{background:#f5f3ff;border-color:#ddd6fe;}
.btn-export{padding:7px 12px;border-radius:8px;background:#fff;border:1px solid #e2e8f0;color:#4f46e5;font-size:12px;font-weight:600;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif;white-space:nowrap;}
.btn-export:hover{background:#eef2ff;border-color:#c7d2fe;}

/* ── Modals ── */
.modal-overlay{position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px;}
.modal{background:#fff;border-radius:16px;width:100%;max-width:540px;box-shadow:0 20px 60px rgba(0,0,0,.2);display:flex;flex-direction:column;max-height:90vh;overflow:hidden;}
.modal-head{padding:18px 20px 14px;border-bottom:1px solid #f1f5f9;display:flex;align-items:flex-start;justify-content:space-between;flex-shrink:0;}
.modal-title{font-size:15px;font-weight:700;color:#0f172a;}
.modal-sub{font-size:12px;color:#94a3b8;margin-top:2px;}
.modal-close{width:28px;height:28px;border-radius:50%;border:1px solid #e2e8f0;background:#f8fafc;cursor:pointer;font-size:12px;color:#64748b;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.modal-close:hover{background:#fee2e2;border-color:#fecaca;color:#dc2626;}
.modal-section{padding:14px 20px;border-bottom:1px solid #f8fafc;overflow-y:auto;}
.modal-label{font-size:11px;font-weight:600;color:#475569;letter-spacing:.3px;text-transform:uppercase;margin-bottom:10px;}
.modal-label-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;}
.modal-count{font-size:11px;color:#94a3b8;margin-top:8px;}
.fmt-row{display:flex;flex-direction:column;gap:8px;}
.fmt-card{display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:9px;border:1.5px solid #e2e8f0;cursor:pointer;transition:all .15s;position:relative;}
.fmt-card:hover{border-color:#c7d2fe;background:#fafbff;}
.fmt-on{border-color:#6366f1!important;background:#eef2ff!important;}
.fmt-icon{font-size:22px;flex-shrink:0;}
.fmt-label{font-size:13px;font-weight:600;color:#0f172a;}
.fmt-sub{font-size:11px;color:#94a3b8;}
.fmt-check{margin-left:auto;color:#4f46e5;font-weight:700;font-size:14px;}
.filter-row{display:flex;flex-wrap:wrap;gap:6px;}
.col-tog{padding:3px 10px;border-radius:5px;border:1px solid #e2e8f0;background:#f8fafc;font-size:11px;font-weight:600;color:#64748b;cursor:pointer;}
.col-tog:hover{border-color:#c7d2fe;color:#4f46e5;}
.col-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;}
@media(max-width:480px){.col-grid{grid-template-columns:repeat(2,1fr);}}
.col-chip{display:flex;align-items:center;gap:6px;padding:7px 10px;border-radius:7px;border:1.5px solid #e2e8f0;cursor:pointer;font-size:12px;font-weight:500;color:#475569;transition:all .15s;}
.col-chip:hover{border-color:#c7d2fe;}
.col-on{border-color:#6366f1;background:#eef2ff;color:#4f46e5;}
.col-check{font-size:11px;width:14px;text-align:center;flex-shrink:0;color:#6366f1;}
.modal-foot{padding:14px 20px;border-top:1px solid #f1f5f9;display:flex;justify-content:flex-end;gap:10px;flex-shrink:0;flex-wrap:wrap;}

/* ── Scrollbars ── */
::-webkit-scrollbar{width:4px;height:4px;}
::-webkit-scrollbar-track{background:#f8fafc;}
::-webkit-scrollbar-thumb{background:#e2e8f0;border-radius:3px;}
::-webkit-scrollbar-thumb:hover{background:#cbd5e1;}
`;