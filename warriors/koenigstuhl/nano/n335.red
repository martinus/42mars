;redcode-nano
;name The White Wind
;author Christian Schmidt
;strategy 
;assert 1

pStp   equ   51
pBmb1  equ   73
pBmb2  equ   35
pBmb3  equ   70

pGo    spl   #0,     <pBmb1+1
       mov   }pGo,   }pAwa
pAwa   spl   <pStp,  >-pBmb1
       mov   *pBmb2, >-pBmb1/2
       djn.f -1,     {pBmb3

       end
