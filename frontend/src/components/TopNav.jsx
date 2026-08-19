import { useEffect, useRef, useState } from "react";
import {
  Contact, LayoutDashboard, GitCompare, TriangleAlert, UserMinus,
  Settings, Upload, BookOpen, UserCog, ChevronDown, LogOut,
} from "lucide-react";

const PRINCIPALES = [
  { id: "legajos", label: "Legajos", Icon: Contact },
  { id: "dashboard", label: "Dashboard RRHH", Icon: LayoutDashboard },
  { id: "comparativos", label: "Comparativos", Icon: GitCompare },
  { id: "alertas", label: "Alertas", Icon: TriangleAlert },
  { id: "bajas", label: "Bajas", Icon: UserMinus },
];

export default function TopNav({ vista, setVista, usuario, cerrarSesion }) {
  const [adminAbierto, setAdminAbierto] = useState(false);
  const menuRef = useRef(null);

  const ADMIN_ITEMS = [
    { id: "importar", label: "Importar", Icon: Upload },
    { id: "competencias", label: "Competencias", Icon: BookOpen },
    ...(usuario.rol === "ADMIN" ? [{ id: "usuarios", label: "Usuarios", Icon: UserCog }] : []),
  ];
  const enSeccionAdmin = ADMIN_ITEMS.some((i) => i.id === vista);

  useEffect(() => {
    function handleClickFuera(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setAdminAbierto(false);
    }
    document.addEventListener("mousedown", handleClickFuera);
    return () => document.removeEventListener("mousedown", handleClickFuera);
  }, []);

  return (
    <header className="topnav">
      <div className="topnav-brand">
        <span className="brand-mark">CV</span>
        <span className="brand-name">Campo Verde <span className="brand-sub">RRHH</span></span>
      </div>

      <nav className="topnav-links">
        {PRINCIPALES.map(({ id, label, Icon }) => (
          <button key={id} className="topnav-link" aria-current={vista === id} onClick={() => setVista(id)}>
            <Icon size={16} strokeWidth={2} />
            {label}
          </button>
        ))}

        <div className="topnav-dropdown" ref={menuRef}>
          <button
            className="topnav-link"
            aria-current={enSeccionAdmin}
            onClick={() => setAdminAbierto((v) => !v)}
          >
            <Settings size={16} strokeWidth={2} />
            Configuración
            <ChevronDown size={14} strokeWidth={2} style={{ opacity: 0.7 }} />
          </button>
          {adminAbierto && (
            <div className="topnav-dropdown-menu">
              {ADMIN_ITEMS.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  className="topnav-dropdown-item"
                  aria-current={vista === id}
                  onClick={() => { setVista(id); setAdminAbierto(false); }}
                >
                  <Icon size={16} strokeWidth={2} />
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </nav>

      <div className="topnav-account">
        <span className="topnav-account-name">👤 {usuario.nombre}</span>
        <button className="link-button" onClick={cerrarSesion}>
          <LogOut size={13} strokeWidth={2} style={{ verticalAlign: "-2px", marginRight: 4 }} />
          Cerrar sesión
        </button>
      </div>
    </header>
  );
}
