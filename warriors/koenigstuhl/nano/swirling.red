;redcode-nano
;name swirling clouds
;author John Metcalf
;strategy paper/clear
;assert CORESIZE==80

     pstep equ 24

pap: spl   #1,     1
     mov   }pap-1, }dest
dest:spl   <pstep, >36
clr: mov   *6,     <-6
     djn.f clr,    <-33

     end
