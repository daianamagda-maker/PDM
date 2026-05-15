import React, { useEffect, useState } from "react";

const API_URL = "https://script.google.com/macros/s/AKfycbxDMumjW3HyMf4rFURxUgg-IqALRP8dPh-w2KZhgxMQ3iv_G6Uc9BgZC3zvg2ABSiue/exec";
const DISCORD_CLIENT_ID = "1504596999373193269";
const DISCORD_GUILD_ID = "1470101024818728962";

const ROLE_IDS: Record<string, string> = {
  Directeur: "1473983195232862288",
  Manageur: "1473988211872370808",
  "Vendeur Senior": "1473988658842308730",
  Vendeur: "1473989053878763680",
  Stagiaire: "1473989485938348061",
};

const ROLE_PRIORITY = ["Directeur", "Manageur", "Vendeur Senior", "Vendeur", "Stagiaire"];
const MANAGEMENT_GRADES = ["Directeur", "Manageur"];

const defaultPercentages: Record<string, number> = {
  Directeur: 15,
  Manageur: 15,
  "Vendeur Senior": 13,
  Vendeur: 10,
  Stagiaire: 5,
};

type Employee = {
  id: string;
  discordId: string;
  discordPseudo: string;
  name: string;
  grade: string;
  phone?: string;
  status: string;
};

type Sale = {
  id: string;
  date: string;
  employee: string;
  employeeId: string;
  plate: string;
  model: string;
  price: number;
  owner: string;
  category: string;
  hasLicense: boolean;
  grade: string;
  percent: number;
  bonus: number;
};

type Leave = {
  id: string;
  employee: string;
  grade: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: string;
  requestDate: string;
};

type ServiceLog = {
  id: string;
  employeeId: string;
  employee: string;
  grade: string;
  start: string;
  end: string;
  date: string;
};

type PercentageRow = {
  grade: string;
  percent: number;
};

type Vehicle = {
  model: string;
  price: number;
  category: string;
};

const grades = ["Directeur", "Manageur", "Vendeur Senior", "Vendeur", "Stagiaire"];

const nav = [
  { label: "Tableau de bord", icon: "🏠" },
  { label: "Prise de service", icon: "📅" },
  { label: "Ventes", icon: "🚗" },
  { label: "Employés", icon: "👥" },
  { label: "Congés", icon: "🗓️" },
  { label: "Gestion pourcentage", icon: "%" },
  { label: "Primes", icon: "📈" },
];

function getDiscordLoginUrl() {
  const redirectUri = window.location.origin;
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "token",
    scope: "identify guilds.members.read",
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>;
}

function StatCard({ icon, title, value }: { icon: string; title: string; value: string | number }) {
  return (
    <Card className="stat-card">
      <div className="stat-icon">{icon}</div>
      <div>
        <p className="muted small uppercase">{title}</p>
        <p className="stat-value">{value}</p>
      </div>
    </Card>
  );
}

