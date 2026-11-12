;redcode-nano
;name violet haze
;author John Metcalf
;strategy paper/imp
;assert CORESIZE==80

     pstep equ pap+53

pap  spl   #0,     <pstep-1
     mov   }pap,   >pap
     mov   >11,    <-9
     spl   *pstep, <-5
     mov.i #1,     1
     end
