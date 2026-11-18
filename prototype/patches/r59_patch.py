import sys
p = sys.argv[1]; s = open(p).read()
# Eintägige Dienste: „21.11.“ statt „21.11.–21.11.“
n = s.count("${fmt(d.from)}–${fmt(d.to)}")
assert n >= 4, n
s = s.replace("${fmt(d.from)}–${fmt(d.to)}", "${d.from === d.to ? fmt(d.from) : fmt(d.from) + '–' + fmt(d.to)}")
open(p, 'w').write(s); print('ok', n)