export default function PDMDealershipApp() {
  const [active, setActive] = useState("Tableau de bord");
  const [onDuty, setOnDuty] = useState(false);
  const [dutyStart, setDutyStart] = useState("");
  const [discordUser, setDiscordUser] = useState<any>(() => {
    const saved = localStorage.getItem("pdm_discord_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [userGrade, setUserGrade] = useState(() => localStorage.getItem("pdm_user_grade") || "Stagiaire");
  const [accessAllowed, setAccessAllowed] = useState(() => localStorage.getItem("pdm_access_allowed") === "true");
  const [checkingAccess, setCheckingAccess] = useState(false);
  const [accessMessage, setAccessMessage] = useState("");

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [activeServices, setActiveServices] = useState<ServiceLog[]>([]);
  const [percentages, setPercentages] = useState<PercentageRow[]>(Object.entries(defaultPercentages).map(([grade, percent]) => ({ grade, percent })));

  const [saleForm, setSaleForm] = useState({ plate: "", model: "", category: "", price: "", owner: "", hasLicense: false });
  const [employeeForm, setEmployeeForm] = useState({ discordId: "", discordPseudo: "", name: "", grade: "Stagiaire", phone: "", status: "Actif" });
  const [leaveForm, setLeaveForm] = useState({ employee: "", startDate: "", endDate: "", reason: "" });
  const [search, setSearch] = useState("");

  const today = new Date().toLocaleDateString("fr-FR");
  const currentEmployee = employees.find((e) => discordUser && e.discordId === discordUser.id);
  const currentGrade = currentEmployee?.grade || userGrade;
  const hasManagementAccess = MANAGEMENT_GRADES.includes(userGrade);

  const apiGet = async (type: string) => {
    const res = await fetch(`${API_URL}?type=${type}`);
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  };

  const apiPost = async (type: string, data: any) => {
    await fetch(API_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ type, data }),
    });
  };

  const getPercentForGrade = (grade: string) => percentages.find((p) => p.grade === grade)?.percent ?? defaultPercentages[grade] ?? 0;

  const fetchEmployees = async () => {
    try {
      const data = await apiGet("employes");
      setEmployees(data.map((e, index) => ({
        id: String(e.ID || `E-${index + 1}`),
        discordId: String(e.DiscordID || ""),
        discordPseudo: e.DiscordPseudo || "",
        name: e.NomRP || e.Nom || "",
        grade: e.Grade || "Stagiaire",
        phone: e.Téléphone || "",
        status: e.Statut || "Actif",
      })).filter((e) => e.name));
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSales = async () => {
    try {
      const data = await apiGet("ventes");
      setSales(data.map((s, index) => ({
        id: String(s.ID || `V-${index + 1}`),
        date: s.Date || "",
        employee: s.Employé || "",
        employeeId: String(s.EmployéID || ""),
        plate: s.Plaque || "",
        model: s.Modèle || s.Modele || "",
        price: Number(s.Prix || 0),
        owner: s.Propriétaire || s.Proprietaire || "",
        category: s.Catégorie || s.Categorie || "",
        hasLicense: String(s.Permis || "").toLowerCase() === "oui" || String(s.Permis || "").toLowerCase() === "true" || String(s.Permis || "") === "✅",
        grade: s.Grade || "",
        percent: Number(s.Pourcentage || 0),
        bonus: Number(s.Prime || 0),
      })).filter((s) => s.plate));
    } catch (err) {
      console.error(err);
    }
  };

  const fetchVehicles = async () => {
    try {
      const data = await apiGet("vehicules");
      setVehicles(data.map((v) => ({
        model: v.Modèle || v.Modele || "",
        price: Number(String(v.Prix || "0").replace(/[^0-9]/g, "")),
        category: v.Catégorie || v.Categorie || "",
      })).filter((v) => v.model));
    } catch (err) {
      console.error(err);
    }
  };

  const fetchLeaves = async () => {
    try {
      const data = await apiGet("conges");
      setLeaves(data.map((c, index) => ({
        id: String(c.ID || `C-${index + 1}`),
        employee: c.Employé || "",
        grade: c.Grade || "",
        startDate: c.Début || "",
        endDate: c.Fin || "",
        reason: c.Motif || "",
        status: c.Statut || "En attente",
        requestDate: c.DateDemande || "",
      })).filter((c) => c.employee));
    } catch (err) {
      console.error(err);
    }
  };

  const fetchServices = async () => {
    try {
      const data = await apiGet("prisesService");
      const mapped = data.map((s, index) => ({
        id: String(s.ID || `S-${index + 1}`),
        employeeId: String(s.EmployéID || ""),
        employee: s.NomRP || "",
        grade: s.Grade || "",
        start: s.Début || "",
        end: s.Fin || "",
        date: s.Date || "",
      })).filter((s) => s.employee);
      setActiveServices(mapped.filter((s) => !s.end));
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPercentages = async () => {
    try {
      const data = await apiGet("pourcentages");
      if (data.length) setPercentages(data.map((p) => ({ grade: p.Grade || "", percent: Number(p.Pourcentage || 0) })).filter((p) => p.grade));
    } catch (err) {
      console.error(err);
    }
  };

  const loadActivePage = async (page: string) => {
    if (page === "Tableau de bord") await Promise.all([fetchEmployees(), fetchSales(), fetchServices()]);
    if (page === "Prise de service") await fetchServices();
    if (page === "Ventes") await Promise.all([fetchSales(), fetchVehicles()]);
    if (page === "Employés") await fetchEmployees();
    if (page === "Congés") await Promise.all([fetchLeaves(), fetchEmployees()]);
    if (page === "Gestion pourcentage") await fetchPercentages();
    if (page === "Primes") await fetchSales();
  };

  useEffect(() => {
    fetchEmployees();
    const hash = window.location.hash.replace("#", "");
    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token") || localStorage.getItem("pdm_discord_access_token");

    if (accessToken) {
      setCheckingAccess(true);
      localStorage.setItem("pdm_discord_access_token", accessToken);
      Promise.all([
        fetch("https://discord.com/api/users/@me", { headers: { Authorization: `Bearer ${accessToken}` } }).then((res) => res.json()),
        fetch(`https://discord.com/api/users/@me/guilds/${DISCORD_GUILD_ID}/member`, { headers: { Authorization: `Bearer ${accessToken}` } }),
      ])
        .then(async ([user, memberResponse]) => {
          setDiscordUser(user);
          if (!memberResponse.ok) {
            setAccessAllowed(false);
            setAccessMessage("Accès refusé : tu n’es pas reconnu dans le serveur Discord PDM.");
            return;
          }
          const member = await memberResponse.json();
          const detectedGrade = ROLE_PRIORITY.find((grade) => member.roles.includes(ROLE_IDS[grade]));
          if (!detectedGrade) {
            setAccessAllowed(false);
            setAccessMessage("Accès refusé : tu n’as pas de rôle PDM autorisé.");
            return;
          }
          setUserGrade(detectedGrade);
          setAccessAllowed(true);
          setAccessMessage("");
          localStorage.setItem("pdm_discord_user", JSON.stringify(user));
          localStorage.setItem("pdm_user_grade", detectedGrade);
          localStorage.setItem("pdm_access_allowed", "true");
          window.history.replaceState(null, "", window.location.pathname);
        })
        .catch(() => {
          setAccessAllowed(false);
          setAccessMessage("Erreur pendant la vérification Discord.");
        })
        .finally(() => setCheckingAccess(false));
    }
  }, []);

  useEffect(() => {
    if (accessAllowed) loadActivePage(active);
  }, [active, accessAllowed]);

  const filteredNav = nav.filter((item) => !(["Employés", "Primes", "Gestion pourcentage"].includes(item.label) && !hasManagementAccess));
  const activeEmployees = employees.filter((e) => e.status === "Actif");
  const totalSales = sales.reduce((t, s) => t + s.price, 0);
  const totalBonuses = sales.reduce((t, s) => t + s.bonus, 0);
  const filteredSales = sales.filter((s) =>
    s.plate.toLowerCase().includes(search.toLowerCase()) ||
    s.model.toLowerCase().includes(search.toLowerCase()) ||
    s.owner.toLowerCase().includes(search.toLowerCase()) ||
    s.employee.toLowerCase().includes(search.toLowerCase())
  );

  const addEmployee = async () => {
    if (!employeeForm.name.trim() || !employeeForm.discordId.trim()) return;
    const data = {
      ID: `E-${Date.now()}`,
      DiscordID: employeeForm.discordId,
      DiscordPseudo: employeeForm.discordPseudo,
      NomRP: employeeForm.name,
      Grade: employeeForm.grade,
      Téléphone: employeeForm.phone,
      Statut: employeeForm.status,
      DateAjout: today,
    };
    await apiPost("employes", data);
    setEmployeeForm({ discordId: "", discordPseudo: "", name: "", grade: "Stagiaire", phone: "", status: "Actif" });
    fetchEmployees();
  };

  const updateEmployee = (id: string, field: string, value: string) => setEmployees(employees.map((e) => (e.id === id ? { ...e, [field]: value } : e)));
  const deleteEmployee = async (id: string) => {
    await apiPost("deleteEmploye", { ID: id });
    setEmployees(employees.filter((e) => e.id !== id));
  };

  const handleVehicleChange = (model: string) => {
    const found = vehicles.find((v) => v.model.toLowerCase() === model.toLowerCase());
    setSaleForm({
      ...saleForm,
      model,
      price: found ? String(found.price) : saleForm.price,
      category: found ? found.category : saleForm.category,
    });
  };

  const addSale = async () => {
    const price = Number(saleForm.price);
    if (!saleForm.plate.trim() || !saleForm.model.trim() || !saleForm.owner.trim() || !price) return;
    const grade = currentGrade;
    const percent = getPercentForGrade(grade);
    const bonus = Math.round((price * percent) / 100);
    const data = {
      ID: `V-${Date.now()}`,
      Date: today,
      Employé: currentEmployee?.name || discordUser?.username || "",
      EmployéID: discordUser?.id || "",
      Plaque: saleForm.plate,
      Modèle: saleForm.model,
      Prix: price,
      Propriétaire: saleForm.owner,
      Catégorie: saleForm.category,
      Permis: saleForm.hasLicense ? "✅" : "❌",
      Grade: grade,
      Pourcentage: percent,
      Prime: bonus,
    };
    await apiPost("ventes", data);
    setSaleForm({ plate: "", model: "", category: "", price: "", owner: "", hasLicense: false });
    fetchSales();
  };

  const addLeave = async () => {
    if (!leaveForm.employee || !leaveForm.startDate || !leaveForm.endDate) return;
    const employee = employees.find((e) => e.name === leaveForm.employee);
    await apiPost("conges", {
      ID: `C-${Date.now()}`,
      Employé: leaveForm.employee,
      Grade: employee?.grade || "",
      Début: leaveForm.startDate,
      Fin: leaveForm.endDate,
      Motif: leaveForm.reason,
      Statut: "En attente",
      DateDemande: today,
    });
    setLeaveForm({ employee: "", startDate: "", endDate: "", reason: "" });
    fetchLeaves();
  };

  const updateLeaveStatus = (id: string, status: string) => setLeaves(leaves.map((l) => (l.id === id ? { ...l, status } : l)));
  const savePercentages = async () => await apiPost("pourcentages", { rows: percentages });

  const toggleDuty = async () => {
    if (!onDuty) {
      const start = new Date().toISOString();
      const serviceId = `S-${Date.now()}`;
      const data = {
        ID: serviceId,
        EmployéID: discordUser?.id || "",
        NomRP: currentEmployee?.name || discordUser?.username || "",
        Grade: currentGrade,
        Début: start,
        Fin: "",
        Date: today,
      };
      await apiPost("prisesService", data);
      setDutyStart(start);
      setOnDuty(true);
      setActiveServices([{ id: serviceId, employeeId: discordUser?.id || "", employee: data.NomRP, grade: currentGrade, start, end: "", date: today }, ...activeServices]);
      return;
    }

    await apiPost("prisesService", {
      ID: `S-${Date.now()}`,
      EmployéID: discordUser?.id || "",
      NomRP: currentEmployee?.name || discordUser?.username || "",
      Grade: currentGrade,
      Début: dutyStart,
      Fin: new Date().toISOString(),
      Date: today,
    });
    setOnDuty(false);
    setDutyStart("");
    setActiveServices(activeServices.filter((s) => s.employeeId !== discordUser?.id));
    fetchServices();
  };

  const loginWithDiscord = () => window.location.href = getDiscordLoginUrl();
  const logoutDiscord = () => {
    localStorage.removeItem("pdm_discord_access_token");
    localStorage.removeItem("pdm_discord_user");
    localStorage.removeItem("pdm_user_grade");
    localStorage.removeItem("pdm_access_allowed");
    setDiscordUser(null);
    setUserGrade("Stagiaire");
    setAccessAllowed(false);
  };

  if (!discordUser) {
    return (
      <div className="app center-page">
        <Style />
        <Card className="login-card">
          <img src="/logo.png" alt="PDM" className="login-logo" />
          <h1>Premium Deluxe Motorsport</h1>
          <p className="muted">Connexion obligatoire avec Discord.</p>
          <button onClick={loginWithDiscord} className="btn blue full">Connexion Discord</button>
        </Card>
      </div>
    );
  }

  if (checkingAccess) {
    return <div className="app center-page"><Style /><Card className="login-card"><div className="big-icon">🚗</div><h1>Vérification Discord...</h1></Card></div>;
  }

  if (!accessAllowed) {
    return (
      <div className="app center-page">
        <Style />
        <Card className="login-card">
          <div className="big-icon red-glow">🛡️</div>
          <h1>Accès refusé</h1>
          <p className="muted">{accessMessage}</p>
          <button onClick={logoutDiscord} className="btn red full">Se déconnecter</button>
        </Card>
      </div>
    );
  }

  return (
    <div className="app">
      <Style />
      <div className="layout">
        <aside className="sidebar">
          <img src="/logo.png" alt="PDM" className="side-logo" />
          <h1 className="brand">PDM</h1>
          <p className="tagline">Premium Deluxe Motorsport</p>
          <div className="stripe" />
          <p className="nav-title">Navigation</p>
          <nav>
            {filteredNav.map((item) => (
              <button key={item.label} onClick={() => setActive(item.label)} className={`nav-btn ${active === item.label ? "active" : ""}`}>
                <span>{item.icon}</span>{item.label}
              </button>
            ))}
          </nav>
        </aside>

        <main className="main">
          <header className="topbar">
            <div>
              <h2>Premium Deluxe Motorsport</h2>
              <p className="muted">Portail interne PDM</p>
            </div>
            <div className="profile">
              <span className="bell">🔔</span>
              <img src={discordUser.avatar ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png` : "/logo.png"} alt={discordUser.username} />
              <div>
                <p className="profile-name">{currentEmployee?.name || discordUser.username}</p>
                <p className="profile-grade">{currentGrade}</p>
              </div>
              <button onClick={logoutDiscord} className="btn red small">Déconnexion</button>
            </div>
          </header>

          {active === "Tableau de bord" && (
            <section className="grid dash">
              <div className="stats-grid">
                <StatCard icon="👥" title="Employés actifs" value={activeEmployees.length} />
                <StatCard icon="🚗" title="Ventes" value={sales.length} />
                <StatCard icon="💼" title="Chiffre total" value={`${totalSales.toLocaleString("fr-FR")} $`} />
                <StatCard icon="📈" title="Primes" value={`${totalBonuses.toLocaleString("fr-FR")} $`} />
              </div>
              <Card className="hierarchy">
                <h3>Hiérarchie</h3>
                {grades.map((g) => <p key={g} className="rank">{g}</p>)}
              </Card>
              <Card>
                <h3>Prise de service</h3>
                <span className={`badge ${onDuty ? "green" : "red"}`}>{onDuty ? "EN SERVICE" : "HORS SERVICE"}</span>
                <button onClick={toggleDuty} className={`btn full duty ${onDuty ? "red" : "green"}`}>{onDuty ? "Fin de service" : "Prendre service"}</button>
              </Card>
              <Card>
                <h3>Accès rapide</h3>
                <div className="quick-grid">
                  <button onClick={() => setActive("Ventes")} className="quick">＋<span>Nouvelle vente</span></button>
                  <button onClick={() => setActive("Congés")} className="quick">📅<span>Congés</span></button>
                  {hasManagementAccess && <button onClick={() => setActive("Employés")} className="quick">👥<span>Employés</span></button>}
                  {hasManagementAccess && <button onClick={() => setActive("Primes")} className="quick">📈<span>Primes</span></button>}
                </div>
              </Card>
            </section>
          )}

          {active === "Prise de service" && (
            <section className="grid two">
              <Card>
                <h3>Ma prise de service</h3>
                <p className={`status ${onDuty ? "text-green" : "text-red"}`}>{onDuty ? "EN SERVICE" : "HORS SERVICE"}</p>
                {onDuty && dutyStart && <p className="muted">Début : {new Date(dutyStart).toLocaleString("fr-FR")}</p>}
                <button onClick={toggleDuty} className={`btn full ${onDuty ? "red" : "green"}`}>{onDuty ? "Finir mon service" : "Prendre mon service"}</button>
              </Card>
              <Card>
                <h3>Employés en service</h3>
                {activeServices.length === 0 ? <p className="muted">Aucun employé en service.</p> : activeServices.map((s) => <div className="service-card" key={s.id}><b>{s.employee}</b><p>{s.grade}</p><small>Depuis : {s.start ? new Date(s.start).toLocaleString("fr-FR") : "—"}</small></div>)}
              </Card>
            </section>
          )}

          {active === "Ventes" && (
            <section className="grid two">
              <Card>
                <h3>Nouvelle vente</h3>
                <input placeholder="Plaque véhicule" value={saleForm.plate} onChange={(e) => setSaleForm({ ...saleForm, plate: e.target.value })} />
                <input placeholder="Rechercher un modèle véhicule" value={saleForm.model} onChange={(e) => handleVehicleChange(e.target.value)} />
                {saleForm.model && vehicles.filter((v) => v.model.toLowerCase().includes(saleForm.model.toLowerCase())).slice(0, 8).length > 0 && (
                  <div className="suggestions">
                    {vehicles.filter((v) => v.model.toLowerCase().includes(saleForm.model.toLowerCase())).slice(0, 8).map((v) => (
                      <button key={v.model} type="button" onClick={() => setSaleForm({ ...saleForm, model: v.model, price: String(v.price), category: v.category })}>
                        <b>{v.model}</b><span>{v.category} · {v.price.toLocaleString("fr-FR")} $</span>
                      </button>
                    ))}
                  </div>
                )}
                <input placeholder="Catégorie" value={saleForm.category} readOnly />
                <input placeholder="Prix" type="number" value={saleForm.price} onChange={(e) => setSaleForm({ ...saleForm, price: e.target.value })} />
                <input placeholder="Propriétaire" value={saleForm.owner} onChange={(e) => setSaleForm({ ...saleForm, owner: e.target.value })} />
                <label className="check-row">
                  <input type="checkbox" checked={saleForm.hasLicense} onChange={(e) => setSaleForm({ ...saleForm, hasLicense: e.target.checked })} />
                  <span>Le client a le permis</span>
                </label>
                <p className="info-box">Grade : {currentGrade} · Pourcentage : {getPercentForGrade(currentGrade)}%</p>
                <button onClick={addSale} className="btn blue full">Enregistrer la vente</button>
              </Card>
              <Card>
                <div className="table-head"><h3>Suivi des ventes</h3><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher..." /></div>
                <Table headers={["Date", "Employé", "Plaque", "Modèle", "Catégorie", "Prix", "Propriétaire", "Permis", "Prime"]}>
                  {filteredSales.map((s) => <tr key={s.id}><td>{s.date}</td><td><b>{s.employee}</b></td><td>{s.plate}</td><td>{s.model}</td><td>{s.category}</td><td>{s.price.toLocaleString("fr-FR")} $</td><td>{s.owner}</td><td className="license-cell">{s.hasLicense ? "✅" : "❌"}</td><td className="text-green">{s.bonus.toLocaleString("fr-FR")} $</td></tr>)}
                </Table>
              </Card>
            </section>
          )}

          {active === "Employés" && hasManagementAccess && (
            <section className="grid two">
              <Card>
                <h3>Ajouter un employé</h3>
                <input placeholder="ID Discord" value={employeeForm.discordId} onChange={(e) => setEmployeeForm({ ...employeeForm, discordId: e.target.value })} />
                <input placeholder="Pseudo Discord" value={employeeForm.discordPseudo} onChange={(e) => setEmployeeForm({ ...employeeForm, discordPseudo: e.target.value })} />
                <input placeholder="Nom RP" value={employeeForm.name} onChange={(e) => setEmployeeForm({ ...employeeForm, name: e.target.value })} />
                <input placeholder="Téléphone" value={employeeForm.phone} onChange={(e) => setEmployeeForm({ ...employeeForm, phone: e.target.value })} />
                <select value={employeeForm.grade} onChange={(e) => setEmployeeForm({ ...employeeForm, grade: e.target.value })}>{grades.map((g) => <option key={g}>{g}</option>)}</select>
                <button onClick={addEmployee} className="btn blue full">Ajouter l’employé</button>
              </Card>
              <Card>
                <h3>Employés</h3>
                <Table headers={["ID Discord", "Pseudo", "Nom RP", "Grade", "Statut", "Action"]}>
                  {employees.map((e) => <tr key={e.id}><td>{e.discordId}</td><td>{e.discordPseudo}</td><td><input value={e.name} onChange={(ev) => updateEmployee(e.id, "name", ev.target.value)} /></td><td><select value={e.grade} onChange={(ev) => updateEmployee(e.id, "grade", ev.target.value)}>{grades.map((g) => <option key={g}>{g}</option>)}</select></td><td><select value={e.status} onChange={(ev) => updateEmployee(e.id, "status", ev.target.value)}><option>Actif</option><option>Suspendu</option><option>Inactif</option></select></td><td><button onClick={() => deleteEmployee(e.id)} className="btn red small">Retirer</button></td></tr>)}
                </Table>
              </Card>
            </section>
          )}

          {active === "Congés" && (
            <section className="grid two">
              <Card>
                <h3>Demande de congé</h3>
                <select value={leaveForm.employee} onChange={(e) => setLeaveForm({ ...leaveForm, employee: e.target.value })}><option value="">Choisir un employé</option>{employees.map((e) => <option key={e.id}>{e.name}</option>)}</select>
                <input type="date" value={leaveForm.startDate} onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })} />
                <input type="date" value={leaveForm.endDate} onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })} />
                <textarea placeholder="Motif" value={leaveForm.reason} onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })} />
                <button onClick={addLeave} className="btn blue full">Envoyer la demande</button>
              </Card>
              <Card>
                <h3>Suivi des congés</h3>
                <Table headers={["Employé", "Grade", "Début", "Fin", "Motif", "Statut"]}>
                  {leaves.map((l) => <tr key={l.id}><td><b>{l.employee}</b></td><td>{l.grade}</td><td>{l.startDate}</td><td>{l.endDate}</td><td>{l.reason}</td><td><select value={l.status} onChange={(e) => updateLeaveStatus(l.id, e.target.value)}><option>En attente</option><option>Accepté</option><option>Refusé</option></select></td></tr>)}
                </Table>
              </Card>
            </section>
          )}

          {active === "Gestion pourcentage" && hasManagementAccess && (
            <Card>
              <h3>Gestion des pourcentages</h3>
              <div className="percent-grid">
                {percentages.map((row) => <div className="percent-card" key={row.grade}><b>{row.grade}</b><input type="number" value={row.percent} onChange={(e) => setPercentages(percentages.map((p) => p.grade === row.grade ? { ...p, percent: Number(e.target.value) } : p))} /><small>% sur les ventes</small></div>)}
              </div>
              <button onClick={savePercentages} className="btn blue">Sauvegarder les pourcentages</button>
            </Card>
          )}

          {active === "Primes" && hasManagementAccess && (
            <Card>
              <h3>Primes par vente</h3>
              <Table headers={["Date", "Employé", "Grade", "Prix", "%", "Prime"]}>
                {sales.map((s) => <tr key={s.id}><td>{s.date}</td><td><b>{s.employee}</b></td><td>{s.grade}</td><td>{s.price.toLocaleString("fr-FR")} $</td><td>{s.percent}%</td><td className="text-green">{s.bonus.toLocaleString("fr-FR")} $</td></tr>)}
              </Table>
            </Card>
          )}
        </main>
      </div>
    </div>
  );
}

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return <div className="table-wrap"><table><thead><tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{children}</tbody></table></div>;
}

function Style() {
  return (
    <style>{`
      * { box-sizing: border-box; }
      html, body, #root { margin: 0; width: 100%; min-width: 100%; min-height: 100%; background: #05070d; overflow-x: hidden; }
      body { font-family: Inter, Arial, sans-serif; }
      .app { width: 100vw; min-width: 100vw; min-height: 100vh; background: radial-gradient(circle at top left, rgba(37,99,235,.24), transparent 32%), radial-gradient(circle at top right, rgba(225,29,72,.22), transparent 30%), #05070d; color: #f8fafc; }
      .center-page { width: 100vw; min-height: 100vh; display: grid; place-items: center; padding: 24px; }
      .layout { width: 100vw; min-height: 100vh; display: flex; }
      .sidebar { width: 320px; flex-shrink: 0; position: sticky; top: 0; height: 100vh; overflow-y: auto; padding: 24px; background: rgba(0,0,0,.72); border-right: 1px solid rgba(255,255,255,.1); }
      .side-logo { width: 100%; height: 96px; object-fit: contain; margin-bottom: 18px; }
      .brand { margin: 0; font-size: 34px; font-style: italic; font-weight: 1000; }
      .tagline, .nav-title { color: #60a5fa; text-transform: uppercase; font-size: 12px; font-weight: 900; letter-spacing: .08em; }
      .stripe { height: 8px; border-radius: 999px; background: linear-gradient(90deg, #2563eb, #fff, #e11d48); margin: 16px 0 28px; }
      .nav-btn { width: 100%; display: flex; gap: 12px; align-items: center; margin-bottom: 9px; padding: 14px 16px; border: 0; border-radius: 14px; background: transparent; color: #cbd5e1; font-weight: 800; text-align: left; cursor: pointer; }
      .nav-btn.active { background: rgba(37,99,235,.95); color: white; }
      .main { flex: 1; min-width: 0; padding: 28px; }
      .topbar { display: flex; justify-content: space-between; gap: 18px; align-items: center; border-bottom: 1px solid rgba(255,255,255,.1); padding-bottom: 22px; margin-bottom: 24px; }
      .topbar h2 { margin: 0; font-size: 34px; font-style: italic; font-weight: 1000; color: #7f1d1d; text-shadow: 0 0 18px rgba(127,29,29,.55); background: linear-gradient(90deg, #7f1d1d, #dc2626, #991b1b); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
      .profile { display: flex; align-items: center; gap: 14px; padding: 10px 12px; border: 1px solid rgba(255,255,255,.12); border-radius: 18px; background: rgba(255,255,255,.05); }
      .profile img { width: 44px; height: 44px; border-radius: 999px; object-fit: cover; }
      .profile-name { margin: 0; font-weight: 1000; }
      .profile-grade { margin: 0; color: #93c5fd; font-size: 13px; font-weight: 900; }
      .bell { font-size: 22px; opacity: .8; }
      .card { border: 1px solid rgba(255,255,255,.1); background: rgba(2,6,23,.86); border-radius: 24px; padding: 22px; box-shadow: 0 18px 50px rgba(0,0,0,.28); }
      .card h3 { margin: 0 0 18px; color: #93c5fd; font-size: 20px; }
      .login-card { width: 100%; max-width: 540px; text-align: center; }
      .login-card h1 { font-size: 42px; line-height: 1.05; margin: 0 0 14px; font-style: italic; font-weight: 1000; color: #7f1d1d; text-shadow: 0 0 18px rgba(127,29,29,.55); background: linear-gradient(90deg, #7f1d1d, #dc2626, #991b1b); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
      .login-logo { width: 150px; height: 150px; object-fit: contain; margin-bottom: 20px; }
      .big-icon { width: 70px; height: 70px; display: grid; place-items: center; margin: 0 auto 16px; border-radius: 22px; background: rgba(37,99,235,.22); font-size: 34px; }
      .red-glow { background: rgba(220,38,38,.22); }
      .muted { color: #94a3b8; }
      .small { font-size: 12px; }
      .uppercase { text-transform: uppercase; letter-spacing: .08em; }
      .grid { display: grid; gap: 18px; }
      .dash { grid-template-columns: 1fr 320px; }
      .stats-grid { grid-column: 1; display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px; }
      .two { grid-template-columns: 430px 1fr; }
      .stat-card { display: flex; align-items: center; gap: 16px; }
      .stat-icon { width: 58px; height: 58px; display: grid; place-items: center; border-radius: 18px; background: linear-gradient(135deg, rgba(37,99,235,.9), rgba(225,29,72,.7)); font-size: 28px; }
      .stat-value { margin: 4px 0 0; font-size: 30px; font-weight: 1000; }
      .hierarchy { grid-column: 2; grid-row: span 3; }
      .rank { padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,.1); font-weight: 900; }
      .quick-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
      .quick { min-height: 105px; border: 1px solid rgba(255,255,255,.1); border-radius: 18px; background: rgba(255,255,255,.05); color: white; font-size: 28px; font-weight: 900; cursor: pointer; }
      .quick span { display: block; margin-top: 8px; font-size: 14px; color: #bfdbfe; }
      button { transition: background-color 180ms ease, transform 180ms ease, filter 180ms ease, box-shadow 180ms ease; }
      button:hover:not(:disabled) { filter: brightness(1.18); transform: translateY(-1px) scale(1.02); box-shadow: 0 10px 24px rgba(0,0,0,.28); }
      button:active:not(:disabled) { transform: translateY(0) scale(.98); filter: brightness(.95); }
      .btn { border: 0; border-radius: 14px; color: white; font-weight: 900; padding: 13px 18px; cursor: pointer; }
      .btn.full { width: 100%; margin-top: 12px; }
      .btn.small { padding: 10px 12px; font-size: 12px; }
      .blue { background: #2563eb; }
      .red { background: #dc2626; }
      .green { background: #16a34a; }
      .badge { display: inline-block; margin-bottom: 20px; padding: 7px 12px; border-radius: 999px; font-size: 12px; font-weight: 1000; }
      .status { font-size: 34px; font-weight: 1000; }
      .text-green { color: #86efac; font-weight: 900; }
      .text-red { color: #fca5a5; }
      input, select, textarea { width: 100%; margin-bottom: 12px; padding: 14px 16px; border-radius: 14px; border: 1px solid rgba(255,255,255,.12); background: rgba(0,0,0,.35); color: white; outline: none; }
      input:focus, select:focus, textarea:focus { border-color: #60a5fa; }
      textarea { min-height: 120px; resize: vertical; }
      .info-box { padding: 12px; border-radius: 14px; background: rgba(37,99,235,.12); color: #bfdbfe; }
      .suggestions { margin: -6px 0 12px; border: 1px solid rgba(255,255,255,.12); border-radius: 14px; overflow: hidden; background: rgba(2,6,23,.98); }
      .suggestions button { width: 100%; display: flex; justify-content: space-between; gap: 10px; padding: 12px 14px; border: 0; border-bottom: 1px solid rgba(255,255,255,.08); background: transparent; color: white; text-align: left; cursor: pointer; }
      .suggestions button:hover { background: rgba(37,99,235,.22); }
      .suggestions span { color: #93c5fd; font-size: 13px; }
      .check-row { display: flex; align-items: center; gap: 10px; margin: 4px 0 14px; padding: 12px 14px; border: 1px solid rgba(255,255,255,.12); border-radius: 14px; background: rgba(0,0,0,.25); color: #bfdbfe; font-weight: 800; }
      .check-row input { width: auto; margin: 0; accent-color: #2563eb; }
      .license-cell { font-size: 18px; text-align: center; }
      .table-head { display: flex; align-items: center; justify-content: space-between; gap: 14px; }
      .table-head input { max-width: 260px; }
      .table-wrap { overflow-x: auto; border: 1px solid rgba(255,255,255,.1); border-radius: 16px; }
      table { width: 100%; min-width: 900px; border-collapse: collapse; font-size: 14px; }
      th { background: rgba(37,99,235,.38); text-align: left; padding: 14px; }
      td { border-top: 1px solid rgba(255,255,255,.1); padding: 12px 14px; }
      .service-card, .percent-card { margin-bottom: 12px; padding: 16px; border: 1px solid rgba(255,255,255,.1); border-radius: 16px; background: rgba(255,255,255,.05); }
      .percent-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 14px; }
      @media (max-width: 1100px) { .layout { flex-direction: column; } .sidebar { position: relative; width: 100%; height: auto; } .dash, .two { grid-template-columns: 1fr; } .hierarchy { grid-column: auto; } .stats-grid, .percent-grid { grid-template-columns: repeat(2, 1fr); } }
      @media (max-width: 640px) { .main { padding: 16px; } .topbar { align-items: flex-start; flex-direction: column; } .stats-grid, .quick-grid, .percent-grid { grid-template-columns: 1fr; } }
    `}</style>
  );
}
