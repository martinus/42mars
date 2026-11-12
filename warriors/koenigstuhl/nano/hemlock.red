;redcode-nano
;name hemlock
;author John Metcalf
;strategy paper/clear
;assert CORESIZE==80

     pstep equ 11

pap: spl   #0,     <-28
     mov   }pap,   }dest
dest:spl   <pstep, >-24
clr: mov   }30,    <-31
     djn.f clr,    <-20

     end

