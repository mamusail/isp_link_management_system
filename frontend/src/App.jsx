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
  const [links,    setLinks]    = useState([]);
  const [pops,     setPops]     = useState([]);
  const [utils,    setUtils]    = useState([]);
  const [requests, setRequests] = useState([]);
  const [kams,     setKams]     = useState([]);
  const [partners, setPartners] = useState([]);

  // Auto-logout after 30 min
  useEffect(() => {
    const t = setTimeout(() => { alert("Session expired. Please log in again."); onLogout(); }, 30*60*1000);
    return () => clearTimeout(t);
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

  return (
    <>
      <style>{CSS}</style>
      <div className="layout">

        <aside className="sidebar">
          <div className="brand">
            <div className="brand-logo">◈</div>
            <div>
              <div className="brand-name">ISP Panel</div>
              <div className="brand-sub">Network Ops</div>
            </div>
          </div>
          <nav className="nav">
            {navItems.map(item => (
              <div key={item.id}>
                <div
                  className={`nav-item ${page === item.id ? "nav-on" : ""}`}
                  onClick={() => {
                    if (item.children) setOpenMenu(openMenu === item.id ? null : item.id);
                    else setPage(item.id);
                  }}
                >
                  <span className="nav-ico">{item.icon}</span>
                  <span>{item.label}</span>
                  {item.children && <span className="nav-arr">{openMenu===item.id?"▾":"▸"}</span>}
                </div>
                {item.children && openMenu===item.id && (
                  <div className="nav-sub">
                    {item.children.map(c => (
                      <div key={c.id} className={`nav-child ${page===c.id?"nav-child-on":""}`} onClick={() => setPage(c.id)}>
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
            <div className="topbar-title">
              { page==="dashboard" ? "Dashboard"
              : page==="links"     ? "Network › Links"
              : page==="pops"      ? "Network › POPs"
              : page==="requests"       ? "Network › Requests"
              : page==="users"          ? "Management › Users"
              : page==="kams"           ? "Management › KAMs"
              : page==="partners_page" ? "Management › Partners"
              : page.charAt(0).toUpperCase()+page.slice(1) }
            </div>
            <div className="topbar-r">
              <span className="date-chip">{new Date().toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</span>
              <span style={{fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:20,background:
                role==="ADMIN"?"#eef2ff":role==="NOC"?"#f0fdf4":role==="ACCOUNTS"?"#fffbeb":role==="PARTNER"?"#f5f3ff":"#f8fafc",
                color:role==="ADMIN"?"#4f46e5":role==="NOC"?"#16a34a":role==="ACCOUNTS"?"#b45309":role==="PARTNER"?"#7c3aed":"#64748b"
              }}>{role}</span>
              <span style={{fontSize:12,color:"var(--color-text-secondary)",fontWeight:500}}>{user.username}</span>
              <button onClick={onLogout} style={{padding:"5px 12px",borderRadius:7,border:"1px solid #e2e8f0",background:"#fff",color:"#64748b",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Logout</button>
            </div>
          </div>
          <div className="content">
            {page==="dashboard" && <Dashboard links={links} pops={pops} setPage={setPage} />}
            {page==="links"     && <LinksPage  links={links} fetchLinks={fetchLinks} pops={pops} utils={utils} fetchUtils={fetchUtils} requests={requests} fetchRequests={fetchRequests} partners={partners} user={user} hiddenCols={HIDDEN_COLS[role]||[]} />}
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
function Dashboard({ links, pops, setPage }) {
  const total     = links.length;
  const active    = links.filter(l=>l.status?.toUpperCase()==="ACTIVE").length;
  const pending   = links.filter(l=>l.status?.toUpperCase()==="PENDING").length;
  const cancelled = links.filter(l=>l.status?.toUpperCase()==="CANCELLED").length;

  const stats = [
    { label:"Total Links", value:total,     color:"#6366f1", light:"#eef2ff", border:"#c7d2fe" },
    { label:"Active",      value:active,    color:"#16a34a", light:"#f0fdf4", border:"#bbf7d0" },
    { label:"Pending",     value:pending,   color:"#d97706", light:"#fffbeb", border:"#fde68a" },
    { label:"Cancelled",   value:cancelled, color:"#dc2626", light:"#fef2f2", border:"#fecaca" },
  ];

  return (
    <div className="dash">
      <div className="stat-row">
        {stats.map(s => (
          <div key={s.label} className="stat-card" style={{"--ac":s.color,"--lc":s.light,"--bc":s.border}}>
            <div className="stat-icon" style={{background:s.light,border:`1px solid ${s.border}`}}>
              <span style={{color:s.color}}>◈</span>
            </div>
            <div className="stat-label">{s.label}</div>
            <div className="stat-val" style={{color:s.color}}>{s.value}</div>
            <div className="stat-bar-row">
              <div className="stat-bar"><div className="stat-fill" style={{width:total?`${Math.round(s.value/total*100)}%`:"0%",background:s.color}}></div></div>
              <span className="stat-pct" style={{color:s.color}}>{total?Math.round(s.value/total*100):0}%</span>
            </div>
          </div>
        ))}
      </div>

      <div className="dash-bottom">
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
            <div className="map-empty">No POPs added yet. Go to Network › POPs to add locations.</div>
          )}
        </div>

        <div className="recent-card">
          <div className="card-head">
            <span className="card-title">Recent Links</span>
            <button className="btn-sm" onClick={()=>setPage("links")}>View All →</button>
          </div>
          <div className="recent-list">
            {links.length===0 ? (
              <div className="empty-msg">No links yet.</div>
            ) : [...links].reverse().slice(0,8).map(l => (
              <div key={l.id} className="recent-row">
                <div>
                  <div className="recent-id">{l.link_id}</div>
                  <div className="recent-loc">{l.aggregation||"—"} → {l.to_location}</div>
                </div>
                <Badge status={l.status} />
              </div>
            ))}
          </div>
        </div>
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

// Center on Bangladesh - zoom 7, center adjusted so full BD is visible
      // Bangladesh: tightly centered, zoom 8 fills the card perfectly
      map.setView([23.7000, 90.3563], 7);
      map.setMaxBounds([[20.3, 87.8], [26.8, 92.8]]);
      map.setMinZoom(7);
      map.setMaxZoom(18);

      const withCoords = pops.filter(p => p.lat != null && p.lat !== "" && p.lng != null && p.lng !== "");

      if (withCoords.length > 0) {
        const markers = withCoords.map(p => {
          const isAgg = p.type?.toLowerCase() === "aggregation";
          const isAKN = p.operator?.toUpperCase() === "AKN";
          const bgColor = isAKN ? "#2563eb" : "#16a34a";
          const borderRadius = isAgg ? "6px" : "50%";

          // Circle = POP, Diamond (rotated square) = Aggregation
          const iconHtml = isAgg
            ? `<div style="width:16px;height:16px;background:${bgColor};border:2.5px solid #fff;border-radius:3px;transform:rotate(45deg);box-shadow:0 2px 8px rgba(0,0,0,.4);"></div>`
            : `<div style="width:18px;height:18px;background:${bgColor};border:2.5px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,.4);"></div>`;

          const icon = L.divIcon({
            html: `<div style="width:22px;height:22px;display:flex;align-items:center;justify-content:center;">${iconHtml}</div>`,
            className: "", iconSize:[22,22], iconAnchor:[11,11],
          });

          const m = L.marker([Number(p.lat), Number(p.lng)], { icon }).addTo(map);
          m.bindPopup(`
  <div style="font-family:sans-serif;min-width:160px;line-height:1.6;">
    <div style="font-size:14px;font-weight:700;color:#0f172a;margin-bottom:6px;border-bottom:1px solid #f1f5f9;padding-bottom:4px;">${p.name}</div>
    <div style="font-size:11px;color:#64748b;margin-bottom:2px;">
      <span style="font-weight:600;color:#475569;">Operator:</span>
      <span style="background:${isAKN?"#dbeafe":"#dcfce7"};color:${bgColor};padding:1px 6px;border-radius:3px;font-size:10px;font-weight:700;margin-left:2px;">${p.operator||"—"}</span>
    </div>
    <div style="font-size:11px;color:#64748b;margin-bottom:2px;">
      <span style="font-weight:600;color:#475569;">POP ID:</span> <span style="font-family:monospace;color:#4f46e5;">${p.pop_id}</span>
    </div>
    <div style="font-size:11px;color:#64748b;margin-bottom:2px;">
      <span style="font-weight:600;color:#475569;">Type:</span>
      <span style="background:${isAgg?"#e0f2fe":"#ede9fe"};color:${bgColor};padding:1px 6px;border-radius:3px;font-size:10px;font-weight:600;margin-left:2px;">${p.type||"—"}</span>
    </div>
    <div style="font-size:11px;color:#64748b;margin-bottom:2px;">
      <span style="font-weight:600;color:#475569;">Lat:</span> ${Number(p.lat).toFixed(5)}
    </div>
    <div style="font-size:11px;color:#64748b;margin-bottom:2px;">
      <span style="font-weight:600;color:#475569;">Lng:</span> ${Number(p.lng).toFixed(5)}
    </div>
    ${p.notes ? `<div style="font-size:11px;color:#64748b;margin-top:4px;padding-top:4px;border-top:1px solid #f1f5f9;"><span style="font-weight:600;color:#475569;">Note:</span> ${p.notes}</div>` : ""}
  </div>
`);
          return m;
        });
        // markers placed — map stays locked to Bangladesh
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
function LinksPage({ links, fetchLinks, pops, utils, fetchUtils, requests, fetchRequests, partners, user, role, hiddenCols=[] }) {
  const [filter, setFilter]             = useState("ALL");
  const [showForm, setShowForm]         = useState(false);
  const [editingLink, setEditingLink]   = useState(null);
  const [originalLink, setOriginalLink] = useState(null);
  const [form, setForm]                 = useState(EMPTY_LINK);
  const [showExport, setShowExport]     = useState(false);
  const [search, setSearch]             = useState("");
  const [utilModal, setUtilModal]       = useState(null);
  const [reqModal,  setReqModal]         = useState(null);   // link for change request
  const [sortCol, setSortCol]           = useState(null);
  const [sortDir, setSortDir]           = useState("asc");


  const hide = (col) => hiddenCols.includes(col);

  // Only Aggregation-type POPs for the dropdown
  const aggPOPs = pops.filter(p => p.type?.toLowerCase() === "aggregation");

  // Build a lookup map: link.id -> utilization record
  const utilMap = Object.fromEntries(utils.map(u => [u.link_id, u]));

  // Helper: days since a date
  const daysSince = (dateStr) => {
    if (!dateStr) return null;
    const diff = Date.now() - new Date(dateStr).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  const handleChange = e => setForm({...form, [e.target.name]: e.target.value});

  // ✅ FIXED: posts to /links/ not /pops/
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
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
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
        data={links.map(l => ({
          ...l,
          max_usage:          utilMap[l.id]?.max_util_mbps ?? null,
          capacity_gap:       (l.quantity_mbps && utilMap[l.id]) ? (l.quantity_mbps - utilMap[l.id].max_util_mbps).toFixed(1) : null,
          last_usage_updated: utilMap[l.id]?.updated_at ? new Date(utilMap[l.id].updated_at).toLocaleDateString("en-GB") : null,
          usage_updated_by:   utilMap[l.id]?.updated_by ?? null,
        }))}
        allCols={LINK_COLS} title="Links"
        filterField="status" filterOptions={["ACTIVE","PENDING","CANCELLED","AKN","BTL"]}
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

              {/* ✅ Aggregation dropdown from POP list */}
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

            {/* ✅ Aggregation dropdown in edit form too */}
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

      {reqModal && <RequestModal link={reqModal} onClose={()=>setReqModal(null)} onSave={async (payload)=>{ await API.post("/requests/", payload); fetchRequests(); setReqModal(null); }} />}

      {/* UTILIZATION UPDATE MODAL */}
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
                  <td className="muted">{l.quantity_mbps?`${l.quantity_mbps} Mbps`:"—"}</td>
                  {!hide("vlan") && <td className="muted">{l.vlan||"—"}</td>}
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
                  <td style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                    {can(role,"editLinks") && <button className="edit-btn" onClick={()=>{setEditingLink(l);setOriginalLink(l);setShowForm(false);}}>Edit</button>}
                    {can(role,"usageUpdate") && <button className="util-btn" onClick={()=>setUtilModal(l)}>Usage Update</button>}
                    {can(role,"changeReq") && <button className="req-btn" onClick={()=>{setReqModal(l);setShowForm(false);setEditingLink(null);}}>Change</button>}
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
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span className="section-title">POPs</span>
          <div className="tabs">
            {["ALL","AKN","BTL"].map(f=>(
              <button key={f} className={`tab ${filterOp===f?"tab-on":""}`} onClick={()=>setFilterOp(f)}>{f}</button>
            ))}
          </div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
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

      {showExport && <ExportModal data={pops} allCols={POP_COLS} title="POPs"
        filterField="operator" filterOptions={["AKN","BTL"]}
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

  // Auto-calculate: today = period_to, 7 days ago = period_from
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
    await onSave(mbps, by, periodFrom, periodTo);  // auto-calculated
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
          {/* Link info */}
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

          {/* Input */}
          <div className="field" style={{marginBottom:12}}>
            <label className="flabel">Max Usage — Last 7 Days (Mbps)</label>
            <input className="finput" type="number" placeholder="e.g. 1200" value={mbps}
              onChange={e=>setMbps(e.target.value)} autoFocus />
          </div>

          {/* Live preview bar */}
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

          {/* Period — auto calculated */}
          <div style={{display:"flex",gap:8,alignItems:"center",padding:"8px 12px",background:"#f8fafc",borderRadius:7,border:"1px solid #e2e8f0"}}>
            <span style={{fontSize:11,color:"#94a3b8",fontWeight:600}}>PERIOD</span>
            <span style={{fontSize:12,color:"#475569",fontFamily:"var(--font-mono)"}}>{periodFrom}</span>
            <span style={{fontSize:11,color:"#94a3b8"}}>→</span>
            <span style={{fontSize:12,color:"#475569",fontFamily:"var(--font-mono)"}}>{periodTo}</span>
            <span style={{fontSize:10,color:"#94a3b8",marginLeft:"auto"}}>auto</span>
          </div>

          {/* Updated by */}
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
    <div style={{minHeight:"100vh",background:"#f1f5f9",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{background:"#fff",borderRadius:16,border:"1px solid #e2e8f0",padding:"40px 36px",width:"100%",maxWidth:380,boxShadow:"0 4px 24px rgba(0,0,0,.08)"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:32}}>
          <div style={{width:42,height:42,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",borderRadius:11,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:18}}>◈</div>
          <div>
            <div style={{fontSize:16,fontWeight:700,color:"#0f172a"}}>ISP Panel</div>
            <div style={{fontSize:12,color:"#94a3b8"}}>Network Operations</div>
          </div>
        </div>

        <div style={{fontSize:20,fontWeight:700,color:"#0f172a",marginBottom:4}}>Sign in</div>
        <div style={{fontSize:13,color:"#94a3b8",marginBottom:24}}>Enter your credentials to continue</div>

        <form onSubmit={handleLogin} style={{display:"flex",flexDirection:"column",gap:14}}>
          <div className="field">
            <label className="flabel">Username</label>
            <input className="finput" placeholder="your_username" value={username} onChange={e=>setUsername(e.target.value)} autoFocus required />
          </div>
          <div className="field">
            <label className="flabel">Password</label>
            <input className="finput" type="password" placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)} required />
          </div>
          {error && <div style={{fontSize:12,color:"#dc2626",background:"#fef2f2",border:"1px solid #fecaca",borderRadius:7,padding:"8px 12px"}}>{error}</div>}
          <button type="submit" disabled={loading}
            style={{marginTop:4,padding:"10px",borderRadius:8,background:"#6366f1",color:"#fff",fontSize:14,fontWeight:600,border:"none",cursor:"pointer",opacity:loading?0.7:1,fontFamily:"inherit"}}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Users Page ───────────────────────────────────────────────────
function UsersPage() {
  const [users, setUsers]       = useState([]);
  const [showForm, setShowForm]  = useState(false);
  const [form, setForm]          = useState({username:"",password:"",role:"NOC"});
  const [search, setSearch]      = useState("");
  const [editUser, setEditUser]  = useState(null); // user being edited
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
                        <button
                          onClick={()=>{ setShowForm(false); openEdit(u); }}
                          style={{fontSize:12,padding:"3px 10px",borderRadius:6,border:"1px solid #d1d5db",background:isEditing?"#fef3c7":"#fff",color:"#374151",cursor:"pointer",fontWeight:500}}
                        >✏️ Edit</button>
                        <button
                          onClick={()=>handleDelete(u)}
                          style={{fontSize:12,padding:"3px 10px",borderRadius:6,border:"1px solid #fca5a5",background:"#fff",color:"#dc2626",cursor:"pointer",fontWeight:500}}
                        >🗑 Delete</button>
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
function RequestModal({ link, onClose, onSave }) {
  const [reqType,  setReqType]  = useState("UPGRADE");
  const [changeMbps, setChangeMbps] = useState("");
  const [role,     setRole]     = useState("NOC");
  const [reqBy,    setReqBy]    = useState("");
  const [saving,   setSaving]   = useState(false);

  const current  = link.quantity_mbps || 0;
  const change   = Number(changeMbps) || 0;
  const newTotal = reqType === "UPGRADE"   ? current + change
                 : reqType === "DOWNGRADE" ? Math.max(0, current - change)
                 : 0;

  const isPartnerRestricted = role === "PARTNER" && (reqType === "DOWNGRADE" || reqType === "TERMINATE");
  const minDate = new Date(Date.now() + 30*864e5).toISOString().slice(0,10);  // 30 days from today
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
          {/* Link info */}
          <div style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:8,padding:"10px 14px",marginBottom:16,display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <div><div style={{fontSize:10,color:"#94a3b8",fontWeight:600,marginBottom:2}}>AGGREGATION</div><div style={{fontSize:13,fontWeight:600,color:"#0f172a"}}>{link.aggregation||"—"}</div></div>
            <div><div style={{fontSize:10,color:"#94a3b8",fontWeight:600,marginBottom:2}}>TO LOCATION</div><div style={{fontSize:13,fontWeight:600,color:"#0f172a"}}>{link.to_location}</div></div>
            <div><div style={{fontSize:10,color:"#94a3b8",fontWeight:600,marginBottom:2}}>CURRENT CAPACITY</div><div style={{fontSize:13,fontWeight:600,color:"#4f46e5"}}>{current} Mbps</div></div>
            <div><div style={{fontSize:10,color:"#94a3b8",fontWeight:600,marginBottom:2}}>TYPE</div><div style={{fontSize:13,color:"#475569"}}>{link.type||"—"}</div></div>
          </div>

          {/* Request type */}
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

          {/* Change Mbps */}
          {reqType !== "TERMINATE" && (
            <div className="field" style={{marginBottom:14}}>
              <label className="flabel">{reqType === "UPGRADE" ? "Upgrade by (Mbps)" : "Downgrade by (Mbps)"}</label>
              <input className="finput" type="number" placeholder="e.g. 500" value={changeMbps} onChange={e=>setChangeMbps(e.target.value)} autoFocus />
            </div>
          )}

          {/* Preview */}
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

          {/* Role + Effective date */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
            <div className="field">
              <label className="flabel">Submitted As</label>
              <select className="finput" value={role} onChange={e=>setRole(e.target.value)}>
                <option value="NOC">NOC</option>
                <option value="PARTNER">Partner</option>
              </select>
            </div>
            <div className="field">
              <label className="flabel">Effective Date</label>
              {isPartnerRestricted ? (
                <input className="finput" type="date" value={partnerDate} min={minDate}
                  onChange={e=>setPartnerDate(e.target.value)}
                  style={{color:"#d97706"}} />
              ) : (
                <div className="finput" style={{background:"#f1f5f9",color:"#16a34a",fontSize:11,fontWeight:600,display:"flex",alignItems:"center"}}>
                  Effective immediately
                </div>
              )}
            </div>
          </div>

          {/* Requested by */}
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
  const [actionModal, setActionModal] = useState(null); // {req, mode: "billing"|"admin"}
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

  // Build Telegram-style message
  const buildMsg = (req) => {
    const l = linkMap[req.link_id];
    if (!l) return "";
    const current = l.quantity_mbps || 0;
    const change  = req.change_mbps || 0;
    const total   = req.request_type==="UPGRADE" ? current+change : Math.max(0,current-change);
    if (req.request_type === "TERMINATE") {
      return `Link ID: ${l.link_id}
Current Capacity: ${current} Mbps
Terminate: Requested

Requested by: ${req.requested_by}`;
    }
    const changeLabel = req.request_type==="UPGRADE" ? `Upgrade: +${change} Mbps` : `Downgrade: −${change} Mbps`;
    return `Link ID: ${l.link_id}
Current Capacity: ${current} Mbps
${changeLabel}
Total Capacity: ${total} Mbps

Requested by: ${req.requested_by}`;
  };

  const daysSince = d => d ? Math.floor((Date.now()-new Date(d).getTime())/(864e5)) : null;

  return (
    <div className="page-col">
      {/* Tabs */}
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

      {/* Table */}
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

      {/* Action Modal */}
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
              {/* Telegram message preview */}
              <div style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:8,padding:"12px 14px",marginBottom:14}}>
                <div style={{fontSize:10,color:"#94a3b8",fontWeight:600,marginBottom:8,letterSpacing:.4}}>MESSAGE PREVIEW</div>
                <pre style={{fontSize:12,color:"#1e293b",fontFamily:"var(--font-mono)",lineHeight:1.7,margin:0,whiteSpace:"pre-wrap"}}>{buildMsg(actionModal.req)}</pre>
              </div>

              {/* Note */}
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

function ExportModal({ data, allCols, title, filterField, filterOptions, onClose }) {
  const [selectedCols, setSelectedCols] = useState(allCols.map(c=>c.key));
  const [filterVal, setFilterVal]       = useState("ALL");
  const [fmt, setFmt]                   = useState("excel");

  const toggleCol = key => setSelectedCols(prev =>
    prev.includes(key) ? prev.filter(k=>k!==key) : [...prev, key]
  );

  const filteredData = filterVal==="ALL" ? data
    : data.filter(r => (r[filterField]||"").toUpperCase() === filterVal);

  const activeCols = allCols.filter(c => selectedCols.includes(c.key));

  const exportExcel = () => {
    // Build CSV content then trigger download as .xlsx-compatible CSV
    // Using SheetJS-style manual XML for real .xlsx
    const rows = filteredData.map(r =>
      activeCols.map(c => {
        const v = r[c.key];
        return v == null ? "" : String(v).replace(/"/g,'""');
      })
    );

    // Build a simple XML-based xlsx using the SpreadsheetML format
    const header = activeCols.map(c=>`<c t="inlineStr"><is><t>${c.label}</t></is></c>`).join("");
    const dataRows = rows.map(row =>
      `<row>${row.map(v=>`<c t="inlineStr"><is><t>${v.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</t></is></c>`).join("")}</row>`
    ).join("");

    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetData>
<row>${header}</row>
${dataRows}
</sheetData>
</worksheet>`;

    // Use CSV as fallback for broad compatibility — proper Excel opens it fine
    const csvRows = [
      activeCols.map(c=>c.label).join(","),
      ...rows.map(r => r.map(v => `"${v}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvRows], { type:"text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `${title.toLowerCase().replace(/\s+/g,"_")}_export_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportWord = () => {
    // Build HTML table that Word can open as .doc
    const tableRows = [
      `<tr>${activeCols.map(c=>`<th style="background:#4f46e5;color:#fff;padding:8px 12px;font-family:Arial;font-size:11pt;border:1px solid #c7d2fe;">${c.label}</th>`).join("")}</tr>`,
      ...filteredData.map((r,i) =>
        `<tr style="background:${i%2===0?"#ffffff":"#f8fafc"};">${
          activeCols.map(c=>`<td style="padding:7px 12px;font-family:Arial;font-size:10pt;border:1px solid #e2e8f0;">${r[c.key]??""}</td>`).join("")
        }</tr>`
      )
    ].join("");

    const html = `
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${title} Export</title>
<style>
  body { font-family: Arial, sans-serif; margin: 20px; }
  h2   { color: #0f172a; font-size: 14pt; margin-bottom: 4px; }
  p    { color: #64748b; font-size: 10pt; margin-bottom: 16px; }
  table{ border-collapse: collapse; width: 100%; }
</style></head>
<body>
<h2>${title} Export</h2>
<p>Generated: ${new Date().toLocaleString()} &nbsp;|&nbsp; Filter: ${filterVal} &nbsp;|&nbsp; Total rows: ${filteredData.length}</p>
<table>${tableRows}</table>
</body></html>`;

    const blob = new Blob([html], { type:"application/msword" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `${title.toLowerCase().replace(/\s+/g,"_")}_export_${new Date().toISOString().slice(0,10)}.doc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div className="modal-head">
          <div>
            <div className="modal-title">Export {title}</div>
            <div className="modal-sub">Choose format, filter and columns</div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Format */}
        <div className="modal-section">
          <div className="modal-label">Format</div>
          <div className="fmt-row">
            {[
              { id:"excel", icon:"📊", label:"Excel (.csv)", sub:"Opens in Excel / Sheets" },
              { id:"word",  icon:"📄", label:"Word (.doc)",  sub:"Opens in Word" },
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

        {/* Filter */}
        <div className="modal-section">
          <div className="modal-label">Filter rows</div>
          <div className="filter-row">
            {["ALL",...filterOptions].map(opt=>(
              <button key={opt} className={`tab ${filterVal===opt?"tab-on":""}`} onClick={()=>setFilterVal(opt)}>{opt}</button>
            ))}
          </div>
          <div className="modal-count">{filteredData.length} rows will be exported</div>
        </div>

        {/* Column selector */}
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

        {/* Footer */}
        <div className="modal-foot">
          <button className="btn-discard" onClick={onClose}>Cancel</button>
          <button className="btn-save" disabled={selectedCols.length===0||filteredData.length===0}
            onClick={fmt==="excel"?exportExcel:exportWord}
            style={{opacity:selectedCols.length===0||filteredData.length===0?0.5:1}}>
            ↓ Download {fmt==="excel"?"Excel":"Word"}
          </button>
        </div>

      </div>
    </div>
  );
}

// ─── CSS ──────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
html,body,#root{height:100%;overflow:hidden;}
body{font-family:'Plus Jakarta Sans',sans-serif;color:#1e293b;background:#f1f5f9;}
.layout{display:flex;height:100vh;overflow:hidden;}
.sidebar{width:220px;flex-shrink:0;background:#fff;border-right:1px solid #e2e8f0;display:flex;flex-direction:column;height:100vh;}
.brand{padding:16px;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;gap:10px;}
.brand-logo{width:36px;height:36px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:9px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:16px;flex-shrink:0;box-shadow:0 3px 10px rgba(99,102,241,.3);}
.brand-name{font-size:14px;font-weight:700;color:#0f172a;}
.brand-sub{font-size:11px;color:#94a3b8;}
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
.main{flex:1;display:flex;flex-direction:column;min-width:0;height:100vh;overflow:hidden;}
.topbar{flex-shrink:0;padding:14px 24px;background:#fff;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;}
.topbar-title{font-size:18px;font-weight:700;color:#0f172a;}
.topbar-r{display:flex;align-items:center;gap:12px;}
.date-chip{font-size:12px;color:#64748b;font-weight:500;background:#f8fafc;border:1px solid #e2e8f0;padding:4px 12px;border-radius:20px;}
.avatar{width:32px;height:32px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:50%;color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;}
.content{flex:1;overflow-y:auto;padding:20px 24px;}
.dash{display:flex;flex-direction:column;gap:20px;height:100%;}
.stat-row{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;flex-shrink:0;}
.stat-card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:10px;transition:all .2s;}
.stat-card:hover{border-color:#cbd5e1;box-shadow:0 3px 12px rgba(0,0,0,.06);}
.stat-icon{width:36px;height:36px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:16px;}
.stat-label{font-size:11px;color:#64748b;font-weight:500;}
.stat-val{font-size:26px;font-weight:700;font-family:'IBM Plex Mono',monospace;line-height:1;}
.stat-bar-row{display:flex;align-items:center;gap:6px;}
.stat-bar{flex:1;height:3px;background:#f1f5f9;border-radius:2px;overflow:hidden;}
.stat-fill{height:100%;border-radius:2px;transition:width .7s ease;}
.stat-pct{font-size:10px;font-weight:600;font-family:'IBM Plex Mono',monospace;white-space:nowrap;}
.dash-bottom{display:grid;grid-template-columns:1fr 340px;gap:16px;flex:1;min-height:0;}
.map-card,.recent-card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;display:flex;flex-direction:column;overflow:hidden;}
.card-head{padding:12px 16px;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;}
.card-title{font-size:14px;font-weight:600;color:#0f172a;}
.btn-sm{padding:4px 12px;border-radius:6px;background:#f8fafc;border:1px solid #e2e8f0;color:#6366f1;font-size:12px;font-weight:600;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif;}
.btn-sm:hover{background:#eef2ff;border-color:#c7d2fe;}
.map-wrap{flex:1;padding:8px;min-height:0;}
.map-empty{padding:12px 16px;font-size:12px;color:#94a3b8;text-align:center;}
.map-legend{display:flex;gap:16px;padding:8px 16px;border-top:1px solid #f1f5f9;flex-wrap:wrap;flex-shrink:0;}
.legend-item{display:flex;align-items:center;gap:5px;font-size:11px;color:#64748b;font-weight:500;}
.legend-diamond{width:12px;height:12px;border-radius:2px;transform:rotate(45deg);flex-shrink:0;}
.legend-circle{width:12px;height:12px;border-radius:50%;flex-shrink:0;}
.recent-list{flex:1;overflow-y:auto;}
.recent-row{display:flex;align-items:center;justify-content:space-between;padding:10px 16px;border-bottom:1px solid #f8fafc;transition:background .1s;}
.recent-row:last-child{border-bottom:none;}
.recent-row:hover{background:#fafbff;}
.recent-id{font-family:'IBM Plex Mono',monospace;font-size:12px;color:#4f46e5;font-weight:500;}
.recent-loc{font-size:11.5px;color:#94a3b8;margin-top:1px;}
.empty-msg{padding:32px;text-align:center;color:#94a3b8;font-size:13px;}
.page-col{display:flex;flex-direction:column;gap:16px;height:100%;}
.section-title{font-size:15px;font-weight:600;color:#0f172a;}
.toolbar{display:flex;align-items:center;justify-content:space-between;flex-shrink:0;}
.tabs{display:flex;background:#f1f5f9;border-radius:8px;padding:3px;gap:2px;}
.tab{padding:5px 13px;border-radius:6px;border:none;font-size:12px;font-weight:500;cursor:pointer;background:transparent;color:#64748b;transition:all .15s;font-family:'Plus Jakarta Sans',sans-serif;}
.tab:hover{color:#334155;}
.tab-on{background:#fff!important;color:#4f46e5!important;font-weight:600!important;box-shadow:0 1px 4px rgba(0,0,0,.08);}
.btn-add{padding:8px 16px;border-radius:8px;background:#6366f1;color:#fff;font-size:13px;font-weight:600;border:none;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif;}
.btn-add:hover{background:#4f46e5;box-shadow:0 4px 12px rgba(99,102,241,.3);}
.form-box{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:18px;flex-shrink:0;animation:fd .18s ease;}
.edit-box{border-color:#fde68a;}
@keyframes fd{from{opacity:0;transform:translateY(-4px);}to{opacity:1;transform:translateY(0);}}
.form-head{font-size:14px;color:#0f172a;margin-bottom:14px;}
.edit-id{color:#d97706;font-family:'IBM Plex Mono',monospace;font-size:13px;}
.fg{display:grid;gap:10px;}
.fg-5{grid-template-columns:repeat(5,1fr);}
.field{display:flex;flex-direction:column;gap:4px;}
.flabel{font-size:10.5px;font-weight:600;color:#475569;letter-spacing:.2px;}
.finput{background:#f8fafc;border:1px solid #e2e8f0;border-radius:7px;color:#1e293b;font-size:12.5px;padding:8px 10px;outline:none;transition:all .15s;font-family:'Plus Jakarta Sans',sans-serif;width:100%;}
.finput:focus{border-color:#6366f1;background:#fff;box-shadow:0 0 0 3px rgba(99,102,241,.1);}
.finput::placeholder{color:#cbd5e1;}
.finput:disabled{opacity:.5;cursor:not-allowed;}
.factions{display:flex;gap:8px;margin-top:14px;}
.btn-save{padding:8px 18px;border-radius:7px;background:#22c55e;color:#fff;font-size:13px;font-weight:600;border:none;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif;}
.btn-save:hover{background:#16a34a;}
.btn-discard{padding:8px 14px;border-radius:7px;background:transparent;color:#64748b;font-size:13px;border:1px solid #e2e8f0;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif;}
.btn-discard:hover{border-color:#cbd5e1;color:#334155;}
.tbl-wrap{background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;flex:1;display:flex;flex-direction:column;min-height:0;}
.tbl-hd{padding:12px 16px;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;}
.tbl-title{font-size:14px;font-weight:600;color:#0f172a;display:flex;align-items:center;gap:8px;}
.tbl-cnt{background:#f1f5f9;color:#64748b;font-size:11px;font-weight:600;padding:2px 8px;border-radius:10px;}
.tbl-f{font-size:11px;color:#94a3b8;}
.tbl-scroll{flex:1;overflow:auto;}
table{width:100%;border-collapse:collapse;font-size:12.5px;}
thead{position:sticky;top:0;z-index:1;}
thead tr{background:#f8fafc;border-bottom:1px solid #e2e8f0;}
th{padding:9px 12px;text-align:left;font-size:10.5px;font-weight:600;color:#64748b;letter-spacing:.4px;text-transform:uppercase;white-space:nowrap;}
.th-sort{cursor:pointer;user-select:none;}
.th-sort:hover{color:#4f46e5;background:#f8fafc;}
tbody tr{border-bottom:1px solid #f8fafc;transition:background .1s;}
tbody tr:last-child{border-bottom:none;}
tbody tr:hover{background:#fafbff;}
td{padding:10px 12px;color:#475569;white-space:nowrap;}
.num{color:#94a3b8;font-size:11px;font-family:'IBM Plex Mono',monospace;}
.lid{font-family:'IBM Plex Mono',monospace;font-size:11.5px;color:#4f46e5;background:#eef2ff;padding:2px 7px;border-radius:4px;font-weight:500;}
.muted{color:#94a3b8;font-size:12px;}
.bold{color:#1e293b;font-weight:500;}
.notes-cell{max-width:140px;overflow:hidden;text-overflow:ellipsis;}
.type-chip{font-size:11px;font-weight:600;color:#0369a1;background:#e0f2fe;padding:2px 8px;border-radius:4px;}
.edit-btn{padding:4px 12px;border-radius:6px;background:#fff;border:1px solid #e2e8f0;color:#64748b;font-size:11.5px;font-weight:500;cursor:pointer;transition:all .15s;font-family:'Plus Jakarta Sans',sans-serif;}
.edit-btn:hover{border-color:#6366f1;color:#4f46e5;background:#eef2ff;}
.del-btn{padding:4px 12px;border-radius:6px;background:#fff;border:1px solid #fecaca;color:#dc2626;font-size:11.5px;font-weight:500;cursor:pointer;transition:all .15s;font-family:'Plus Jakarta Sans',sans-serif;}
.del-btn:hover{background:#fef2f2;}
.op-chip{font-size:11px;font-weight:700;padding:2px 8px;border-radius:4px;display:inline-block;}
.op-chip-akn{color:#4f46e5;background:#eef2ff;}
.op-chip-btl{color:#0369a1;background:#e0f2fe;}
.owner-chip{font-size:11px;font-weight:700;color:#4f46e5;background:#eef2ff;padding:2px 8px;border-radius:4px;}
.empty{padding:48px;text-align:center;color:#94a3b8;font-size:13px;}
.tbl-foot{padding:10px 16px;border-top:1px solid #f1f5f9;font-size:11.5px;color:#94a3b8;text-align:right;flex-shrink:0;}
.search-wrap{position:relative;display:flex;align-items:center;}
.search-icon{position:absolute;left:10px;color:#94a3b8;font-size:16px;pointer-events:none;}
.search-input{padding:7px 32px 7px 30px;border-radius:8px;border:1px solid #e2e8f0;background:#f8fafc;font-size:12.5px;color:#1e293b;outline:none;width:200px;font-family:'Plus Jakarta Sans',sans-serif;transition:all .15s;}
.search-input:focus{border-color:#6366f1;background:#fff;box-shadow:0 0 0 3px rgba(99,102,241,.1);width:240px;}
.search-input::placeholder{color:#cbd5e1;}
.search-clear{position:absolute;right:8px;background:none;border:none;color:#94a3b8;cursor:pointer;font-size:11px;padding:2px;line-height:1;}
.search-clear:hover{color:#475569;}
.util-btn{padding:4px 10px;border-radius:6px;background:#fff;border:1px solid #e0f2fe;color:#0369a1;font-size:11px;font-weight:600;cursor:pointer;transition:all .15s;font-family:'Plus Jakarta Sans',sans-serif;white-space:nowrap;}
.util-btn:hover{background:#e0f2fe;border-color:#7dd3fc;}
.req-btn{padding:4px 10px;border-radius:6px;background:#fff;border:1px solid #e2e8f0;color:#7c3aed;font-size:11px;font-weight:600;cursor:pointer;transition:all .15s;font-family:'Plus Jakarta Sans',sans-serif;white-space:nowrap;}
.req-btn:hover{background:#f5f3ff;border-color:#ddd6fe;}
.btn-export{padding:8px 14px;border-radius:8px;background:#fff;border:1px solid #e2e8f0;color:#4f46e5;font-size:13px;font-weight:600;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif;}
.btn-export:hover{background:#eef2ff;border-color:#c7d2fe;}
.modal-overlay{position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;}
.modal{background:#fff;border-radius:16px;width:100%;max-width:540px;box-shadow:0 20px 60px rgba(0,0,0,.2);display:flex;flex-direction:column;max-height:90vh;overflow:hidden;}
.modal-head{padding:20px 24px 16px;border-bottom:1px solid #f1f5f9;display:flex;align-items:flex-start;justify-content:space-between;flex-shrink:0;}
.modal-title{font-size:16px;font-weight:700;color:#0f172a;}
.modal-sub{font-size:12px;color:#94a3b8;margin-top:2px;}
.modal-close{width:28px;height:28px;border-radius:50%;border:1px solid #e2e8f0;background:#f8fafc;cursor:pointer;font-size:12px;color:#64748b;display:flex;align-items:center;justify-content:center;}
.modal-close:hover{background:#fee2e2;border-color:#fecaca;color:#dc2626;}
.modal-section{padding:16px 24px;border-bottom:1px solid #f8fafc;overflow-y:auto;}
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
.col-chip{display:flex;align-items:center;gap:6px;padding:7px 10px;border-radius:7px;border:1.5px solid #e2e8f0;cursor:pointer;font-size:12px;font-weight:500;color:#475569;transition:all .15s;}
.col-chip:hover{border-color:#c7d2fe;}
.col-on{border-color:#6366f1;background:#eef2ff;color:#4f46e5;}
.col-check{font-size:11px;width:14px;text-align:center;flex-shrink:0;color:#6366f1;}
.modal-foot{padding:16px 24px;border-top:1px solid #f1f5f9;display:flex;justify-content:flex-end;gap:10px;flex-shrink:0;}
::-webkit-scrollbar{width:5px;height:5px;}
::-webkit-scrollbar-track{background:#f8fafc;}
::-webkit-scrollbar-thumb{background:#e2e8f0;border-radius:3px;}
::-webkit-scrollbar-thumb:hover{background:#cbd5e1;}
`;