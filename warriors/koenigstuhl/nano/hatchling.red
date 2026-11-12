;redcode-nano
;name Hatchling
;author John Metcalf
;strategy paper
;assert CORESIZE==80

     pstep equ 23

pap: spl   #1,     >67
     mov   }pap-1, }dest
dest:spl   <pstep, }48
     mov.i #60,    }1
     djn.f <35,    <72

     end