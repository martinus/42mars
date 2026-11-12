;redcode-nano
;name glowing embers
;author John Metcalf
;strategy paper/clear
;assert CORESIZE==80

     pstep equ 17

pap: spl   #0,     {-22
     mov   }pap,   }dest
dest:spl   <pstep, <10
clr: mov   21,     {-25
     djn.f clr,    <-35

     end

