;redcode-94
;name The tables have turned
;author David Houston
;strategy Metcalf's "table scan" for 2310
;assert 1
;       CORESIZE==2310

ptr: sne   *tab-1,   @tab-1
     djn.f {0,       }0
     add.x @ptr,     }0

     spl   #0,       0
clr: mov   @bp,      >ptr
     mov   @bp,      >ptr
bp:  djn.f clr,      {sb

     dat   -20,      9
sb:  spl   #tab+2150, 11

   a for   20
     spl   #tab+15+a*104,<tab+67+a*104
     rof

   a for   21
     spl   #tab-11+a*104,<tab+41+a*104
     rof
tab: end
