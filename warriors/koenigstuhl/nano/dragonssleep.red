;redcode-nano
;name where the dragons sleep
;author John Metcalf
;strategy paper
;assert CORESIZE==80

     pstep equ 61

pap: spl   #28,    <59
     mov   }pap-1, }dest
dest:spl   <pstep, >8
     mov.i #64,    }1
     djn.f <33,    <67

     end
