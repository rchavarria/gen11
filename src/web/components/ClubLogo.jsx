const BASE_URL = import.meta.env.BASE_URL;

function initials(name) {
  return (
    name
      .split(/\s+/)
      .filter((word) => word.length > 2 && !word.includes('.'))
      .slice(0, 2)
      .map((word) => word[0])
      .join('') || name.slice(0, 2)
  );
}

export default function ClubLogo({ team }) {
  if (team.logo) {
    return <img className="club-logo" src={`${BASE_URL}logos/${team.logo}`} alt={team.name} loading="lazy" />;
  }
  return (
    <span className="club-logo club-logo--placeholder" aria-hidden="true">
      {initials(team.name)}
    </span>
  );
}
