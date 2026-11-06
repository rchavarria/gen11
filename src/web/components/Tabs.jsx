import { useId, useRef, useState } from 'react';

export default function Tabs({ tabs, label }) {
  const baseId = useId();
  const [activeId, setActiveId] = useState(tabs[0].id);
  const tabRefs = useRef({});
  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0];

  function select(index) {
    const tab = tabs[(index + tabs.length) % tabs.length];
    setActiveId(tab.id);
    tabRefs.current[tab.id]?.focus();
  }

  function onKeyDown(event, index) {
    const target = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: tabs.length - 1,
    }[event.key];
    if (target === undefined) return;
    event.preventDefault();
    select(target);
  }

  return (
    <section className="tabs">
      <div className="tabs__list" role="tablist" aria-label={label}>
        {tabs.map((tab, index) => (
          <button
            type="button"
            role="tab"
            key={tab.id}
            id={`${baseId}-tab-${tab.id}`}
            aria-selected={tab.id === active.id}
            aria-controls={`${baseId}-panel-${tab.id}`}
            tabIndex={tab.id === active.id ? 0 : -1}
            className={`tabs__tab${tab.id === active.id ? ' tabs__tab--active' : ''}`}
            ref={(node) => {
              tabRefs.current[tab.id] = node;
            }}
            onClick={() => setActiveId(tab.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div
        className="tabs__panel"
        role="tabpanel"
        id={`${baseId}-panel-${active.id}`}
        aria-labelledby={`${baseId}-tab-${active.id}`}
      >
        {active.content}
      </div>
    </section>
  );
}
