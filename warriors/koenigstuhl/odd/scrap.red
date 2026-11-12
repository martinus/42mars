;redcode-94
;name scrap of paper
;author John Metcalf
;strategy paper for IRCT09
;assert 1
;       CORESIZE==2520

     pstep equ -748
     adist equ 1260
     bdist equ -12

     spl   }1,       {1
     spl   {1,       }1
     spl   }1,       {1

pap: nop   >0,       >pstep
     spl   >pap,     <pap
     mov   }pap,     >pap
     spl   }0,       {0
     mov   >adist,   >bdist
     djn.f {0,       }0
     end

