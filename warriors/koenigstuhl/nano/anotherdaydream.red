;redcode-nano
;name another daydream...
;author John Metcalf
;strategy paper/clear
;assert CORESIZE==80

     pstep equ 11

pap: spl   #0,     >-38
     mov   }pap,   }dest
dest:spl   <pstep, >22
clr: mov   >44,    <37
     djn.f clr,    <-21

     end
