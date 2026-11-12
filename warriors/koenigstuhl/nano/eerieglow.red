;redcode-nano
;name eerie glow
;author John Metcalf
;strategy paper/clear
;assert CORESIZE==80

     pstep equ -27

pap: spl   #0,     >-11
     mov   }pap,   }dest
dest:spl   <pstep, >-19
clr: mov   *15,    <-7
     djn.f clr,    <-31

     end
