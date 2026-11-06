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

export default function ClubLogo({ club }) {
  if (club.logo) {
    return <img className="club-logo" src={`${BASE_URL}logos/${club.logo}`} alt="" loading="lazy" />;
  }
  return (
    <span className="club-logo club-logo--placeholder" aria-hidden="true">
      {initials(club.name)}
    </span>
  );
}
