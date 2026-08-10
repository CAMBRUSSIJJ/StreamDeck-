export function reorderById(items, sourceId, targetId) {
  if (!Array.isArray(items) || sourceId === targetId) return items;
  const sourceIndex = items.findIndex(item => item.id === sourceId);
  const targetIndex = items.findIndex(item => item.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0) return items;
  const next = [...items];
  const [moved] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, moved);
  return next;
}

export function moveItemById(items, id, direction) {
  if (!Array.isArray(items)) return items;
  const index = items.findIndex(item => item.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function duplicateControl(control, newId) {
  return {
    ...structuredClone(control),
    id: newId,
    label: `${control.label} cópia`.slice(0, 28)
  };
}

export function uniquePageName(pages, base = 'Nova página') {
  const names = new Set((pages || []).map(page => String(page.name || '').trim().toLocaleLowerCase('pt-BR')));
  if (!names.has(base.toLocaleLowerCase('pt-BR'))) return base;
  let suffix = 2;
  while (names.has(`${base} ${suffix}`.toLocaleLowerCase('pt-BR'))) suffix += 1;
  return `${base} ${suffix}`;
}

export function duplicatePage(page, newId, newName, idFactory) {
  return {
    ...structuredClone(page),
    id: newId,
    name: newName,
    buttons: (page.buttons || []).map(button => ({ ...structuredClone(button), id: idFactory() }))
  };
}
