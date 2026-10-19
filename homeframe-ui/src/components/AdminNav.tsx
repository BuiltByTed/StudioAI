import { NavLink } from '@builtbyted/homeframe';
export function AdminNav() {
  return (
    <nav className="tabs" aria-label="Administration">
      <NavLink to="/admin/analytics">Analytics</NavLink>
      <NavLink to="/admin/users">People</NavLink>
      <NavLink to="/admin/users/groups">Groups</NavLink>
      <NavLink to="/admin/functions">Functions</NavLink>
      <NavLink to="/admin/evaluations">Evaluations</NavLink>
      <NavLink to="/admin/settings">Server settings</NavLink>
    </nav>
  );
}
