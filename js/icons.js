/* Simple line-art part icons (inline SVG, no external assets) */
(function () {
  const P = {
    disc: '<circle cx="32" cy="32" r="24"/><circle cx="32" cy="32" r="9"/><circle cx="32" cy="17" r="2.2"/><circle cx="46" cy="27" r="2.2"/><circle cx="41" cy="44" r="2.2"/><circle cx="23" cy="44" r="2.2"/><circle cx="18" cy="27" r="2.2"/>',
    hub: '<circle cx="32" cy="32" r="25"/><circle cx="32" cy="32" r="11"/><circle cx="32" cy="32" r="5"/><g><circle cx="32" cy="13" r="2.4"/><circle cx="45.4" cy="18.6" r="2.4"/><circle cx="51" cy="32" r="2.4"/><circle cx="45.4" cy="45.4" r="2.4"/><circle cx="32" cy="51" r="2.4"/><circle cx="18.6" cy="45.4" r="2.4"/><circle cx="13" cy="32" r="2.4"/><circle cx="18.6" cy="18.6" r="2.4"/></g>',
    piston: '<rect x="18" y="10" width="28" height="22" rx="3"/><path d="M18 17h28M18 22h28"/><path d="M26 32l-4 22h20l-4-22"/><circle cx="32" cy="44" r="3"/>',
    filter: '<rect x="18" y="12" width="28" height="40" rx="5"/><path d="M24 12v40M30 12v40M36 12v40M42 12v40"/><ellipse cx="32" cy="12" rx="14" ry="3"/>',
    fan: '<circle cx="32" cy="32" r="5"/><path d="M32 27c-2-10 4-16 10-14-1 6-4 10-10 14zM37 32c10-2 16 4 14 10-6-1-10-4-14-10zM32 37c2 10-4 16-10 14 1-6 4-10 10-14zM27 32c-10 2-16-4-14-10 6 1 10 4 14 10z"/>',
    pipe: '<path d="M8 26h22a8 8 0 0 1 8 8v20M8 38h14a4 4 0 0 1 4 4v12"/><path d="M38 20l6-8M44 22l8-6M42 28l10 0"/>',
    spring: '<path d="M22 8h20M22 56h20"/><path d="M24 12l16 6-16 6 16 6-16 6 16 6-16 6 16 6"/>',
    bolt: '<path d="M36 6L16 36h14l-4 22 22-32H34z"/>',
    gear: '<circle cx="32" cy="32" r="10"/><path d="M32 8v8M32 48v8M8 32h8M48 32h8M15 15l6 6M43 43l6 6M15 49l6-6M43 21l6-6"/><circle cx="32" cy="32" r="18"/>',
    snow: '<path d="M32 8v48M11 20l42 24M11 44l42-24"/><path d="M26 12l6 6 6-6M26 52l6-6 6 6"/>',
    wiper: '<path d="M10 50L50 14"/><path d="M14 54L54 18"/><circle cx="12" cy="52" r="4"/>',
    box: '<path d="M10 22l22-10 22 10v22L32 54 10 44z"/><path d="M10 22l22 10 22-10M32 32v22"/>'
  };
  window.icon = function (name, size, cls) {
    const s = size || 48;
    return '<svg class="ico ' + (cls || '') + '" width="' + s + '" height="' + s + '" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[name] || P.box) + '</svg>';
  };
  window.partIcon = function (subId, catIcon) {
    if (subId === 'wheel-hub-assembly' || subId === 'wheel-bearing-seal-kit') return 'hub';
    return catIcon || 'box';
  };
})();
