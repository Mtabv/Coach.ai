import { demoProvider } from './demoProvider';
import { fussballDeProvider } from './fussballDe/provider';
import type { MatchDataProvider } from './provider';

/** Reihenfolge = Priorität. Später: Sportmedia-Anbieter (offiziell) vor fussball.de (inoffiziell). */
export const providers: MatchDataProvider[] = [demoProvider, fussballDeProvider];
