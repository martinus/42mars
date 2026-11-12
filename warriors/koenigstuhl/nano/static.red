;redcode-nano
;name static
;author John Metcalf
;strategy scanner
;assert CORESIZE==80

     step  equ -5
     first equ wipe+10

scan:sub   #step,    wipe
wipe:jmz.f scan,     first
     mov.i #40,      >wipe
     djn.f wipe,     <wipe-8
     mov.i #1,       1
     end   wipe
