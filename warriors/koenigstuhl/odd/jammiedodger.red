;redcode-odd
;name Jammie Dodger
;author John Metcalf
;strategy IRCT15, white warrior killer
;strategy bomb-dodger
;assert CORESIZE==8000

find:jmz.f  #2000,          {find
     mov    cjmp,           *find
     mov    cmov,           {find
     jmp    *find,          <-999
cmov:mov    2,              >1
cjmp:jmp    cmov,           >10
     end
