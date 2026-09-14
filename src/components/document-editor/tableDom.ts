export function tableElementsFromNodeDom(nodeDom: Node | null) {
  if (!(nodeDom instanceof HTMLElement)) return null
  const table = nodeDom instanceof HTMLTableElement ? nodeDom : nodeDom.querySelector(':scope > table')
  if (!(table instanceof HTMLTableElement)) return null
  return { wrapper: nodeDom instanceof HTMLTableElement ? nodeDom.parentElement ?? nodeDom : nodeDom, table }
}