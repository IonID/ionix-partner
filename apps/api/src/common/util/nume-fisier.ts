/**
 * Antetul `Content-Disposition`, scris aşa încât să nu pice pe diacritice.
 *
 * Node refuză să pună în antet caractere care nu încap în latin1 şi aruncă
 * `ERR_INVALID_CHAR` — direct 500, fără nicio linie în jurnal. „î" şi „â" trec,
 * fiindcă sunt în latin1; „ş", „ţ" şi „ă" nu.
 *
 * Găsit pe 19.09.2026: descărcarea dosarului BIC al unei cliente pe nume
 * GHEORGHIŢĂ CORINA dădea „Internal server error", de fiecare dată. Ofiţerul a
 * încercat de cinci ori, crezând că e o pană trecătoare. Nu era: orice client
 * cu ş, ţ sau ă în nume lovea acelaşi perete.
 *
 * Scriem numele de două ori, cum cere RFC 6266: o dată curăţat, pentru
 * cititorii vechi, şi o dată codificat, ca browserul să salveze fişierul cu
 * diacriticele la locul lor.
 */
export function dispozitieFisier(nume: string, mod: 'attachment' | 'inline' = 'attachment'): string {
  const curat = (nume || 'fisier')
    // „ă" → „a", „ţ" → „t": despărţim litera de semnul de deasupra şi aruncăm semnul.
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    // Ce a mai rămas în afara ASCII-ului tipăribil, plus ghilimelele care ar
    // închide antetul mai devreme.
    .replace(/[^\x20-\x7E]/g, '_')
    .replace(/["\\]/g, '_')
    .trim() || 'fisier';

  return `${mod}; filename="${curat}"; filename*=UTF-8''${encodeURIComponent(nume)}`;
}
